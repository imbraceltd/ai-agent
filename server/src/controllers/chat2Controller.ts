import { Request, Response } from "express";
import { ChatInput } from "@/core/agents/types/chat";
import logger from "@/lib/logger";
import { sendWebResponse } from "@/utils/response";
import {
  convertToModelMessages,
  createUIMessageStream,
  stepCountIs,
  streamText,
  tool,
  createUIMessageStreamResponse,
} from "ai";
import { processToolCalls } from "@/lib/utils";
import { getAssistantSettings } from "@/utils/agent";
import { resolveImbraceModel } from "@/providers/imbraceModels";
import {
  convertJsonSchemaToZod,
  getWorkflowSettings,
  triggerWorkflowExecution,
} from "@/utils/workflow";
import z from "zod";

const getWeatherInformation = tool({
  description: "show the weather in a given city to the user",
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.string(), // must define outputSchema
  // no execute function, we want human in the loop
});

const getLocalTime = tool({
  description: "get the local time for a specified location",
  inputSchema: z.object({ location: z.string() }),
  // including execute function -> no confirmation required
  execute: async ({ location }) => {
    console.log(`Getting local time for ${location}`);
    return "10am";
  },
});

export function buildWorkflowTools(
  workflowSettings: any[] | undefined,
  organizationId: string,
): {
  tools: Record<string, any>;
  approvalExecutors: Record<
    string,
    (
      params: any,
    ) => Promise<{ state: "ready" | "error"; result?: any; error?: string }>
  >;
} {
  const tools: Record<string, any> = {};
  const approvalExecutors: Record<
    string,
    (
      params: any,
    ) => Promise<{ state: "ready" | "error"; result?: any; error?: string }>
  > = {};

  if (!workflowSettings || !Array.isArray(workflowSettings)) {
    logger.debug("No workflow settings provided or invalid format");
    return { tools, approvalExecutors };
  }

  for (const setting of workflowSettings) {
    if (!setting.function || !setting.function.name) {
      logger.warn("Workflow setting missing function or name", { setting });
      continue;
    }

    const { name, description, parameters, organization_id } = setting.function;
    const need_approval = setting.function?.need_approval || false;

    try {
      // Convert JSON Schema parameters to Zod schema
      const zodSchema = convertJsonSchemaToZod(parameters || {});

      // Extract workflow ID from function name (format: _<workflowId>_<name>)
      const workflowId = name.split("_")[1];

      if (!workflowId) {
        logger.warn(`Invalid workflow name format: ${name}`, {
          expected: "_<workflowId>_<name>",
        });
        continue;
      }

      // Actual execution function (shared for both with/without approval)
      const executor = async (params: any) => {
        logger.info(`Executing workflow: ${name}`, {
          workflowId,
          params,
          organizationId: organizationId,
        });

        try {
          const result = await triggerWorkflowExecution(
            workflowId,
            organization_id,
            "POST",
            params,
          );

          logger.info(`Workflow executed successfully: ${name}`, { result });
          return {
            state: "ready" as const,
            result,
          };
        } catch (error) {
          logger.error(`Workflow executed failed: ${name}`, { error });
          return {
            state: "error" as const,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      };

      if (need_approval) {
        // CASE 1: Tool requires approval -> NO execute function
        tools[name] = tool({
          description: description || `Execute workflow: ${name}`,
          inputSchema: zodSchema,
          outputSchema: z.string(),
        });

        // Store executor for processToolCalls to call after user confirms
        approvalExecutors[name] = executor;
      } else {
        tools[name] = tool({
          description: description || `Execute workflow: ${name}`,
          inputSchema: zodSchema as any,
          outputSchema: z.string() as any,
          execute: executor,
        });
      }

      logger.debug(`Workflow tool registered: ${name}`, {
        workflowId,
        need_approval,
      });
    } catch (error) {
      logger.error(`Failed to build workflow tool: ${name}`, { error });
    }
  }

  logger.info("Workflow tools built", {
    count: Object.keys(tools).length,
    toolNames: Object.keys(tools),
  });

  return { tools, approvalExecutors };
}

/**
 * Handle streaming chat request (AI SDK compatible)
 * Primary endpoint for sending messages - chat ID comes from request body
 */
export async function handleStreamingChatRequest(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userContext = (req as any).userContext;
    const { id, messages, assistant_id, organization_id } = req.body;

    const agent = await getAssistantSettings(assistant_id, userContext.x_access_token, organization_id ?? userContext?.organization_id);

    logger.info("Agent configured", {
      agent,
    });

    // Resolve the model for this organization
    const { model } = await resolveImbraceModel(
      organization_id,
      userContext.x_access_token,
      agent.model_id,
      agent.provider_id,
    );
    logger.info("Model configured", {
      model,
    });
    // Get workflow settings
    const workflowSettings = await getWorkflowSettings(
      agent.workflow_function_call,
      organization_id,
      userContext,
    );
    logger.info("Workflow settings configured", {
      workflowSettings,
    });

    // Add workflow tools dynamically from workflowSettings
    const { tools: workflowTools, approvalExecutors } = buildWorkflowTools(
      workflowSettings,
      organization_id,
    );
    logger.info("Workflow Tools configured", {
      count: Object.keys(workflowTools).length,
    });

    const allTools = {
      getWeatherInformation,
      getLocalTime,
      ...workflowTools,
    };

    logger.info("All tools configured", {
      count: Object.keys(allTools).length,
      tools: Object.keys(allTools),
    });

    const stream = createUIMessageStream({
      originalMessages: messages,
      execute: async ({ writer }) => {
        // Utility function to handle tools that require human confirmation
        // Checks for confirmation in last message and then runs associated tool
        const processedMessages = await processToolCalls(
          {
            messages,
            writer,
            tools: allTools,
          },
          {
            ...approvalExecutors,
          },
        );

        const result = streamText({
          model: model,
          messages: convertToModelMessages(processedMessages),
          tools: allTools,
          stopWhen: stepCountIs(5),
        });

        writer.merge(
          result.toUIMessageStream({ originalMessages: processedMessages }),
        );
      },
    });
    // Convert UIMessageStream to Web Response using AI SDK helper
    const webResponse = createUIMessageStreamResponse({ stream });
    // Bridge from Web Response to Express Response
    await sendWebResponse(webResponse, res);
  } catch (error) {
    logger.error("Chat streaming controller error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        error:
          error instanceof Error
            ? error.message
            : "Failed to process streaming chat request",
      });
    }
  }
}

export type { ChatInput };
