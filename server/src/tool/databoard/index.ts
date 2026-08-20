/**
 * Databoard native tool factory.
 *
 * Exposes the board CRUD actions plus board_item CRUD as native AI SDK tools
 * so the Databoard-Engineer sub-agent can manage both schema and data without
 * an MCP round-trip.
 */

import type { Tool, ToolSet } from "ai";

import logger from "@/lib/logger";

import { createBoard } from "./create-board";
import { updateBoardSchema } from "./update-board-schema";
import { getBoard } from "./get-board";
import { getBoardDetails } from "./get-board-details";
import { deleteBoard } from "./delete-board";
import { getBoardItems } from "./get-board-items";
import { getBoardItem } from "./get-board-item";
import { createBoardItem } from "./create-board-item";
import { createBoardItems } from "./create-board-items";
import { updateBoardItem } from "./update-board-item";
import { deleteBoardItem } from "./delete-board-item";
import { listDataboardSkills, readDataboardSkill } from "./skills-tool";
import { buildGetBoardRdf } from "./get-board-rdf";
import { buildQueryBoardData } from "./query-board-data";

/**
 * Wrap a tool with `needsApproval: true` so the AI SDK pauses on the call
 * and emits a tool-approval-request part — the client renders an approval
 * UI and must respond via addToolApprovalResponse before execute runs.
 */
const withApproval = <T extends Tool<any, any>>(t: T): T =>
  ({ ...t, needsApproval: true }) as T;

/**
 * Strip `board_id` from a tool's input schema and inject the scoped value
 * server-side before execute runs. Prevents the model from forging a
 * different board_id and ensures every operation targets the scoped board.
 *
 * Falls back to leaving the schema untouched when it isn't a Zod object
 * (no `.omit`), in which case execute still overwrites `board_id` so the
 * locked id is authoritative regardless of what the model emits.
 */
const lockBoardId = <T extends Tool<any, any>>(t: T, boardId: string): T => {
  const original = t as unknown as {
    inputSchema?: { omit?: (shape: Record<string, true>) => unknown };
    execute?: (input: Record<string, unknown>, ctx: unknown) => unknown;
  };

  const omitFn = original.inputSchema?.omit;
  const lockedSchema =
    typeof omitFn === "function"
      ? omitFn.call(original.inputSchema, { board_id: true })
      : original.inputSchema;

  const wrappedExecute = async (
    input: Record<string, unknown>,
    ctx: unknown,
  ) => {
    if (!original.execute) {
      throw new Error("Cannot lock board_id on a tool without execute()");
    }
    return original.execute({ ...input, board_id: boardId }, ctx);
  };

  return {
    ...(t as object),
    inputSchema: lockedSchema,
    execute: wrappedExecute,
  } as T;
};

/**
 * Build the databoard toolset.
 *
 * @param scopedBoardId - When set, locks every board-scoped tool to this id
 *   (drops `board_id` from inputSchema, hardcodes it in execute) and hides
 *   `create_board` (the user is operating inside a single board).
 */
export function buildDataboardTools(scopedBoardId?: string): ToolSet {
  const lock = scopedBoardId
    ? <T extends Tool<any, any>>(t: T) => lockBoardId(t, scopedBoardId)
    : <T extends Tool<any, any>>(t: T) => t;

  return {
    // Board (schema) operations — write/destructive: require approval.
    // create_board takes no board_id and is hidden when scoped (the user
    // is operating inside an existing board, not creating a new one).
    ...(scopedBoardId
      ? {}
      : { create_board: withApproval(createBoard) }),
    update_board_schema: withApproval(lock(updateBoardSchema)),
    delete_board: withApproval(lock(deleteBoard)),
    // Board (schema) reads — auto-execute.
    // get_board lists ALL boards — useless (and misleading) when scoped to
    // one. Skip it; the model can call get_board_details on the scoped id.
    ...(scopedBoardId ? {} : { get_board: getBoard }),
    get_board_details: lock(getBoardDetails),
    // Board item (row) writes — require approval.
    create_board_item: withApproval(lock(createBoardItem)),
    create_board_items: withApproval(lock(createBoardItems)),
    update_board_item: withApproval(lock(updateBoardItem)),
    delete_board_item: withApproval(lock(deleteBoardItem)),
    // Board item reads — auto-execute.
    get_board_items: lock(getBoardItems),
    get_board_item: lock(getBoardItem),
    // Databoard-specific knowledge guides (field types, naming,
    // TableInTable, MapToBoard, board types, board items) — read-only.
    list_databoard_skills: listDataboardSkills,
    read_databoard_skill: readDataboardSkill,
  };
}

/**
 * Build the two read-only RDF/SPARQL tools that are exposed whenever the
 * assistant has `board_ids` configured.
 *
 * These are deliberately kept OUT of `buildDataboardTools` (and out of
 * `DATABOARD_TOOL_KEYS` / `applyDataboardOverrides`) so they:
 *   - don't depend on the `vibe_code` gate that toggles the CRUD toolset, and
 *   - can't be silently disabled by a `databoard_tool_overrides` map that
 *     was authored before these tools existed.
 *
 * Each tool closes over `boardIds` for an execute-time allow-list check;
 * the model can never query a board the assistant isn't bound to.
 */
export function buildBoardRdfTools(boardIds: string[]): ToolSet {
  if (!boardIds.length) return {};
  return {
    get_board_rdf: buildGetBoardRdf(boardIds),
    query_board_data: buildQueryBoardData(boardIds),
  };
}

export const DATABOARD_TOOL_KEYS = [
  "create_board",
  "update_board_schema",
  "get_board",
  "get_board_details",
  "delete_board",
  "get_board_items",
  "get_board_item",
  "create_board_item",
  "create_board_items",
  "update_board_item",
  "delete_board_item",
  "list_databoard_skills",
  "read_databoard_skill",
] as const;

export type DataboardToolKey = (typeof DATABOARD_TOOL_KEYS)[number];

export interface DataboardToolManifestEntry {
  name: string;
  description: string;
}

/**
 * Returns metadata for every databoard tool so the FE manifest endpoint can
 * render override controls without hardcoding tool names.
 */
export function getDataboardToolManifest(): DataboardToolManifestEntry[] {
  const tools = buildDataboardTools();
  return Object.entries(tools).map(([name, t]) => ({
    name,
    description: ((t as { description?: string }).description ?? "").trim(),
  }));
}

export interface DataboardToolOverride {
  disabled?: boolean;
  replace_with_workflow_id?: string;
  /**
   * Custom description shown to the LLM in place of the tool's built-in one.
   * Lets an org steer when/how the model picks the tool without forking the
   * source. Applied AFTER replace_with_workflow_id so a workflow replacement
   * also gets the org's description.
   */
  description?: string;
}

export type DataboardToolOverrides = Record<string, DataboardToolOverride>;

/**
 * Apply user-supplied overrides to the databoard tool set:
 *   - `disabled: true`  => drop the built-in tool.
 *   - `replace_with_workflow_id` => re-key the matching workflow tool under
 *     the built-in name so prompts/skill guides referencing the built-in name
 *     still resolve. The original workflow entry is removed from
 *     `workflowTools` to prevent the LLM from seeing the same tool twice.
 *
 * `workflowSettings` is walked to map `workflow_id` => `cleanToolName` using
 * the same `_<workflowId>_<sanitized_name>` convention as `buildWorkflowTools`.
 *
 * If a referenced workflow ID is not present in `workflowTools` the override
 * degrades to a plain "disabled" — we never silently leave the built-in in
 * place when the user explicitly asked for a replacement.
 */
export function applyDataboardOverrides(
  databoardTools: ToolSet,
  overrides: DataboardToolOverrides | undefined,
  workflowSettings: unknown[],
  workflowTools: ToolSet,
): ToolSet {
  if (!overrides || Object.keys(overrides).length === 0) {
    return databoardTools;
  }

  const workflowIdToCleanName = new Map<string, string>();
  for (const setting of workflowSettings ?? []) {
    const fnName = (setting as { function?: { name?: string } })?.function
      ?.name;
    if (typeof fnName !== "string" || !fnName.startsWith("_")) continue;
    const parts = fnName.split("_");
    const workflowId = parts[1];
    const cleanToolName = parts.slice(2).join("_");
    if (workflowId && cleanToolName) {
      workflowIdToCleanName.set(workflowId, cleanToolName);
    }
  }

  const result: ToolSet = { ...databoardTools };

  for (const [builtinName, override] of Object.entries(overrides)) {
    if (!(builtinName in result)) {
      logger.warn("databoard override targets unknown built-in tool", {
        builtinName,
      });
      continue;
    }

    if (override.replace_with_workflow_id) {
      const cleanName = workflowIdToCleanName.get(
        override.replace_with_workflow_id,
      );
      const replacement = cleanName ? workflowTools[cleanName] : undefined;
      if (replacement) {
        result[builtinName] = replacement;
        if (cleanName) delete workflowTools[cleanName];
        // fall through so a co-set `description` still applies below.
      } else {
        logger.warn(
          "databoard override workflow not found, falling back to disable",
          {
            builtinName,
            workflowId: override.replace_with_workflow_id,
          },
        );
        delete result[builtinName];
        continue;
      }
    } else if (override.disabled === true) {
      delete result[builtinName];
      continue;
    }

    if (typeof override.description === "string" && override.description.length > 0) {
      const tool = result[builtinName];
      if (tool) {
        result[builtinName] = {
          ...tool,
          description: override.description,
        } as typeof tool;
      }
    }
  }

  return result;
}
