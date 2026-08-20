import { dynamicTool, tool } from "ai";
import { convertJsonSchemaToZod, triggerWorkflowExecution } from "@/utils/workflow";
import logger from "@/lib/logger";
import { z } from "zod";

/**
 * Build workflow-based tools from workflow settings using AI SDK tool() format
 *
 * This function dynamically creates tools from workflow configurations, allowing
 * workflows to be invoked as AI agent tools with proper approval flows.
 *
 * @param workflowSettings - Array of workflow settings from the database
 * @param organizationId - Organization ID for workflow execution context
 * @param chatId - Chat/conversation ID to be passed as thread_id to workflows
 * @returns Record of workflow tools ready to be used by the agent
 */

export function buildWorkflowTools(
  workflowSettings: any[] | undefined,
  organizationId: string,
  id: string,
  boardIds?: string[]
): Record<string, any> {
  const builtTools: Record<string, any> = {};

  if (!workflowSettings || !Array.isArray(workflowSettings)) {
    logger.debug("No workflow settings provided or invalid format");
    return builtTools;
  }

  for (const setting of workflowSettings) {
    if (!setting.function || !setting.function.name) {
      logger.warn("Workflow setting missing function or name", { setting });
      continue;
    }

    const { name, description, parameters, organization_id } = setting.function;
    try {
      // Convert JSON Schema parameters to Zod schema
      const baseSchema = convertJsonSchemaToZod(parameters || {});

      // Add tool_title and chat_id fields to the schema
      const zodSchema = z.object({
        tool_title: z
          .string()
          .optional()
          .describe("User-facing title explaining what you are doing with this workflow can do"),
        chat_id: z
          .string()
          .describe(
            "The chat_id for this conversation. MUST use the exact chat_id value provided in the CHAT CONTEXT section of your system prompt. Do NOT generate or guess this value."
          )
          .default(id),
        board_ids: z
          .array(z.string())
          .optional()
          .describe(
            "The board_ids for this conversation. MUST use the exact board_ids value provided in the BOARD CONTEXT section of your system prompt. Do NOT generate or guess this value."
          )
          .default(boardIds ?? []),
        ...baseSchema.shape,
      });

      // Extract workflow ID from function name (format: _<workflowId>_<name>)
      const nameParts = name.split("_");
      const workflowId = nameParts[1];

      if (!workflowId) {
        logger.warn(`Invalid workflow name format: ${name}`, {
          expected: "_<workflowId>_<name>",
        });
        continue;
      }

      // Extract clean tool name without the ID prefix
      // Format: _<workflowId>_<name> -> <name>
      const cleanToolName = nameParts.slice(2).join("_");

      // Create tool using AI SDK tool() function (consistent with default-tool.ts)
      builtTools[cleanToolName] = tool({
        description: description || `Execute workflow: ${cleanToolName}`,
        inputSchema: zodSchema,
        execute: async (params: any) => {
          // Inject chat_id server-side so the AI model cannot override it
          const paramsWithChatId = {
            ...params,
            chat_id: id,
            ...(boardIds && boardIds.length > 0 ? { board_ids: boardIds } : {}),
          };

          logger.info(`Executing workflow: ${cleanToolName}`, {
            workflowId,
            params: paramsWithChatId,
            organizationId: organizationId,
          });

          try {
            // Trigger the actual workflow execution
            const result = await triggerWorkflowExecution(
              workflowId,
              organization_id,
              "POST",
              paramsWithChatId
            );

            return result;
          } catch (error) {
            logger.error(`Workflow execution failed: ${cleanToolName}`, {
              error,
            });
            // Return structured error instead of throwing to prevent stream crash
            return {
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
              workflowId,
            };
          }
        },
      });

      logger.debug(`Workflow tool registered: ${cleanToolName}`, {
        workflowId,
        originalName: name,
      });
    } catch (error) {
      logger.error(`Failed to build workflow tool: ${name}`, { error });
    }
  }

  logger.info("Workflow tools built", {
    count: Object.keys(builtTools).length,
    toolNames: Object.keys(builtTools),
  });

  return builtTools;
}

/**
 * Interface for workflow function configuration
 */
export interface WorkflowFunction {
  name: string;
  description?: string;
  parameters?: Record<string, any>;
  organization_id?: string;
}

/**
 * Interface for workflow setting
 */
export interface WorkflowSetting {
  function: WorkflowFunction;
}
