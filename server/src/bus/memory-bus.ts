/**
 * In-process Bus implementation for single-instance / local-dev deployments.
 *
 * Drop-in replacement for RedisBus when Redis is disabled. Same IBus surface,
 * just no cross-instance fan-out. Selected by bus/index.ts based on
 * REDIS_ENABLED env.
 */

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

export class MemoryBus implements IBus {
  private handlers = new Map<string, Set<BusEventHandler<BusEventDefinition>>>();
  private wildcardHandlers = new Set<BusWildcardHandler>();

  async publish<Def extends BusEventDefinition>(
    def: Def,
    properties: BusEventEnvelope<Def>["properties"],
  ): Promise<void> {
    const envelope: BusEventEnvelope<Def> = { type: def.type, properties };

    const registered = BusEvent.get(def.type);
    if (registered) {
      const parsed = registered.properties.safeParse(properties);
      if (!parsed.success) {
        logger.warn("MemoryBus publish payload failed Zod validation", {
          type: def.type,
          issues: parsed.error.issues,
        });
        return;
      }
      envelope.properties = parsed.data as typeof envelope.properties;
    }

    const typeHandlers = this.handlers.get(def.type);
    if (typeHandlers) {
      for (const handler of [...typeHandlers]) {
        this.dispatch(handler, envelope, def.type);
      }
    }
    for (const handler of [...this.wildcardHandlers]) {
      this.dispatch(handler, envelope, "*");
    }
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
    this.handlers.clear();
    this.wildcardHandlers.clear();
  }

  async isHealthy(): Promise<boolean> {
    return true;
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
          logger.error("MemoryBus handler rejected", {
            label,
            message: err instanceof Error ? err.message : String(err),
          }),
        );
      }
    } catch (err) {
      logger.error("MemoryBus handler threw", {
        label,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
