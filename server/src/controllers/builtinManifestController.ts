/**
 * Built-in manifest controller.
 *
 * Exposes the hardcoded prompt blocks and built-in tool sets the FE (separate
 * repo) needs to render override controls on a normal assistant document. The
 * FE caches this once per session because the content is effectively static
 * per deploy.
 *
 * Note: built-in *assistants* (e.g. `builtin-databoard-agent`) are no longer
 * surfaced through this endpoint — the marketplace service owns the templates
 * list and exposes `GET /v1/use-cases/builtin-assistants/:assistant_id` for
 * the FE edit modal.
 */

import { Request, Response } from "express";
import logger from "@/lib/logger";
import { ApiResponse } from "@/types/api";
import { VIBE_CODE_SKILL_RULES } from "@/core/agents/processor/chat-prompt-builder";
import {
  DATABOARD_TOOL_KEYS,
  getDataboardToolManifest,
} from "@/tool/databoard";

const VIBE_CODE_SKILL_RULES_MAX_LENGTH = 8000;

interface BuiltinManifest {
  prompts: {
    vibe_code_skill_rules: {
      field: string;
      default: string;
      description: string;
      max_length: number;
    };
  };
  builtin_tools: {
    databoard: ReturnType<typeof getDataboardToolManifest>;
  };
  override_schema: {
    databoard_tool_overrides: {
      field: string;
      shape: string;
      valid_tool_names: readonly string[];
    };
    metadata: {
      shape: string;
      reserved_keys: readonly string[];
      tool_keys: readonly string[];
    };
  };
}

/**
 * GET /api/assistants/builtin/manifest
 * Returns metadata about every hardcoded built-in prompt and tool that a user
 * can override on their assistant document.
 */
export function getBuiltinManifest(req: Request, res: Response): void {
  try {
    const data: BuiltinManifest = {
      prompts: {
        vibe_code_skill_rules: {
          field: "vibe_code_skill_rules",
          default: VIBE_CODE_SKILL_RULES,
          description:
            "Skill-discovery rules injected when vibe_code is enabled.",
          max_length: VIBE_CODE_SKILL_RULES_MAX_LENGTH,
        },
      },
      builtin_tools: {
        databoard: getDataboardToolManifest(),
      },
      override_schema: {
        databoard_tool_overrides: {
          field: "databoard_tool_overrides",
          shape: "Record<toolName, { disabled?: boolean, replace_with_workflow_id?: string, description?: string }>",
          valid_tool_names: DATABOARD_TOOL_KEYS,
        },
        metadata: {
          shape:
            "{ core_task_override?: string, vibe_coding?: { enabled?: boolean, skill_rules_override?: string, [tool_name]: { disabled?: boolean, replace_with_workflow_id?: string, description?: string } } }",
          reserved_keys: ["enabled", "skill_rules_override"],
          tool_keys: DATABOARD_TOOL_KEYS,
        },
      },
    };

    // Reason: manifest content changes only on deploy; let the FE cache for 5
    // minutes to avoid hammering the endpoint on every page load.
    res.setHeader("Cache-Control", "private, max-age=300");

    const response: ApiResponse<BuiltinManifest> = {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error("Failed to build manifest", {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: "Failed to build built-in manifest",
      timestamp: new Date().toISOString(),
    };
    res.status(500).json(errorResponse);
  }
}
