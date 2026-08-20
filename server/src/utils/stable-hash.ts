/**
 * Deterministic stable hash of any serializable value for identity comparison.
 * Sorts object keys recursively before stringifying, so key-insertion-order
 * differences (common when LLMs re-generate identical tool args) still produce
 * the same string.
 */
export function stableHash(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj !== null && typeof obj === "object") {
    return Object.keys(obj as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((obj as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return obj;
}
