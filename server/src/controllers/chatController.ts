import { Request, Response } from "express";
import { streamChatReplyV2 } from "@/services/chatService";
import { ChatInput } from "@/core/agents/types/chat";
import logger from "@/lib/logger";
import { sendWebResponse } from "@/utils/response";
import {
  getChatsByUserId,
  getChatById,
  deleteChatById,
  getMessagesByChatId,
} from "@/database/queries";
import { generateAiAsistantsPrompt, getAssistantSettings } from "@/utils/agent";
import { streamText } from "ai";
import { createOllama } from "ollama-ai-provider-v2";
import config from "@/config";
import axios from "axios";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createConfiguredOpenAI } from "@/utils/openaiClient";
import { parseJsonFromText } from "@/utils/parseHelpers";

export async function handleGetAllChats(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { organization_id, user_id, limit } = req.query;

    // Validate required fields
    if (!organization_id) {
      res.status(400).json({ error: "organization_id is required" });
      return;
    }

    const chats = await getChatsByUserId({
      organizationId: organization_id as string,
      userId: user_id as string | undefined,
      limit: limit ? parseInt(limit as string) : 50,
    });

    res.status(200).json({ chats, count: chats.length });
  } catch (error) {
    logger.error("Get all chats error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch chats",
    });
  }
}

/**
 * Get a specific chat by ID
 * GET /api/chat/:id
 */
export async function handleGetChatById(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = req.params["id"];
    const { include_messages } = req.query;

    if (!id) {
      res.status(400).json({ error: "Chat ID is required" });
      return;
    }

    const chat = await getChatById({ id });

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    // Optionally include messages
    if (include_messages === "true") {
      const messages = await getMessagesByChatId({ id });
      res.status(200).json({ chat, messages });
    } else {
      res.status(200).json({ chat });
    }
  } catch (error) {
    logger.error("Get chat by ID error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch chat",
    });
  }
}

/**
 * Delete a chat by ID
 * DELETE /api/chat/:id
 */
export async function handleDeleteChat(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const id = req.params["id"];
    const { organization_id, user_id } = req.query;

    if (!id) {
      res.status(400).json({ error: "Chat ID is required" });
      return;
    }

    if (!organization_id) {
      res.status(400).json({ error: "organization_id is required" });
      return;
    }

    // Verify chat exists and user has permission
    const chat = await getChatById({ id });

    if (!chat) {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    // Check authorization
    if (chat.organizationId !== organization_id) {
      res
        .status(403)
        .json({ error: "Forbidden: You don't have access to this chat" });
      return;
    }

    if (user_id && chat.userId !== user_id) {
      res
        .status(403)
        .json({ error: "Forbidden: You don't have access to this chat" });
      return;
    }

    // Delete the chat
    const deletedChat = await deleteChatById({ id });

    res.status(200).json({
      message: "Chat deleted successfully",
      chat: deletedChat,
    });
  } catch (error) {
    logger.error("Delete chat error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete chat",
    });
  }
}

export async function handleChatV2(req: Request, res: Response): Promise<void> {
  try {
    const userContext = (req as any).userContext;
    const {
      id,
      messages,
      assistant_id,
      user_id,
      userId,
      is_tool_approval,
      board_id,
      model_id,
      provider_id,
    } = req.body;
    const fromConnector = req.body?.["from-connector"] === true;
    const organizationId = userContext?.x_org_id as string;
    const chatClientUser = (req as any).chatClientUser as
      | { id: string; email: string }
      | undefined;

    logger.info("Chat streaming v2 request received", {
      id,
      organization_id: organizationId,
      messages,
      assistant_id,
      is_tool_approval: !!is_tool_approval,
      ...(model_id ? { override_model_id: model_id } : {}),
      ...(provider_id ? { override_provider_id: provider_id } : {}),
    });

    // Validate required fields
    if (!id) {
      res.status(400).json({ error: "Chat ID is required in request body" });
      return;
    }

    if (!assistant_id) {
      res.status(400).json({
        error: "Missing required field assistant_id",
      });
      return;
    }

    const chatInput: ChatInput = {
      id,
      messages,
      organizationId,
      assistant_id,
      // Reason: prefer the verified PostgreSQL UUID from chatClientAuth over the
      // body-supplied user_id. The body carries whatever id the client cached
      // (e.g. the Imbrace platform `u_<uuid>` or a stale UUID from a previous
      // deploy), which does not match the `User` row this request resolves to —
      // inserting Chat.userId with it violates the Chat_userId_User_id_fk FK.
      // chatClientUser.id is the real UUID created/looked up in chatClientAuth.
      // Body values (camelCase then snake_case) are last-ditch fallbacks.
      userId: chatClientUser?.id ?? userId ?? user_id,
      isToolApproval: !!is_tool_approval,
      ...(typeof board_id === "string" && board_id.trim().length > 0
        ? { boardId: board_id.trim() }
        : {}),
      ...(typeof model_id === "string" && model_id.trim().length > 0
        ? { modelId: model_id.trim() }
        : {}),
      ...(typeof provider_id === "string" && provider_id.trim().length > 0
        ? { providerId: provider_id.trim() }
        : {}),
      ...(fromConnector ? { fromConnector: true } : {}),
    };
    // Get the Response with UI Message Stream from service
    const streamResponse = await streamChatReplyV2(chatInput, userContext);

    await sendWebResponse(streamResponse, res);
  } catch (error) {
    logger.error("Bedrock real-time streaming chat endpoint error:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Get agent prompt suggestions based on assistant configuration
 * GET /api/chat/get-agent-prompt-suggestion?assistant_id=xxx
 * @param req - Express request with assistant_id in query params
 * @param res - Express response with list of suggestion prompts
 */
export async function handleGetAgentPromptSuggestion(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { assistant_id } = req.query;

    if (!assistant_id || typeof assistant_id !== "string") {
      res.status(400).json({ error: "assistant_id is required" });
      return;
    }

    const userContext = (req as any).userContext;
    const assistant = await getAssistantSettings(
      assistant_id,
      userContext?.x_access_token,
      userContext?.organization_id,
    );

    if (!assistant) {
      res.status(404).json({ error: "Assistant not found" });
      return;
    }

    const assistantPrompt = generateAiAsistantsPrompt(assistant);

    const {
      modelId: suggestionModelId,
      providerUrl: suggestionProviderUrl,
      providerType,
    } = config.suggestion;

    const systemPrompt = `You are a helpful assistant that generates conversation starter suggestions based on an AI assistant's configuration.
Given the following AI assistant settings, generate 6 short and relevant prompt suggestions that users might want to ask this assistant.
Each suggestion should be concise (under 50 characters if possible) and directly related to the assistant's capabilities.
Return ONLY a JSON array of strings, no other text. Example: ["How can I help you?", "Tell me about...", "What is...", "Help me with..."]

RULES:
- If the configuration contains a <suggestion question> tag, extract those questions and use them directly (or refine them to be clear and concise).
- If <suggestion question> tag exists, prioritize those predefined questions over generating new ones.
- Must return 6 suggestions even if configuration is missing/empty.
- Never return an empty list.
- If configuration is missing, use generic helpful prompts.`;

    const userPrompt = `Generate 4 prompt suggestions for an AI assistant with these settings:\n\n${assistantPrompt}`;

    // Reason: For vLLM with thinking models (e.g. qwen3.5), we call the API
    // directly to pass chat_template_kwargs.enable_thinking=false, which reduces
    // response time from ~1-2 minutes to ~2-3 seconds.
    if (providerType === "vllm" && suggestionModelId && suggestionProviderUrl) {
      logger.info(
        `Using suggestion model (direct vLLM): ${suggestionModelId} at ${suggestionProviderUrl}`,
      );

      const vllmResponse = await axios.post(
        `${suggestionProviderUrl}/chat/completions`,
        {
          model: suggestionModelId,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 500,
          chat_template_kwargs: { enable_thinking: false },
        },
        { timeout: 30000 },
      );

      const content = vllmResponse.data?.choices?.[0]?.message?.content || "";
      const parsed = parseJsonFromText(content);
      let suggestions: string[] = Array.isArray(parsed)
        ? parsed.filter(
            (item: unknown): item is string => typeof item === "string",
          )
        : [];
      if (suggestions.length === 0) {
        logger.warn("Failed to parse vLLM suggestions, using fallback", {
          rawText: content,
        });
        suggestions = [
          "How can I help you today?",
          "What would you like to know?",
          "Ask me anything",
          "Let's get started",
        ];
      }

      res.status(200).json({ success: true, data: suggestions });
      return;
    }

    // Fallback: use ai-sdk for ollama/openai providers
    let model;
    if (suggestionModelId && suggestionProviderUrl) {
      if (providerType === "ollama") {
        const ollama = createOllama({
          baseURL: suggestionProviderUrl.endsWith("/api")
            ? suggestionProviderUrl
            : `${suggestionProviderUrl}/api`,
        });
        model = ollama(suggestionModelId);
      } else {
        const provider = createOpenAICompatible({
          name: "openai-compatible",
          baseURL: suggestionProviderUrl,
          apiKey: config.openai.apiKey,
        });
        model = provider(suggestionModelId);
      }
      logger.info(
        `Using suggestion model: ${suggestionModelId} (${providerType}) at ${suggestionProviderUrl}`,
      );
    } else {
      const openai = createConfiguredOpenAI();
      model = openai("gpt-4o-mini");
    }

    const result = streamText({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    let fullText = "";
    for await (const chunk of result.textStream) {
      fullText += chunk;
    }

    let suggestions: string[] = [];
    try {
      let jsonText = fullText.trim();
      if (jsonText.startsWith("```")) {
        jsonText = jsonText
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        suggestions = parsed.filter(
          (item: unknown): item is string => typeof item === "string",
        );
      }
    } catch {
      logger.warn("Failed to parse suggestions, using fallback", {
        rawText: fullText,
      });
      suggestions = [
        "How can I help you today?",
        "What would you like to know?",
        "Ask me anything",
        "Let's get started",
      ];
    }

    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    logger.error("Get agent prompt suggestion error:", error);
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to get prompt suggestions",
    });
  }
}

export type { ChatInput } from "@/core/agents/types/chat";
