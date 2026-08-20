import type { BusEventDefinition, BusEventEnvelope } from "./bus-event";

export type BusEventHandler<Def extends BusEventDefinition> = (
  event: BusEventEnvelope<Def>,
) => void | Promise<void>;

export type BusWildcardHandler = (
  event: BusEventEnvelope<BusEventDefinition>,
) => void | Promise<void>;

/** Function returned by subscribe/subscribeAll to remove the handler. */
export type Unsubscribe = () => void;

/**
 * Bus interface implemented by RedisBus (Redis Pub/Sub).
 */
export interface IBus {
  publish<Def extends BusEventDefinition>(
    def: Def,
    properties: BusEventEnvelope<Def>["properties"],
  ): Promise<void>;

  subscribe<Def extends BusEventDefinition>(
    def: Def,
    handler: BusEventHandler<Def>,
  ): Unsubscribe;

  subscribeAll(handler: BusWildcardHandler): Unsubscribe;

  /** Clean up underlying Redis connections. */
  dispose(): Promise<void>;

  /** Liveness check — pings the pub connection and inspects sub status. */
  isHealthy(): Promise<boolean>;
}
