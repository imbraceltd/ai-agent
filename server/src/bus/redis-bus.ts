import Redis from "ioredis";
import logger from "@/lib/logger";
import type {
  BusEventDefinition,
  BusEventEnvelope,
} from "./bus-event";
import { BusEvent } from "./bus-event";
import type {
  BusEventHandler,
  BusWildcardHandler,
  IBus,
  Unsubscribe,
} from "./types";

interface RedisBusOptions {
  /** Full ioredis URL, e.g. "redis://common-redis:6379". */
  url: string;
  /**
   * Prefix prepended to every channel name. Keeps this bus isolated from
   * other services sharing the same Redis instance. Example: "ai-agent:event:".
   */
  channelPrefix: string;
}

/**
 * Cross-instance bus backed by Redis Pub/Sub. Uses a single PSUBSCRIBE to the
 * prefixed namespace so that:
 *  - `subscribe(def, handler)` is a local-only bookkeeping op (fast).
 *  - `subscribeAll(handler)` receives every event on the bus.
 * Every instance receives every event, then filters locally via the handler
 * registry — acceptable for the current low-volume event set.
 */
export class RedisBus implements IBus {
  private pub: Redis;
  private sub: Redis;
  private readonly channelPrefix: string;
  private readonly pattern: string;

  private handlers = new Map<string, Set<BusEventHandler<BusEventDefinition>>>();
  private wildcardHandlers = new Set<BusWildcardHandler>();

  constructor(opts: RedisBusOptions) {
    this.channelPrefix = opts.channelPrefix;
    this.pattern = `${opts.channelPrefix}*`;

    this.pub = new Redis(opts.url, { maxRetriesPerRequest: 3 });
    this.sub = new Redis(opts.url, { maxRetriesPerRequest: null });

    this.pub.on("error", (err) =>
      logger.error("RedisBus pub error", {
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    this.sub.on("error", (err) =>
      logger.error("RedisBus sub error", {
        message: err instanceof Error ? err.message : String(err),
      }),
    );

    this.sub.on("pmessage", (_pattern, channel, message) => {
      this.handleIncoming(channel, message);
    });

    // Eager subscribe to every event in our namespace.
    this.sub
      .psubscribe(this.pattern)
      .then(() =>
        logger.info("RedisBus psubscribed", { pattern: this.pattern }),
      )
      .catch((err) =>
        logger.error("RedisBus psubscribe failed", {
          pattern: this.pattern,
          message: err instanceof Error ? err.message : String(err),
        }),
      );
  }

  async publish<Def extends BusEventDefinition>(
    def: Def,
    properties: BusEventEnvelope<Def>["properties"],
  ): Promise<void> {
    const envelope: BusEventEnvelope<Def> = { type: def.type, properties };
    const channel = this.channelName(def.type);
    const payload = JSON.stringify(envelope);
    const subscriberCount = await this.pub.publish(channel, payload);
    // Reason: subscriberCount is the number of Redis clients (across all
    // instances) that received the event. 0 means nobody is listening — useful
    // signal that fan-out is misconfigured.
    logger.debug("RedisBus PUBLISH", {
      channel,
      type: def.type,
      bytes: payload.length,
      subscriberCount,
    });
  }

  subscribe<Def extends BusEventDefinition>(
    def: Def,
    handler: BusEventHandler<Def>,
  ): Unsubscribe {
    let set = this.handlers.get(def.type);
    if (!set) {
      set = new Set();
      this.handlers.set(def.type, set);
    }
    const typed = handler as BusEventHandler<BusEventDefinition>;
    set.add(typed);
    return () => {
      const current = this.handlers.get(def.type);
      if (!current) return;
      current.delete(typed);
      if (current.size === 0) this.handlers.delete(def.type);
    };
  }

  subscribeAll(handler: BusWildcardHandler): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  async dispose(): Promise<void> {
    try {
      await this.sub.punsubscribe(this.pattern);
    } catch (err) {
      logger.warn("RedisBus punsubscribe failed during dispose", {
        message: err instanceof Error ? err.message : String(err),
      });
    }
    await Promise.allSettled([this.pub.quit(), this.sub.quit()]);
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const [pubReply, subStatus] = await Promise.all([
        this.pub.ping(),
        // The subscriber connection cannot run PING while subscribed in some
        // modes; fall back to checking the connection status flag.
        Promise.resolve(this.sub.status),
      ]);
      return pubReply === "PONG" && subStatus === "ready";
    } catch {
      return false;
    }
  }

  private channelName(type: string): string {
    return `${this.channelPrefix}${type}`;
  }

  private stripPrefix(channel: string): string {
    return channel.startsWith(this.channelPrefix)
      ? channel.slice(this.channelPrefix.length)
      : channel;
  }

  private handleIncoming(channel: string, message: string): void {
    const type = this.stripPrefix(channel);

    let envelope: BusEventEnvelope<BusEventDefinition>;
    try {
      envelope = JSON.parse(message);
    } catch (err) {
      logger.warn("RedisBus received non-JSON message", {
        channel,
        message: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (!envelope || envelope.type !== type) {
      logger.warn("RedisBus envelope/channel mismatch", {
        channel,
        envelopeType: envelope?.type,
      });
      return;
    }

    const def = BusEvent.get(type);
    if (def) {
      const parsed = def.properties.safeParse(envelope.properties);
      if (!parsed.success) {
        logger.warn("RedisBus payload failed Zod validation", {
          type,
          issues: parsed.error.issues,
        });
        return;
      }
      envelope.properties = parsed.data;
    }

    const typeHandlers = this.handlers.get(type);
    const typedCount = typeHandlers?.size ?? 0;
    const wildcardCount = this.wildcardHandlers.size;
    // Reason: lets us see whether an event arrived at this instance and how
    // many local handlers will fire. typedCount=0 + wildcardCount=0 means the
    // event was received but no consumer cares — usually a non-issue (events
    // are broadcast to all instances) but worth knowing.
    logger.debug("RedisBus RECV", {
      channel,
      type,
      bytes: message.length,
      typedHandlers: typedCount,
      wildcardHandlers: wildcardCount,
    });

    if (typeHandlers) {
      for (const handler of [...typeHandlers]) {
        this.dispatch(handler, envelope, type);
      }
    }
    for (const handler of [...this.wildcardHandlers]) {
      this.dispatch(handler, envelope, "*");
    }
  }

  private dispatch(
    handler:
      | BusEventHandler<BusEventDefinition>
      | BusWildcardHandler,
    envelope: BusEventEnvelope<BusEventDefinition>,
    label: string,
  ): void {
    try {
      const result = handler(envelope);
      if (result instanceof Promise) {
        result.catch((err) =>
          logger.error("RedisBus handler rejected", {
            label,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    } catch (err) {
      logger.error("RedisBus handler threw", {
        label,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
