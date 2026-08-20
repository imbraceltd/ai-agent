/**
 * Cross-instance Bus backed by Redis Pub/Sub.
 *
 * Usage:
 *   const ChatStatus = BusEvent.define("chat.status", z.object({ ... }));
 *   await Bus.publish(ChatStatus, { ... });
 *   const unsub = Bus.subscribe(ChatStatus, (event) => { ... });
 */

import config from "@/config";
import logger from "@/lib/logger";
import { RedisBus } from "./redis-bus";
import type { IBus } from "./types";

export { BusEvent } from "./bus-event";
export type { BusEventDefinition, BusEventEnvelope } from "./bus-event";
export type { IBus, BusEventHandler, BusWildcardHandler, Unsubscribe } from "./types";

logger.info("Bus initialized", { channelPrefix: config.bus.channelPrefix });

/** Process-wide singleton. */
export const Bus: IBus = new RedisBus({
  url: config.redis.url,
  channelPrefix: config.bus.channelPrefix,
});
