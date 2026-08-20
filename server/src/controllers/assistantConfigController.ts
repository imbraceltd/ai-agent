/**
 * Assistant config import controller.
 *
 * Persists vibe-code-related overrides directly onto the openai_assistants
 * MongoDB doc at TOP-LEVEL (siblings of `assistant_id`). Complements the
 * chat-ai backend's `PUT /api/assistants/{id}` path, which writes overrides
 * via `metadata.*` deep-merge — this endpoint is for callers who prefer to
 * write top-level fields directly without going through chat-ai's validator.
 *
 * Code in chat-prompt-builder.ts and chat-agent-tools.ts reads top-level
 * first, then falls back to metadata, so both paths are honoured.
 *
 * Built-in assistants are NOT customized via this endpoint — instead, an
 * org forks a built-in by creating a real assistant + UseCase through the
 * marketplace `createCustomUseCaseV2` flow. Both endpoints below reject
 * built-in IDs with 400 to surface that mismatch loudly.
 */

import { Request, Response } from "express";
import { z } from "zod";
import logger from "@/lib/logger";
import { ApiResponse } from "@/types/api";
import { getGenericModel } from "@/database/genericModel";
import { isBuiltinAssistantId } from "@/builtin-agents/registry";
import { DATABOARD_TOOL_KEYS } from "@/tool/databoard";
import { getAssistantSettings } from "@/utils/agent";
import { VIBE_CODE_SKILL_RULES } from "@/core/agents/processor/chat-prompt-builder";

const VIBE_CODE_SKILL_RULES_MAX_LENGTH = 8000;

// Reason: Build the enum dynamically from DATABOARD_TOOL_KEYS so adding a new
// databoard tool automatically extends the validator without a second edit.
const databoardToolKeyEnum = z.enum(
  DATABOARD_TOOL_KEYS as unknown as [string, ...string[]],
);

const DATABOARD_TOOL_DESCRIPTION_MAX_LENGTH = 2000;

const databoardToolOverrideSchema = z.object({
  disabled: z.boolean().optional(),
  replace_with_workflow_id: z.string().min(1).optional(),
  description: z
    .string()
    .max(DATABOARD_TOOL_DESCRIPTION_MAX_LENGTH)
    .optional(),
});

// Nested shape lives under `metadata.vibe_coding.*` so the FE can group all
// vibe-coding controls in one panel. Reserved keys: `enabled`,
// `skill_rules_override`. Any other key must be a known DATABOARD_TOOL_KEY and
// its value must match `databoardToolOverrideSchema`.
const vibeCodingMetadataSchema = z
  .object({
    enabled: z.boolean().nullable().optional(),
    skill_rules_override: z
      .string()
      .max(VIBE_CODE_SKILL_RULES_MAX_LENGTH)
      .nullable()
      .optional(),
  })
  .catchall(databoardToolOverrideSchema.nullable())
  .superRefine((val, ctx) => {
    const reserved = new Set(["enabled", "skill_rules_override"]);
    for (const key of Object.keys(val)) {
      if (reserved.has(key)) continue;
      if (!(DATABOARD_TOOL_KEYS as readonly string[]).includes(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `Unknown databoard tool key: ${key}`,
        });
      }
    }
  });

const metadataPatchSchema = z
  .object({
    core_task_override: z
      .string()
      .max(VIBE_CODE_SKILL_RULES_MAX_LENGTH)
      .nullable()
      .optional(),
    vibe_coding: vibeCodingMetadataSchema.optional(),
  })
  .strict();

const importConfigBodySchema = z
  .object({
    // null on any field => unset (reset to default).
    vibe_code: z.boolean().nullable().optional(),
    vibe_code_skill_rules: z
      .string()
      .max(VIBE_CODE_SKILL_RULES_MAX_LENGTH)
      .nullable()
      .optional(),
    databoard_tool_overrides: z
      .record(databoardToolKeyEnum, databoardToolOverrideSchema)
      .nullable()
      .optional(),
    // New nested shape — preferred for built-in agents.
    metadata: metadataPatchSchema.optional(),
  })
  .strict(); // reject unknown top-level keys

export type ImportConfigBody = z.infer<typeof importConfigBodySchema>;

/**
 * POST /api/assistants/:assistant_id/import-config
 * Upsert top-level vibe-code overrides onto the assistant doc.
 */
export async function importAssistantConfig(
  req: Request,
  res: Response,
): Promise<void> {
  const { assistant_id } = req.params as { assistant_id: string };
  if (!assistant_id) {
    res.status(400).json({
      success: false,
      error: "assistant_id path param is required",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
    return;
  }

  if (isBuiltinAssistantId(assistant_id)) {
    res.status(400).json({
      success: false,
      error:
        "built-in assistants cannot be edited in place — fork via marketplace createCustomUseCaseV2 (template_id = built-in use case id) and customize the resulting assistant instead",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
    return;
  }

  const parsed = importConfigBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: "Invalid body",
      validationErrors: parsed.error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      })),
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const body = parsed.data;
  const $set: Record<string, unknown> = {};
  const $unset: Record<string, "" | true> = {};
  const mergedFields: string[] = [];
  const clearedFields: string[] = [];

  // Walk the nested metadata patch and emit dotted Mongo paths so unrelated
  // metadata keys aren't clobbered by a shallow $set on `metadata`.
  for (const [key, value] of Object.entries(body)) {
    if (key === "metadata") {
      const meta = value as Record<string, unknown> | undefined;
      if (!meta) continue;
      for (const [mk, mv] of Object.entries(meta)) {
        if (mk === "vibe_coding") {
          const vc = mv as Record<string, unknown> | undefined;
          if (!vc) continue;
          for (const [vk, vv] of Object.entries(vc)) {
            const path = `metadata.vibe_coding.${vk}`;
            if (vv === null) {
              $unset[path] = "";
              clearedFields.push(path);
            } else {
              $set[path] = vv;
              mergedFields.push(path);
            }
          }
        } else {
          const path = `metadata.${mk}`;
          if (mv === null) {
            $unset[path] = "";
            clearedFields.push(path);
          } else if (mv !== undefined) {
            $set[path] = mv;
            mergedFields.push(path);
          }
        }
      }
      continue;
    }

    if (value === null) {
      $unset[key] = "";
      clearedFields.push(key);
    } else if (value !== undefined) {
      $set[key] = value;
      mergedFields.push(key);
    }
  }

  if (mergedFields.length === 0 && clearedFields.length === 0) {
    res.status(400).json({
      success: false,
      error: "Body must include at least one whitelist field",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
    return;
  }

  try {
    const collection = getGenericModel("openai_assistants").collection;
    const now = new Date();

    const update: Record<string, unknown> = {
      $set: { ...$set, updated_at: now },
      $setOnInsert: { assistant_id, created_at: now },
    };
    if (Object.keys($unset).length > 0) {
      update["$unset"] = $unset;
    }

    const result = await collection.findOneAndUpdate(
      { assistant_id },
      update,
      { upsert: true, returnDocument: "after" },
    );

    // findOneAndUpdate returns null if upserted on some driver versions; check
    // matched count via a follow-up flag. Safer: re-read.
    const operation =
      result && (result as any).created_at?.getTime() === now.getTime()
        ? "created"
        : "updated";

    logger.info("Assistant import-config applied", {
      assistant_id,
      mergedFields,
      clearedFields,
      operation,
    });

    res.status(200).json({
      success: true,
      data: {
        assistant_id,
        operation,
        merged_fields: mergedFields,
        cleared_fields: clearedFields,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to import assistant config", {
      assistant_id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to import assistant config",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
  }
}

type OverrideSource = "top-level" | "metadata" | "default";
type ToolStatus = "default" | "disabled" | "replaced";

interface ToolStatusEntry {
  name: string;
  status: ToolStatus;
  source?: Exclude<OverrideSource, "default">;
  replace_with_workflow_id?: string;
  description_overridden?: boolean;
  description?: string;
}

interface EffectiveConfig {
  assistant_id: string;
  vibe_code: { enabled: boolean; source: OverrideSource };
  prompt: {
    field: "vibe_code_skill_rules";
    is_overridden: boolean;
    source: OverrideSource;
    current_value: string;
  };
  core_task: {
    is_overridden: boolean;
    source: OverrideSource;
    current_value: string;
  };
  tools: { databoard: ToolStatusEntry[] };
  summary: {
    prompt_overridden: boolean;
    core_task_overridden: boolean;
    tools_overridden_count: number;
  };
}

/**
 * GET /api/assistants/:assistant_id/effective-config
 * Returns the resolved override state for an assistant: which prompt block
 * and which databoard tools currently diverge from defaults, and the source
 * of each override (top-level field vs `metadata.*`). Mirrors the read-side
 * fallback chain implemented in chat-prompt-builder.ts and chat-agent-tools.ts.
 */
export async function getEffectiveConfig(
  req: Request,
  res: Response,
): Promise<void> {
  const { assistant_id } = req.params as { assistant_id: string };
  if (!assistant_id) {
    res.status(400).json({
      success: false,
      error: "assistant_id path param is required",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
    return;
  }

  if (isBuiltinAssistantId(assistant_id)) {
    res.status(400).json({
      success: false,
      error:
        "built-in assistants have no per-org override doc; fetch the base config from /api/assistants/builtin/manifest instead",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
    return;
  }

  try {
    const userContext = (req as any).userContext;
    const xAccessToken = userContext?.x_access_token as string | undefined;
    const assistant = await getAssistantSettings(assistant_id, xAccessToken);

    if (!assistant) {
      res.status(404).json({
        success: false,
        error: "Assistant not found",
        timestamp: new Date().toISOString(),
      } satisfies ApiResponse);
      return;
    }

    const metadata = (assistant as Record<string, unknown>)["metadata"] as
      | Record<string, unknown>
      | undefined;
    const vibeCodingMeta = metadata?.["vibe_coding"] as
      | Record<string, unknown>
      | undefined;

    // ── Vibe-code flag ──
    // Resolution order matches chat-agent-tools.ts / chat-prompt-builder.ts:
    //   metadata.vibe_coding.enabled  →  top-level vibe_code  →  metadata.vibe_code
    const nestedVibe = vibeCodingMeta?.["enabled"] === true;
    const topLevelVibe = (assistant as any).vibe_code === true;
    const metaVibe = metadata?.["vibe_code"] === true;
    const vibeSource: OverrideSource = nestedVibe
      ? "metadata"
      : topLevelVibe
        ? "top-level"
        : metaVibe
          ? "metadata"
          : "default";

    // ── Prompt override ──
    const nestedPrompt = vibeCodingMeta?.["skill_rules_override"];
    const topPrompt = (assistant as any).vibe_code_skill_rules;
    const metaPrompt = metadata?.["vibe_code_skill_rules"];
    let promptSource: OverrideSource;
    let promptValue: string;
    if (typeof nestedPrompt === "string") {
      promptSource = "metadata";
      promptValue = nestedPrompt;
    } else if (typeof topPrompt === "string") {
      promptSource = "top-level";
      promptValue = topPrompt;
    } else if (typeof metaPrompt === "string") {
      promptSource = "metadata";
      promptValue = metaPrompt;
    } else {
      promptSource = "default";
      promptValue = VIBE_CODE_SKILL_RULES;
    }

    // ── Databoard tool overrides ──
    type ToolOverride = {
      disabled?: boolean;
      replace_with_workflow_id?: string;
    };
    // Pull tool entries from `metadata.vibe_coding.*` (filter reserved keys).
    const RESERVED = new Set(["enabled", "skill_rules_override"]);
    const nestedOverrides = vibeCodingMeta
      ? (Object.fromEntries(
          Object.entries(vibeCodingMeta).filter(
            ([k, v]) =>
              !RESERVED.has(k) &&
              v &&
              typeof v === "object" &&
              !Array.isArray(v),
          ),
        ) as Record<string, ToolOverride>)
      : undefined;
    const hasNestedOverrides =
      nestedOverrides && Object.keys(nestedOverrides).length > 0;
    const topOverrides = (assistant as any).databoard_tool_overrides as
      | Record<string, ToolOverride>
      | undefined;
    const metaOverrides = metadata?.["databoard_tool_overrides"] as
      | Record<string, ToolOverride>
      | undefined;
    const effectiveOverrides = hasNestedOverrides
      ? nestedOverrides
      : topOverrides ?? metaOverrides;
    const overridesSource: Exclude<OverrideSource, "default"> | undefined =
      hasNestedOverrides
        ? "metadata"
        : topOverrides
          ? "top-level"
          : metaOverrides
            ? "metadata"
            : undefined;

    const toolStatuses: ToolStatusEntry[] = DATABOARD_TOOL_KEYS.map((name) => {
      const o = effectiveOverrides?.[name] as
        | {
            disabled?: boolean;
            replace_with_workflow_id?: string;
            description?: string;
          }
        | undefined;
      const descOverridden =
        typeof o?.description === "string" && o.description.length > 0;
      const descPart: { description_overridden?: true; description?: string } =
        descOverridden
          ? { description_overridden: true, description: o!.description as string }
          : {};

      if (!o) return { name, status: "default" };
      if (o.replace_with_workflow_id) {
        return {
          name,
          status: "replaced",
          source: overridesSource!,
          replace_with_workflow_id: o.replace_with_workflow_id,
          ...descPart,
        };
      }
      if (o.disabled === true) {
        return {
          name,
          status: "disabled",
          source: overridesSource!,
          ...descPart,
        };
      }
      // status `default` — but description override alone still counts.
      if (descOverridden) {
        return { name, status: "default", source: overridesSource!, ...descPart };
      }
      return { name, status: "default" };
    });

    const toolsOverriddenCount = toolStatuses.filter(
      (t) => t.status !== "default" || t.description_overridden === true,
    ).length;

    // ── Core-task override ──
    const coreTaskOverride = metadata?.["core_task_override"];
    const baseCoreTask = (assistant as any).core_task ?? "";
    const coreTaskOverridden =
      typeof coreTaskOverride === "string" && coreTaskOverride.length > 0;

    const data: EffectiveConfig = {
      assistant_id,
      vibe_code: {
        enabled: nestedVibe || topLevelVibe || metaVibe,
        source: vibeSource,
      },
      prompt: {
        field: "vibe_code_skill_rules",
        is_overridden: promptSource !== "default",
        source: promptSource,
        current_value: promptValue,
      },
      core_task: {
        is_overridden: coreTaskOverridden,
        source: coreTaskOverridden ? "metadata" : "default",
        current_value: coreTaskOverridden
          ? (coreTaskOverride as string)
          : baseCoreTask,
      },
      tools: { databoard: toolStatuses },
      summary: {
        prompt_overridden: promptSource !== "default",
        core_task_overridden: coreTaskOverridden,
        tools_overridden_count: toolsOverriddenCount,
      },
    };

    res.status(200).json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to compute effective config", {
      assistant_id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: "Failed to compute effective config",
      timestamp: new Date().toISOString(),
    } satisfies ApiResponse);
  }
}
