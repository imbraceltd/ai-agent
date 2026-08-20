import { generateAiAsistantsPrompt, getAssistantSettings } from "@/utils/agent";
import { stepCountIs, ToolLoopAgent, UIMessage as SDKUIMessage } from "ai";
import logger from "@/lib/logger";

import {
  ChatContext,
  ChatInput,
  ChatOptions,
  SubAgentAccumulated,
  type SubAgentSessionInfo,
} from "@/core/agents/types/chat";
import { updateChatLastContextById } from "@/database/pgQueries";
import {
  ensureChatExists,
  saveUserMessage,
  saveAssistantMessage,
  saveSubAgentMessages,
  loadMessageHistory,
  loadRelevantMessages,
  convertDbMessagesToUIMessages,
  generateAndSaveTitle,
  getMessageHistoryConfig,
  getContextCompactThreshold,
  findParentChatIdByAssistantId,
  compactMessages,
  type CompactionConfig,
} from "@/services/chatSessionService";
import { Message } from "@/models/client/message";
import { Chat } from "@/models/client/chat";
import { chatStatusEmitter } from "@/lib/chatStatusEmitter";
import {
  getSubAgentSummary,
  invalidateSubAgentSummaryCache,
  summarizeSubAgentChat,
} from "@/services/subAgentSummaryService";
import { processChatStream } from "@/core/agents/processor/chat-processor";
import { processDocumentAiStream } from "@/core/agents/processor/document-ai-processor";
import { getModelLimits, computeUsableTokens } from "@/providers/modelLimits";

/**
 * Prepare the chat session: ensure DB record exists, detect sub-agent status,
 * set processing status, save user message, load history, and load sub-agent summaries.
 * @param chatsInput - Chat input parameters
 * @param assistantTopK - Optional top_k value from assistant config (metadata.top_k).
 *                        Used to control how many recent messages are loaded from the DB.
 * @param assistantStrategy - Optional history strategy from assistant config (metadata.history_strategy).
 *                            Overrides the CHAT_HISTORY_STRATEGY env var when set.
 * @returns Prepared session state for stream orchestration
 */
/**
 * Build compaction config overrides from assistant metadata.
 * Returns partial config with only the keys that are explicitly set.
 */
function buildCompactionConfig(
  assistantMetadata?: Record<string, unknown>,
): Partial<CompactionConfig> {
  if (!assistantMetadata) return {};
  const cfg: Partial<CompactionConfig> = {};
  if (typeof assistantMetadata["compaction_tool_threshold"] === "number") {
    cfg.toolResultCompressionThreshold = assistantMetadata[
      "compaction_tool_threshold"
    ] as number;
  }
  if (typeof assistantMetadata["compaction_tool_summary_chars"] === "number") {
    cfg.toolResultMaxSummaryChars = assistantMetadata[
      "compaction_tool_summary_chars"
    ] as number;
  }
  if (typeof assistantMetadata["compaction_chunk_size"] === "number") {
    cfg.chunkSize = assistantMetadata["compaction_chunk_size"] as number;
  }
  if (typeof assistantMetadata["compaction_protected_threshold"] === "number") {
    cfg.protectedScoreThreshold = assistantMetadata[
      "compaction_protected_threshold"
    ] as number;
  }
  return cfg;
}

/**
 * Lightweight session prep used when the client submits a tool-approval
 * follow-up (HITL). Skips DB history reload — the FE has already shipped
 * the trailing assistant message containing the APPROVAL.YES/APPROVAL.NO
 * output that processToolCalls needs. We still touch the chat record so
 * status, sub-agent summaries, etc. stay consistent.
 */
async function prepareApprovalSession(chatsInput: ChatInput): Promise<{
  effectiveMessages: typeof chatsInput.messages;
  isNew: boolean;
  isSubAgentChat: boolean;
  chatRecord: Chat.Info | null;
  subAgentSummary: string;
}> {
  const { id } = chatsInput;

  const chatRecord = await Chat.get({ id });
  const isSubAgentChat = chatRecord?.type === "sub-agent";

  try {
    await Chat.updateStatus({ id, status: "processing" });
  } catch (error) {
    logger.error("Failed to set chat status to processing (approval submit)", {
      chatId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  let subAgentSummary = "";
  if (!isSubAgentChat) {
    try {
      subAgentSummary = await getSubAgentSummary(id);
    } catch (error) {
      logger.error("Failed to load sub-agent summary (approval submit)", {
        chatId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    effectiveMessages: chatsInput.messages,
    isNew: false,
    isSubAgentChat,
    chatRecord,
    subAgentSummary,
  };
}

async function prepareChatSession(
  chatsInput: ChatInput,
  assistantTopK?: number,
  assistantStrategy?: "top-k" | "top-k-relevant" | "compact",
  modelContextLimit?: number,
  assistantMetadata?: Record<string, unknown>,
): Promise<{
  effectiveMessages: typeof chatsInput.messages;
  isNew: boolean;
  isSubAgentChat: boolean;
  chatRecord: Chat.Info | null;
  subAgentSummary: string;
}> {
  const { messages, organizationId, id, assistant_id, userId } = chatsInput;

  // ── Step 1: Ensure chat session exists in DB ──────────
  const { isNew } = await ensureChatExists(
    id,
    userId || "",
    assistant_id,
    organizationId,
  );

  // ── Step 1b: Detect if this is a sub-agent chat ──────
  const chatRecord = await Chat.get({ id });
  const isSubAgentChat = chatRecord?.type === "sub-agent";
  if (isSubAgentChat) {
    logger.info("Sub-agent chat detected, will save messages and summarize", {
      chatId: id,
      assistantId: assistant_id,
    });
  }

  // ── Step 2: Set chat status to "processing" ────────────
  try {
    await Chat.updateStatus({ id, status: "processing" });
  } catch (error) {
    logger.error("Failed to set chat status to processing", {
      chatId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Step 3: Save the incoming user message ────────────
  try {
    const { id: savedMsgId } = await saveUserMessage(id, messages);
    logger.info("User message saved to database", {
      chatId: id,
      messageId: savedMsgId,
      isSubAgentChat,
    });
  } catch (error) {
    logger.error("Failed to save user message, continuing with stream", {
      chatId: id,
      isSubAgentChat,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Step 3b: Generate title for new chats (fire-and-forget) ──
  if (isNew) {
    generateAndSaveTitle(id, messages);
  }

  // ── Step 3c: Decide whether to auto-compact context ──
  // Reason: dynamic model limit (from models.dev) takes priority; env var is fallback.
  const compactThreshold = modelContextLimit ?? getContextCompactThreshold();

  const historyConfig = getMessageHistoryConfig(assistantTopK);

  const lastContext =
    (chatRecord?.lastContext as Record<string, unknown>) || {};
  const lastPromptTokens = lastContext["lastPromptTokens"] as
    | number
    | undefined;

  // ── Step 4: Load message history from DB ──────────────
  let effectiveMessages = messages;
  try {
    let dbMessages = await loadMessageHistory(id, historyConfig);

    // Compact directly when last turn exceeded threshold.
    // Reason: compaction is a write operation (saves summary+marker to DB) so it
    // lives here rather than inside loadMessageHistory, which is now a pure read.
    if (lastPromptTokens && lastPromptTokens > compactThreshold) {
      logger.info("Context exceeds compaction threshold, compacting now", {
        chatId: id,
        lastPromptTokens,
        compactThreshold,
      });
      const allMessages = await Message.getByChatId({ chatId: id });
      if (allMessages && allMessages.length > 0) {
        // Reason: Build compaction config from assistant metadata, using defaults when not set
        const compactionConfig = buildCompactionConfig(assistantMetadata);
        dbMessages = await compactMessages(
          allMessages,
          {
            maxTokenEstimate: compactThreshold,
            ...(historyConfig.summaryModel
              ? { summaryModel: historyConfig.summaryModel }
              : {}),
          },
          Object.keys(compactionConfig).length > 0
            ? (compactionConfig as CompactionConfig)
            : undefined,
        );
      }
    } else if (lastPromptTokens) {
      logger.debug("Context within compaction threshold", {
        chatId: id,
        lastPromptTokens,
        compactThreshold,
      });
    }

    // Apply relevance scoring as a post-load filter when configured.
    if (
      assistantStrategy === "top-k-relevant" &&
      historyConfig.topK != null &&
      dbMessages.length > 0
    ) {
      // Extract current user query for scoring (handle both v6 UIMessage
      // shape with `parts` and ModelMessage shape with `content`).
      const lastUserMsg = [...messages]
        .reverse()
        .find((m) => m.role === "user") as Record<string, unknown> | undefined;
      const partsOrContent =
        (Array.isArray(lastUserMsg?.["parts"])
          ? lastUserMsg!["parts"]
          : lastUserMsg?.["content"]) as unknown;
      const currentQuery =
        typeof partsOrContent === "string"
          ? partsOrContent
          : Array.isArray(partsOrContent)
            ? (partsOrContent as Array<{ type: string; text?: string }>)
                .filter((p) => p.type === "text")
                .map((p) => p.text ?? "")
                .join(" ")
            : "";
      if (currentQuery) {
        dbMessages = loadRelevantMessages(
          dbMessages,
          historyConfig.topK,
          currentQuery,
        );
      }
    }

    if (dbMessages.length > 0) {
      effectiveMessages = convertDbMessagesToUIMessages(
        dbMessages,
      ) as unknown as typeof messages;
    }
  } catch (error) {
    logger.error("Failed to load message history, using client messages", {
      chatId: id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // ── Step 5: Load sub-agent summaries for context ─────────
  // Reason: getSubAgentSummary() is only for main chats (type: "chat").
  // Sub-agent chats don't need to collect other sub-agent summaries.
  let subAgentSummary = "";
  if (!isSubAgentChat) {
    try {
      subAgentSummary = await getSubAgentSummary(id);
    } catch (error) {
      logger.error("Failed to load sub-agent summary", {
        chatId: id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    effectiveMessages,
    isNew,
    isSubAgentChat,
    chatRecord,
    subAgentSummary,
  };
}

/**
 * Persist sub-agent session registry and token usage to chat.lastContext.
 * Merges new sessions by assistantId to prevent duplicates.
 */
async function updateSubAgentSessionRegistry(
  chatId: string,
  subAgentAccumulator: Map<string, SubAgentAccumulated>,
  usageCapture: NonNullable<ChatOptions["usageCapture"]>,
): Promise<void> {
  const freshChat = await Chat.get({ id: chatId });
  const existingContext =
    (freshChat?.lastContext as Record<string, unknown>) || {};
  const existingSessions =
    (existingContext["subAgentSessions"] as SubAgentSessionInfo[]) || [];

  const newSessions: SubAgentSessionInfo[] = [];
  for (const [sessionId, agentData] of subAgentAccumulator) {
    newSessions.push({
      sessionId,
      agentName: agentData.agentName,
      assistantId: agentData.assistantId || "",
      createdAt: new Date(agentData.startedAt).toISOString(),
    });
  }

  // Reason: Merge by assistantId instead of blind append to prevent
  // duplicate entries when the same sub-agent is called multiple times.
  const mergedSessions = [...existingSessions];
  for (const newSession of newSessions) {
    const existingIdx = mergedSessions.findIndex(
      (s) => s.assistantId === newSession.assistantId,
    );
    if (existingIdx >= 0) {
      mergedSessions[existingIdx] = newSession;
    } else {
      mergedSessions.push(newSession);
    }
  }

  await updateChatLastContextById({
    chatId,
    context: {
      ...existingContext,
      subAgentSessions: mergedSessions,
      lastPromptTokens:
        usageCapture.inputTokens ?? existingContext["lastPromptTokens"] ?? null,
      lastOutputTokens:
        usageCapture.outputTokens ??
        existingContext["lastOutputTokens"] ??
        null,
      lastTotalTokens:
        usageCapture.totalTokens ?? existingContext["lastTotalTokens"] ?? null,
      lastUsageTimestamp: new Date().toISOString(),
    },
  });
  logger.info("Sub-agent session registry and token usage updated", {
    chatId,
    newCount: newSessions.length,
    totalCount: mergedSessions.length,
    inputTokens: usageCapture.inputTokens,
    outputTokens: usageCapture.outputTokens,
  });
}

/**
 * Handle stream completion: save assistant message, persist sub-agent data,
 * persist token usage, summarize sub-agent chats, and reset status.
 * @param params - All data needed for post-stream persistence
 */
async function handleStreamFinish(params: {
  chatId: string;
  responseMessage: SDKUIMessage;
  isAborted: boolean;
  isContinuation: boolean;
  isSubAgentChat: boolean;
  chatRecord: Chat.Info | null;
  subAgentAccumulator: Map<string, SubAgentAccumulated>;
  usageCapture: NonNullable<ChatOptions["usageCapture"]>;
  errorCapture: NonNullable<ChatOptions["errorCapture"]>;
}): Promise<void> {
  const {
    chatId,
    responseMessage,
    isAborted,
    isContinuation,
    isSubAgentChat,
    chatRecord,
    subAgentAccumulator,
    usageCapture,
    errorCapture,
  } = params;

  // Reason: When the stream surfaced an error mid-flight (e.g. invalid model id,
  // provider auth failure), AI SDK still calls onFinish but responseMessage.parts
  // is empty — saving as-is leaves a blank assistant row. Inject the captured
  // error text so the user sees what went wrong after reload.
  if (errorCapture.errorText) {
    const parts = Array.isArray(responseMessage.parts)
      ? responseMessage.parts
      : [];
    const hasUsefulText = parts.some(
      (p) =>
        (p as Record<string, unknown>)["type"] === "text" &&
        typeof (p as Record<string, unknown>)["text"] === "string" &&
        ((p as Record<string, unknown>)["text"] as string).trim().length > 0,
    );
    if (!hasUsefulText) {
      const mutableMsg = responseMessage as unknown as Record<string, unknown>;
      mutableMsg["parts"] = [
        ...parts,
        { type: "text", text: errorCapture.errorText },
      ];
      // Tag metadata so the FE can render it as an error if it wants to.
      mutableMsg["metadata"] = {
        ...(mutableMsg["metadata"] as Record<string, unknown> | undefined),
        error: true,
        errorText: errorCapture.errorText,
      };
      logger.info("Injected error text into assistant message before save", {
        chatId,
        errorText: errorCapture.errorText,
      });
    }
  }

  // Reason: Always save assistant message, even if stream was aborted (user reload/stop).
  // This ensures the response is persisted and visible after page reload.
  if (isAborted) {
    logger.warn("Stream was aborted, saving partial assistant message", {
      chatId,
    });
  }

  try {
    const { id: savedAsstMsgId } = await saveAssistantMessage(
      chatId,
      responseMessage,
      { isContinuation },
    );
    logger.info("Assistant response saved to database", {
      chatId,
      messageId: savedAsstMsgId,
      isSubAgentChat,
      isContinuation,
    });
  } catch (error) {
    logger.error("Failed to save assistant response", {
      chatId,
      isSubAgentChat,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  // Save sub-agent messages to DB (if any were accumulated)
  if (subAgentAccumulator.size > 0) {
    try {
      await saveSubAgentMessages(chatId, subAgentAccumulator);
      logger.info("Sub-agent messages saved to database", {
        chatId,
        count: subAgentAccumulator.size,
      });

      // Reason: Persist sub-agent session registry to chat.lastContext so the
      // main agent knows which sub-agent sessions can be resumed via task_id.
      // Also persists token usage for next-turn compaction estimation.
      try {
        await updateSubAgentSessionRegistry(
          chatId,
          subAgentAccumulator,
          usageCapture,
        );
      } catch (err) {
        logger.warn("Failed to save sub-agent session registry", {
          chatId,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // Invalidate cached summary and regenerate immediately
      // so the summary is fresh for the next turn without waiting
      try {
        await invalidateSubAgentSummaryCache(chatId);
        await getSubAgentSummary(chatId);
        logger.info("Sub-agent summary regenerated after new sub-agent data", {
          chatId,
        });
      } catch (err) {
        logger.error("Failed to regenerate sub-agent summary", {
          chatId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    } catch (error) {
      logger.error("Failed to save sub-agent messages", {
        chatId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Persist token usage when no sub-agents were used
  // (sub-agent path already includes usage in its consolidated write)
  if (subAgentAccumulator.size === 0 && usageCapture.inputTokens != null) {
    try {
      const freshChat = await Chat.get({ id: chatId });
      const existingContext =
        (freshChat?.lastContext as Record<string, unknown>) || {};

      await updateChatLastContextById({
        chatId,
        context: {
          ...existingContext,
          lastPromptTokens: usageCapture.inputTokens,
          lastOutputTokens: usageCapture.outputTokens ?? null,
          lastTotalTokens: usageCapture.totalTokens ?? null,
          lastUsageTimestamp: new Date().toISOString(),
        },
      });
      logger.info("Token usage persisted to lastContext", {
        chatId,
        inputTokens: usageCapture.inputTokens,
        outputTokens: usageCapture.outputTokens,
      });
    } catch (err) {
      logger.warn("Failed to persist token usage to lastContext", {
        chatId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Reason: When user chats directly with a sub-agent (type: "sub-agent"),
  // summarize the sub-agent's own conversation and cache on its lastContext.
  // The main agent will read this when it runs next.
  if (isSubAgentChat) {
    try {
      await summarizeSubAgentChat(chatId);
      logger.info("Sub-agent chat summarized after direct chat", {
        subAgentChatId: chatId,
      });
      // Reason: Also invalidate main chat's combined summary so it
      // re-collects fresh sub-agent summaries on next turn
      if (chatRecord?.assistantId) {
        const parentChatId = await findParentChatIdByAssistantId(
          chatRecord.assistantId,
        );
        if (parentChatId) {
          await invalidateSubAgentSummaryCache(parentChatId);
        }
      }
    } catch (err) {
      logger.error("Failed to summarize sub-agent chat", {
        chatId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Reason: If the stream hit a context overflow, compact immediately so the
  // next turn loads the compacted history without needing a threshold check.
  if (usageCapture.needsCompaction) {
    try {
      logger.info("Emergency compaction triggered after context overflow", {
        chatId,
      });
      const allMessages = await Message.getByChatId({ chatId });
      if (allMessages && allMessages.length > 0) {
        await compactMessages(allMessages, {
          maxTokenEstimate: getContextCompactThreshold(),
        });
        logger.info("Emergency compaction completed", { chatId });
      }
    } catch (err) {
      logger.error("Emergency compaction failed", {
        chatId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Set chat status back to "idle" and notify SSE listeners
  try {
    await Chat.updateStatus({ id: chatId, status: "idle" });
    chatStatusEmitter.emit(chatId, "idle");
  } catch (error) {
    logger.error("Failed to update chat status to idle", {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Save error as assistant message, reset chat status to idle, and return
 * a JSON error response so the client can render it inline.
 * @param chatId - The chat ID
 * @param errorText - Human-readable error message
 * @returns Response with 500 status and error body
 */
async function handleChatError(
  chatId: string,
  errorText: string,
): Promise<Response> {
  // Save error as assistant message in DB
  try {
    await saveAssistantMessage(chatId, {
      id: `error-${Date.now()}`,
      role: "assistant" as const,
      parts: [{ type: "text" as const, text: errorText }],
    } as any);
    logger.info("Error saved as assistant message", {
      chatId,
      errorText,
    });
  } catch (saveError) {
    logger.error("Failed to save error as assistant message", {
      chatId,
      error: saveError instanceof Error ? saveError.message : String(saveError),
    });
  }

  // Reset chat status to idle
  try {
    await Chat.updateStatus({ id: chatId, status: "idle" });
    chatStatusEmitter.emit(chatId, "idle");
  } catch (statusError) {
    logger.error("Failed to reset chat status after error", {
      chatId,
      error:
        statusError instanceof Error
          ? statusError.message
          : String(statusError),
    });
  }

  // Return JSON error — client onError → router.refresh() will fetch the saved message
  return Response.json({ error: errorText }, { status: 500 });
}

/**
 * Stream a chat reply using AI model with workflow tools (UI Message Stream format) - V2
 * Uses the modular chat-processor pattern similar to subtask-processor.
 * Includes backend session management: auto-creates chats, saves messages,
 * loads history from DB, and generates titles.
 * @param chatsInput - Chat input parameters
 * @param userContext - User context with authentication
 * @returns Response with SSE stream
 */
export async function streamChatReplyV2(
  chatsInput: ChatInput,
  userContext: any,
): Promise<Response> {
  const { organizationId, id, assistant_id, userId } = chatsInput;

  logger.info(`Chat ID ${id}, Messages count: ${chatsInput.messages.length}`);

  // Fetch assistant settings early to read metadata fields for history config
  const fetchedAssistant = await getAssistantSettings(
    assistant_id,
    userContext?.x_access_token,
    userContext?.organization_id,
  );

  // Reason: when the request body carries `model_id` / `provider_id`, override
  // the assistant's stored values for THIS request only. Both fields are
  // resolved together by resolveImbraceModel — overriding only one would mix a
  // model name with the wrong provider's lookup table, so when the caller
  // supplies `modelId` we require `providerId` too (and vice-versa).
  const hasModelOverride = typeof chatsInput.modelId === "string";
  const hasProviderOverride = typeof chatsInput.providerId === "string";
  if (hasModelOverride !== hasProviderOverride) {
    logger.warn("Partial model override ignored — both fields required", {
      assistantId: assistant_id,
      hasModelOverride,
      hasProviderOverride,
    });
  }
  const applyOverride =
    fetchedAssistant && hasModelOverride && hasProviderOverride;
  const assistant = applyOverride
    ? {
        ...(fetchedAssistant as Record<string, unknown>),
        model_id: chatsInput.modelId,
        provider_id: chatsInput.providerId,
      }
    : fetchedAssistant;
  if (applyOverride) {
    logger.info("Applied model/provider override from request payload", {
      assistantId: assistant_id,
      modelId: chatsInput.modelId,
      providerId: chatsInput.providerId,
    });
  }
  const assistantTopK = (assistant?.metadata?.top_k as number) || undefined;
  const assistantHistoryStrategy = assistant?.metadata?.history_strategy as
    | "top-k"
    | "top-k-relevant"
    | "compact"
    | undefined;

  // Resolve dynamic compaction threshold from models.dev (OpenCode pattern).
  // Skip when compaction_auto=false on the assistant.
  const compactionAuto = assistant?.metadata?.compaction_auto !== false;
  const compactionReserved = assistant?.metadata?.compaction_reserved as
    | number
    | undefined;
  let modelContextLimit: number | undefined;
  const isShowThinkingProcess = assistant?.show_thinking_process === true;
  if (compactionAuto && assistant?.model_id) {
    try {
      const limits = await getModelLimits(assistant.model_id as string);
      modelContextLimit = computeUsableTokens(limits, compactionReserved);
      logger.info("Model context threshold resolved", {
        assistantId: assistant_id,
        modelId: assistant.model_id,
        contextWindow: limits.context,
        usableTokens: modelContextLimit,
      });
    } catch (e) {
      logger.warn(
        "Failed to resolve model limits, falling back to env threshold",
        {
          error: e instanceof Error ? e.message : String(e),
        },
      );
    }
  }

  // ── Prepare session: DB record, status, save user msg, load history ──
  // Reason: HITL approval submits carry APPROVAL.YES/APPROVAL.NO embedded in
  // the trailing assistant message. Reloading from DB would clobber that
  // state (DB doesn't know about the approval yet), so processToolCalls
  // would no-op. On approval submits we keep the client-supplied messages.
  const { effectiveMessages, isSubAgentChat, chatRecord, subAgentSummary } =
    chatsInput.isToolApproval
      ? await prepareApprovalSession(chatsInput)
      : await prepareChatSession(
          chatsInput,
          assistantTopK,
          assistantHistoryStrategy,
          modelContextLimit,
          assistant?.metadata as Record<string, unknown> | undefined,
        );

  // Generate unique IDs for this conversation
  const threadId = `${id}-${Date.now()}`;
  const messageId = `msg-${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, 9)}`;

  // Build chat context (similar to SubtaskContext)
  const chatContext: ChatContext = {
    sessionID: id,
    messageID: messageId,
    organizationId,
    xAccessToken: userContext.x_access_token,
    userId: userId || "",
    assistantId: assistant_id,
    threadId,
    subAgentSummary,
    assistant,
    ...(chatsInput.boardId ? { boardId: chatsInput.boardId } : {}),
  };

  // Accumulator for sub-agent data: populated during streaming by chat-processor,
  // read in handleStreamFinish to persist sub-agent messages to DB.
  const subAgentAccumulator = new Map<string, SubAgentAccumulated>();

  // Mutable container for agent stream token usage.
  // Populated by chat-processor; read in handleStreamFinish to persist for next-turn compaction.
  const usageCapture: NonNullable<ChatOptions["usageCapture"]> = {};

  // Mutable container for streaming errors. Populated by chat-processor's onError,
  // read in handleStreamFinish so the error text is saved as the assistant message.
  const errorCapture: NonNullable<ChatOptions["errorCapture"]> = {};

  // Build chat options with onStreamFinish delegating to handleStreamFinish
  const chatOptions: ChatOptions = {
    maxSteps: (assistant?.metadata?.max_steps as number) || 50,
    streaming: true,
    subAgentAccumulator,
    usageCapture,
    errorCapture,
    showThinkingProcess: isShowThinkingProcess,
    ...(modelContextLimit !== undefined
      ? { maxInputTokens: modelContextLimit }
      : {}),
    onStreamFinish: async ({ responseMessage, isAborted, isContinuation }) => {
      await handleStreamFinish({
        chatId: id,
        responseMessage,
        isAborted,
        isContinuation,
        isSubAgentChat,
        chatRecord,
        subAgentAccumulator,
        usageCapture,
        errorCapture,
      });
    },
  };

  // Build enriched input with DB-loaded messages
  const enrichedInput: ChatInput = {
    ...chatsInput,
    messages: effectiveMessages,
  };

  // ── Document-AI fast-path ──────────────────────────────────────────────────
  // Reason: document-ai runs a deterministic extraction pipeline, not a
  // multi-agent loop. It only needs onStreamFinish for DB persistence —
  // none of the sub-agent/usage-capture/maxSteps options apply.
  if (
    assistant &&
    (assistant as Record<string, unknown>)["agent_type"] === "document_ai"
  ) {
    logger.info("Routing to document-AI processor", { chatId: id });
    const docAiErrorCapture: NonNullable<ChatOptions["errorCapture"]> = {};
    const documentAiOptions: ChatOptions = {
      errorCapture: docAiErrorCapture,
      onStreamFinish: async ({ responseMessage, isAborted, isContinuation }) => {
        await handleStreamFinish({
          chatId: id,
          responseMessage,
          isAborted,
          isContinuation,
          isSubAgentChat,
          chatRecord,
          subAgentAccumulator: new Map(),
          usageCapture: {},
          errorCapture: docAiErrorCapture,
        });
      },
    };
    try {
      return await processDocumentAiStream(
        enrichedInput,
        chatContext,
        documentAiOptions,
        assistant as Record<string, unknown>,
      );
    } catch (error) {
      logger.error("processDocumentAiStream threw", {
        chatId: id,
        error: error instanceof Error ? error.message : String(error),
      });
      return handleChatError(
        id,
        error instanceof Error ? error.message : "Document processing failed.",
      );
    }
  }
  // ── End document-AI fast-path ───────────────────────────────────────────────

  // Delegate to the chat processor
  try {
    const response = await processChatStream(
      enrichedInput,
      chatContext,
      chatOptions,
    );

    // If processor returned a non-OK response (e.g. 400 validation error),
    // extract the error and return it as a stream response.
    if (!response.ok) {
      let errorText = "An error occurred while processing your request.";
      try {
        const errorBody = (await response.json()) as Record<string, unknown>;
        if (typeof errorBody["error"] === "string") {
          errorText = errorBody["error"];
        }
      } catch {
        // ignore parse failure
      }
      return handleChatError(id, errorText);
    }

    return response;
  } catch (error) {
    logger.error("processChatStream threw, resetting chat status to idle", {
      chatId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    const errorText =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    return handleChatError(id, errorText);
  }
}
