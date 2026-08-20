/**
 * Built-in assistant registry.
 *
 * Hardcoded assistant configs that are surfaced to every organization without
 * a per-org row in MongoDB. `getAssistantSettings` short-circuits to this
 * registry when the assistant_id has the `builtin-` prefix, then merges any
 * per-org override doc on top.
 */

import databoardAgent from "./databoard-agent.json";

const REGISTRY: Record<string, Record<string, unknown>> = {
  "builtin-databoard-agent": databoardAgent as Record<string, unknown>,
};

export const BUILTIN_ASSISTANT_IDS = Object.keys(
  REGISTRY,
) as readonly BuiltinAssistantId[];

export type BuiltinAssistantId = "builtin-databoard-agent";

export function isBuiltinAssistantId(id: string): id is BuiltinAssistantId {
  return id in REGISTRY;
}

/**
 * Returns a deep clone of the base config so callers can mutate freely without
 * corrupting the in-memory registry across requests.
 */
export function getBuiltinAssistantBase(
  id: BuiltinAssistantId,
): Record<string, unknown> {
  const entry = REGISTRY[id];
  if (!entry) {
    throw new Error(`Unknown builtin assistant id: ${id}`);
  }
  return structuredClone(entry);
}

export function listBuiltinAssistants(): Record<string, unknown>[] {
  return BUILTIN_ASSISTANT_IDS.map((id) => getBuiltinAssistantBase(id));
}
