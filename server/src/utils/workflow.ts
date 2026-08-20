import config from "@/config";
import axios from "axios";
import { z } from "zod";
import { credentialHeader } from "@/utils/credential";

export const getWorkflowSettings = async (
  workflowsList: string[],
  orgId: string,
  userContext: any,
) => {
  if (!workflowsList || workflowsList?.length <= 0) {
    return [];
  }
  const { x_access_token: xAccessToken } = userContext;
  const workflowAPi = config.isUsingN8N ? "workflows" : "ap-workflows";

  const options = {
    method: "GET",
    url: `${
      config.webApp.url
    }/api/v1/ips/${workflowAPi}/all?haveAISettings=true&ids=${workflowsList.join(
      ",",
    )}`,
    headers: {
      "content-type": "application/json",
      "x-organization-id": orgId,
      ...credentialHeader(xAccessToken),
    },
  };
  console.log(workflowsList);

  try {
    const { data: apiResponse } = await axios.request(options);
    const workflows = apiResponse?.data || [];

    const settings = workflows
      .map((workflow: any) => {
        const aiSettings = {
          ...(workflow.metadata?.settings?.ai || workflow.settings?.ai || {}),
        };

        if (Object.keys(aiSettings).length === 0) return null;

        const workflowName =
          workflow.displayName || workflow.name || "Untitled Workflow";
        const functionName = `_${workflow.id}_${workflowName
          .trim()
          .replace(/[^a-zA-Z0-9]+/g, "_")}`;

        aiSettings.name = functionName;

        if (aiSettings.function) {
          aiSettings.function.name = functionName;
        }

        return aiSettings;
      })
      .filter(Boolean);

    return settings ?? [];
  } catch (error) {
    console.error("Error fetching workflow settings:", error);
    return [];
  }
};

/**
 * Trigger a workflow execution.
 *
 * @param workflowId - Workflow ID to trigger
 * @param orgId - Organization ID
 * @param method - HTTP method (default: POST)
 * @param data - Data to send with the trigger request
 * @returns Response data from the workflow trigger or error message
 */
export const triggerWorkflowExecution = async (
  workflowId: string,
  orgId: string,
  method: string = "POST",
  data: Record<string, any> = {},
): Promise<any> => {
  try {
    const n8nUrl = `${config.imbracePrivateApi.url}/api/v1/workflows/${workflowId}/trigger`;
    const activepieceUrl = `${config.activepieceURL}/api/v1/webhooks/${workflowId}/sync`;
    const url = config.isUsingN8N ? n8nUrl : activepieceUrl;
    // Prepare request payload
    const payload = { ...data, method };

    const options = {
      method: "POST",
      url,
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": orgId,
      },
      data: payload,
    };

    const response = await axios.request(options);

    return response.data;
  } catch (error) {
    console.error("Error triggering workflow:", error);
    return "can not execute workflow";
  }
};

export const convertJsonSchemaToZod = (schema: any) => {
  if (!schema || !schema.properties) {
    return z.object({});
  }

  const shape: Record<string, any> = {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    const property = prop as any;
    let zodType: any;

    switch (property.type) {
      case "string":
        zodType = z.string();
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
        break;
      case "number":
      case "integer":
        zodType = z.number();
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
        break;
      case "boolean":
        zodType = z.boolean();
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
        break;
      case "array":
        // Handle array with items schema
        if (property.items) {
          const itemType = property.items.type;
          let itemSchema: any;
          switch (itemType) {
            case "string":
              itemSchema = z.string();
              if (property.items.description) {
                itemSchema = itemSchema.describe(property.items.description);
              }
              zodType = z.array(itemSchema);
              break;
            case "number":
            case "integer":
              itemSchema = z.number();
              if (property.items.description) {
                itemSchema = itemSchema.describe(property.items.description);
              }
              zodType = z.array(itemSchema);
              break;
            case "boolean":
              itemSchema = z.boolean();
              if (property.items.description) {
                itemSchema = itemSchema.describe(property.items.description);
              }
              zodType = z.array(itemSchema);
              break;
            case "object":
              zodType = z.array(z.object({}).passthrough());
              break;
            default:
              zodType = z.array(z.any());
          }
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
        } else {
          zodType = z.array(z.any());
          if (property.description) {
            zodType = zodType.describe(property.description);
          }
        }
        break;
      case "object":
        zodType = z.object({}).passthrough();
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
        break;
      default:
        zodType = z.any();
        if (property.description) {
          zodType = zodType.describe(property.description);
        }
    }

    // Make optional if not in required array
    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
};
