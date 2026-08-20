/**
 * Chat Agent Tools Builder
 * Creates the complete tool set for the chat agent, including workflow tools,
 * MCP tools, DuckDB tools, and document tools.
 * Extracted from chat-processor.ts for modularity.
 */

import { ToolSet } from "ai";
import logger from "@/lib/logger";
import { getWorkflowSettings } from "@/utils/workflow";
import { buildWorkflowTools } from "@/tool/workflow-tool";
import ragTool from "@/tool/rag-tool";
import echartTool from "@/tool/echart-tool";
import folderContentsTool from "@/tool/folder-contents-tool";
import { getDuckDBTools, closeDuckDBClient } from "@/tool/duckdb-tool";
import { createDocument } from "@/tool/create-document";
import { updateDocument } from "@/tool/update-document";
import { loadMcpTools, McpToolServerConfig } from "@/services/mcpService";
import { todoRead, todoWrite, cleanupTodoStore } from "@/tool/todo-tool";
import {
  applyDataboardOverrides,
  buildBoardRdfTools,
  buildDataboardTools,
  type DataboardToolOverrides,
} from "@/tool/databoard";
import type { ChatContext, AgentToolsConfig } from "../types/chat";

/**
 * Create all available tools for the chat agent.
 *
 * @param assistant - Assistant configuration
 * @param context - Chat context
 * @param writer - Stream writer for document tools
 * @param model - AI model instance
 * @returns Tools configuration with cleanup function
 */
export async function createChatAgentTools(
  assistant: Record<string, unknown>,
  context: ChatContext,
  writer: any,
  model: unknown,
): Promise<AgentToolsConfig> {
  const { organizationId, xAccessToken, sessionID, userId } = context;

  // Get workflow settings and build workflow tools
  const workflowSettings = await getWorkflowSettings(
    assistant["workflow_function_call"] as string[],
    organizationId,
    { x_access_token: xAccessToken },
  );

  const boardIds = assistant["board_ids"] as string[] | undefined;

  const workflowTools = buildWorkflowTools(
    workflowSettings,
    organizationId,
    sessionID,
    Array.isArray(boardIds) ? boardIds : undefined,
  );
  logger.info("Workflow Tools configured", {
    count: Object.keys(workflowTools).length,
  });

  // Load MCP tools
  const assistantId = (assistant["id"] || assistant["assistant_id"]) as string;
  const metadata = assistant["metadata"] as Record<string, unknown> | undefined;
  const toolServer = metadata?.["tool_server"] as
    | McpToolServerConfig
    | undefined;
  const { tools: mcpTools, client: mcpClient } = await loadMcpTools(
    assistantId,
    toolServer,
  );

  // Load DuckDB tools
  const duckdbTools = await getDuckDBTools();

  // Check if echart is enabled in assistant metadata
  const enableEchart = (metadata?.["enable_echart"] as boolean) === true;

  // Check if todo tools are enabled in assistant metadata
  const enableTodo = (metadata?.["enable_todo"] as boolean) === true;

  // vibe_coding toggles the Databoard-Engineer tool set.
  // New nested `metadata.vibe_coding.enabled` wins over legacy flags.
  const vibeCodingMeta = metadata?.["vibe_coding"] as
    | Record<string, unknown>
    | undefined;
  const vibeCoding =
    vibeCodingMeta?.["enabled"] === true ||
    assistant["vibe_code"] === true ||
    metadata?.["vibe_code"] === true;
  const enableDataboardTools = vibeCoding;

  const folderIds = assistant["folder_ids"] as string[] | undefined;
  const hasFolderIds = Array.isArray(folderIds) && folderIds.length > 0;

  // Resolve databoard tools first because applyDataboardOverrides may mutate
  // workflowTools (deleting workflow entries that have been re-keyed under a
  // built-in name) — must run before workflowTools is spread into baseTools.
  //
  // Two layers compose here:
  //   1. `buildDataboardTools(context.boardId)` applies the Human-in-Loop
  //      scope: when context.boardId is set (URL ?databoardId=…), it hides
  //      create_board / get_board and locks every other tool's `board_id` to
  //      that value. Tools are also wrapped with needsApproval=true.
  //   2. `applyDataboardOverrides` then disables or replaces any of the
  //      remaining tools per the user's override map. Overrides targeting a
  //      tool that's been hidden by step 1 are no-ops (warning logged).
  //
  // Override read order — top-level first, then metadata.* fallback. The
  // chat-ai PUT /api/assistants/{id} validator strips unknown top-level
  // fields but deep-merges metadata, so the FE persists via metadata.
  // Resolution order:
  //   1. `metadata.vibe_coding.<tool_name>` — new nested shape, one entry per
  //      tool key (DATABOARD_TOOL_KEYS). Reserved keys `enabled` and
  //      `skill_rules_override` are filtered out.
  //   2. top-level `databoard_tool_overrides` (legacy flat record).
  //   3. `metadata.databoard_tool_overrides` (older legacy fallback).
  const VIBE_CODING_RESERVED = new Set(["enabled", "skill_rules_override"]);
  const nestedVibeOverrides = vibeCodingMeta
    ? Object.fromEntries(
        Object.entries(vibeCodingMeta).filter(
          ([k, v]) =>
            !VIBE_CODING_RESERVED.has(k) &&
            v &&
            typeof v === "object" &&
            !Array.isArray(v),
        ),
      )
    : undefined;
  const hasNestedOverrides =
    nestedVibeOverrides && Object.keys(nestedVibeOverrides).length > 0;
  const databoardOverrides = (
    hasNestedOverrides
      ? nestedVibeOverrides
      : (assistant["databoard_tool_overrides"] ??
        metadata?.["databoard_tool_overrides"])
  ) as DataboardToolOverrides | undefined;
  const databoardTools: ToolSet = enableDataboardTools
    ? applyDataboardOverrides(
        buildDataboardTools(context.boardId),
        databoardOverrides,
        workflowSettings,
        workflowTools,
      )
    : {};

  // Read-only RDF/SPARQL tools — gated purely on `board_ids`, independent of
  // `vibe_code`. Allow-list is closed over inside each tool, so the model
  // cannot probe boards outside the assistant's binding even if it forges a
  // board_id argument.
  const boardRdfTools: ToolSet =
    Array.isArray(boardIds) && boardIds.length > 0
      ? buildBoardRdfTools(boardIds)
      : {};

  // Create base tools (conditionally include echart and todo tools)
  const baseTools: ToolSet = {
    RAGknowledge: ragTool,
    ...(enableEchart ? { Echart: echartTool } : {}),
    ...(enableTodo ? { todoRead, todoWrite } : {}),
    ...(hasFolderIds ? { folderContentsTool } : {}),
    ...duckdbTools,
    createDocument: createDocument({
      userId,
      dataStream: writer,
      model,
      chatId: sessionID,
    }),
    updateDocument: updateDocument({
      userId,
      dataStream: writer,
      model,
      chatId: sessionID,
    }),
    ...workflowTools,
    ...mcpTools,
    ...databoardTools,
    // Placed AFTER databoardTools so an override accidentally re-keyed under
    // these names cannot mask the read-only RDF/SPARQL tools.
    ...boardRdfTools,
  };

  // Cleanup function for resource management
  const cleanup = async () => {
    try {
      closeDuckDBClient();
      if (enableTodo) {
        await cleanupTodoStore(sessionID);
      }
      if (mcpClient) {
        await mcpClient.close();
      }
    } catch (error) {
      logger.error("Error during tools cleanup", { error });
    }
  };

  return {
    allTools: baseTools,
    mcpClient,
    cleanup,
  };
}
