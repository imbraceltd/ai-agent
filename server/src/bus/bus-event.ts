/**
 * Typed event definitions for the cross-instance Bus.
 * Port of the OpenCode bus-event pattern adapted for our codebase.
 */

import type { ZodType, z } from "zod";

/**
 * A registered event definition. `type` is the channel name used on the wire
 * (e.g. "chat.status"); `properties` is the Zod schema used to validate
 * payloads both when publishing (TypeScript-level) and when receiving from
 * remote instances (runtime).
 */
export interface BusEventDefinition<
  Type extends string = string,
  Properties extends ZodType = ZodType,
> {
  type: Type;
  properties: Properties;
}

/**
 * Envelope published on the wire. Subscribers always receive this shape.
 */
export interface BusEventEnvelope<Definition extends BusEventDefinition> {
  type: Definition["type"];
  properties: z.infer<Definition["properties"]>;
}

const registry = new Map<string, BusEventDefinition>();

/**
 * Register a typed event. The returned definition is used as the key for
 * `Bus.publish` and `Bus.subscribe`, providing end-to-end type inference.
 */
function define<Type extends string, Properties extends ZodType>(
  type: Type,
  properties: Properties,
): BusEventDefinition<Type, Properties> {
  if (registry.has(type)) {
    // Reason: same type registered twice usually indicates a duplicate import
    // or re-entrant test setup. Allow override but keep the last definition.
    registry.set(type, { type, properties });
  } else {
    registry.set(type, { type, properties });
  }
  return { type, properties };
}

/** Returns all registered event types. Used by RedisBus to eager-subscribe. */
function types(): string[] {
  return Array.from(registry.keys());
}

/** Lookup a registered definition by type (for payload validation). */
function get(type: string): BusEventDefinition | undefined {
  return registry.get(type);
}

export const BusEvent = { define, types, get };
