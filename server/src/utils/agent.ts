import config from "@/config";
import {
  getBuiltinAssistantBase,
  isBuiltinAssistantId,
} from "@/builtin-agents/registry";
import { getGenericModel } from "@/database/genericModel";
import logger from "@/lib/logger";
import { credentialHeader } from "@/utils/credential";


/**
 * Fetches assistant settings.
 *
 * Resolution order:
 *   1. If `assistant_id` matches a builtin (prefix `builtin-`), return the
 *      hardcoded base config from the registry. Per-org customization is
 *      handled by forking into a real `openai_assistants` document via the
 *      marketplace `createCustomUseCaseV2` flow, not by overlaying a delta.
 *   2. Otherwise call the Imbrace platform API when xAccessToken is provided.
 *   3. Fallback to the local `openai_assistants` MongoDB collection.
 *
 * @param assistant_id - The assistant ID to look up
 * @param xAccessToken - Platform access token (optional; falls back to MongoDB when absent)
 * @returns Assistant settings object, or null when not found
 */
export const getAssistantSettings = async (
  assistant_id: string,
  xAccessToken?: string,
  organizationId?: string,
): Promise<any> => {
  if (isBuiltinAssistantId(assistant_id)) {
    // Built-in agents are served verbatim from the registry. Per-org
    // customization is done by FORKING into a regular `openai_assistants`
    // doc (via marketplace `createCustomUseCaseV2`) and editing the fork —
    // the override metadata stored on the built-in doc itself is only used
    // by the UI to show defaults and is intentionally NOT applied here.
    return getBuiltinAssistantBase(assistant_id);
  }

  if (xAccessToken) {
    try {
      const baseUrl = config.appGateway.url || config.webApp.url;
      // app-gateway routes /ai/v3 through authRouter → authorize. For JWT
      // tokens we must send `Authorization: Bearer …` together with
      // `x-organization-id` so app-gateway picks the JWT path; otherwise it
      // falls through to the access-token branch which calls backend
      // /v1/account and rejects exchange-issued credentials. acc_* tokens
      // skip the orgId-in-URL trick here because /ai/v3/assistants/:id has
      // its path locked, so we just send the access token header — that is
      // enough since the backend it forwards to validates acc_* directly.
      const isJwt = xAccessToken.startsWith("eyJ");
      const url = `${baseUrl}/ai/v3/assistants/${encodeURIComponent(assistant_id)}`;
      const headers: Record<string, string> = {
        ...credentialHeader(xAccessToken),
        Accept: "application/json",
        "Content-Type": "application/json",
      };
      if (isJwt) {
        headers["Authorization"] = `Bearer ${xAccessToken}`;
        if (organizationId) headers["x-organization-id"] = organizationId;
      } else if (organizationId) {
        headers["x-organization-id"] = organizationId;
      }
      const resp = await fetch(url, {
        headers,
        method: "GET",
      });

      if (!resp.ok) {
        throw new Error(`Failed to fetch assistant settings: ${resp.status}`);
      }

      return await resp.json();
    } catch (err) {
      logger.error(
        "Failed to fetch assistant from API, falling back to MongoDB",
        {
          assistant_id,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }
};

export const generateAiAsistantsPrompt = (assistant: any): string => {
  const {
    personality_role = "",
    core_task: rawCoreTask = "",
    tone_and_style = "",
    response_length = "",
    banned_words = "",
    other_requirements = [],
    metadata,
  } = assistant;

  // metadata.core_task_override wins over the base `core_task` when set to a
  // non-empty string. Lets built-in agents be retuned per-org without forking.
  const overrideCoreTask = (metadata as Record<string, unknown> | undefined)?.[
    "core_task_override"
  ];
  const core_task =
    typeof overrideCoreTask === "string" && overrideCoreTask.length > 0
      ? overrideCoreTask
      : rawCoreTask;

  let instructions =
    "Please strictly follow the following settings for the AI Assistant:";

  if (personality_role) {
    instructions += `\n- Personality and Role: ${personality_role} \n`;
  }
  if (core_task) {
    instructions += `\n- Core Task: ${core_task} \n`;
  }
  if (tone_and_style) {
    instructions += `\n- Tone and Style: ${tone_and_style} \n`;
  }
  if (response_length) {
    instructions += `\n- Response Length: ${response_length} \n`;
  }
  if (banned_words) {
    instructions += `\n- Banned Words: ${banned_words} \n`;
  }
  if (other_requirements && other_requirements.length > 0) {
    instructions += "\n- Other Requirements: \n";
    other_requirements.forEach((item: any, idx: number) => {
      const requirement =
        typeof item === "object" && item !== null
          ? item.requirement
          : String(item);
      instructions += `${idx + 1}. ${requirement} \n`;
    });
  }

  return instructions;
};
