/**
 * Model Context Limits
 * Fetches and caches model context window / output token limits from models.dev.
 * Mirrors the OpenCode pattern: startup fetch + 60-min background refresh +
 * in-memory lazy cache backed by a filesystem cache file.
 *
 * Usage:
 *   const limits = await getModelLimits("gpt-4o");
 *   const usable = computeUsableTokens(limits, compactionReserved);
 */

import path from "path";
import os from "os";
import fs from "fs/promises";
import logger from "@/lib/logger";

export interface ModelLimits {
  /** Total context window in tokens (models.dev: limit.context) */
  context: number;
  /** Max output tokens (models.dev: limit.output) */
  output: number;
  /** Optional separate input cap (models.dev: limit.input) */
  input?: number;
}

// ── Constants (mirrors OpenCode) ──────────────────────────
const MODELS_DEV_URL =
  process.env["OPENCODE_MODELS_URL"] ?? "https://models.dev";
/** Cache file — same tmp directory, refreshed on startup and every 60 min */
const CACHE_FILE = path.join(os.tmpdir(), "imbrace-models-dev.json");
const REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 60 min
/** OpenCode constant: hard cap on output tokens used in threshold formula */
const OUTPUT_TOKEN_MAX = 32_000;
/** OpenCode constant: default reserved buffer below the usable limit */
const COMPACTION_BUFFER = 20_000;

// ── In-memory lazy cache ───────────────────────────────────
let _cache: Record<string, unknown> | null = null;

async function loadData(): Promise<Record<string, unknown>> {
  if (_cache) return _cache;

  // 1. Filesystem cache (written by refreshData)
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf-8");
    _cache = JSON.parse(raw) as Record<string, unknown>;
    return _cache;
  } catch {
    /* fall through */
  }

  // 2. Live fetch as last resort
  return refreshData();
}

async function refreshData(): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${MODELS_DEV_URL}/api.json`, {
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const text = await res.text();
      await fs.writeFile(CACHE_FILE, text, "utf-8");
      _cache = JSON.parse(text) as Record<string, unknown>;
      logger.info("models.dev cache refreshed");
    }
  } catch (e) {
    logger.warn("Failed to refresh models.dev cache", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return _cache ?? {};
}

// ── Background refresh on module load (fire-and-forget, like OpenCode) ──
if (!process.env["DISABLE_MODELS_FETCH"]) {
  // Intentionally not awaited — runs in background
  refreshData().catch(() => {});
  setInterval(() => {
    refreshData().catch(() => {});
  }, REFRESH_INTERVAL_MS).unref();
}

// ── Public API ─────────────────────────────────────────────

/**
 * Resolve context window limits for a model from models.dev data.
 * Falls back to safe defaults (128k context / 16k output) when the model
 * is not found in the cache or the API is unavailable.
 *
 * models.dev response shape:
 *   { [providerId]: { models: { [modelId]: { limit: { context, output, input? } } } } }
 *
 * @param modelId - Model identifier (e.g. "gpt-4o", "claude-3-5-sonnet-20241022")
 */
export async function getModelLimits(modelId: string): Promise<ModelLimits> {
  try {
    const data = await loadData();

    // Collect all provider model maps for multi-pass lookup
    const providerMaps: Array<Record<string, unknown>> = [];
    for (const providerEntry of Object.values(data)) {
      if (!providerEntry || typeof providerEntry !== "object") continue;
      const models = (providerEntry as Record<string, unknown>)["models"];
      if (!models || typeof models !== "object") continue;
      providerMaps.push(models as Record<string, unknown>);
    }

    // Reason: Two-pass lookup prevents a fuzzy match from one provider (e.g. iflowcn/qwen3-32b)
    // shadowing an exact match from another provider (e.g. amazon-bedrock/qwen.qwen3-32b-v1:0).

    // Pass 1: Exact key match across ALL providers
    for (const modelsMap of providerMaps) {
      const exact = modelsMap[modelId] as Record<string, unknown> | undefined;
      if (exact) {
        const limit = exact["limit"] as
          | { context?: number; output?: number; input?: number }
          | undefined;
        if (limit) {
          return {
            context: limit.context ?? 0,
            output: limit.output ?? 0,
            ...(limit.input !== undefined ? { input: limit.input } : {}),
          };
        }
      }
    }

    // Pass 2: Fuzzy match (includes) across ALL providers
    for (const modelsMap of providerMaps) {
      const fuzzy = Object.values(modelsMap).find((m) => {
        if (!m || typeof m !== "object") return false;
        const rec = m as Record<string, unknown>;
        if (typeof rec["id"] !== "string") return false;
        const storedId = rec["id"] as string;
        return (
          storedId === modelId ||
          storedId.includes(modelId) ||
          modelId.includes(storedId)
        );
      }) as Record<string, unknown> | undefined;

      if (fuzzy) {
        const limit = fuzzy["limit"] as
          | { context?: number; output?: number; input?: number }
          | undefined;
        if (limit) {
          return {
            context: limit.context ?? 0,
            output: limit.output ?? 0,
            ...(limit.input !== undefined ? { input: limit.input } : {}),
          };
        }
      }
    }
  } catch (e) {
    logger.warn("Failed to resolve model limits from models.dev", {
      modelId,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // Safe defaults when models.dev lookup fails
  logger.debug("Using default model limits fallback", { modelId });
  return { context: 128_000, output: 16_384 };
}

/**
 * Compute the usable token threshold before compaction should trigger.
 * Mirrors OpenCode's isOverflow formula exactly:
 *
 *   maxOutput = min(model.limit.output, OUTPUT_TOKEN_MAX)
 *   reserved  = compactionReserved ?? min(COMPACTION_BUFFER, maxOutput)
 *   usable    = model.limit.input
 *                 ? model.limit.input - reserved
 *                 : model.limit.context - maxOutput
 *
 * Returns Infinity when context=0 (model has no known limit → never compact).
 *
 * @param limits - Model limits from getModelLimits()
 * @param compactionReserved - Optional custom buffer from assistant metadata.compaction_reserved
 */
export function computeUsableTokens(
  limits: ModelLimits,
  compactionReserved?: number,
): number {
  if (limits.context === 0) return Infinity;

  const maxOutput = Math.min(
    limits.output || OUTPUT_TOKEN_MAX,
    OUTPUT_TOKEN_MAX,
  );
  const buffer =
    compactionReserved ?? Math.min(COMPACTION_BUFFER, maxOutput);

  const raw = limits.input !== undefined
    ? limits.input - buffer
    : limits.context - maxOutput;

  // Reason: When models.dev reports context ≤ output (e.g. both 16384 for
  // Bedrock qwen3-32b), the formula yields 0 or negative. Fall back to using
  // half the context window as the usable budget, which is a safe heuristic.
  if (raw <= 0) {
    logger.warn("computeUsableTokens: raw usable ≤ 0, using 50% of context", {
      context: limits.context,
      output: limits.output,
      raw,
    });
    return Math.floor(limits.context * 0.5);
  }

  return raw;
}
