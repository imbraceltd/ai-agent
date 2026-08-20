/**
 * Chat Session Service
 * Manages chat session lifecycle: create/load chat, save messages,
 * load history, generate titles.
 */

import { generateText } from "ai";
import { createConfiguredOpenAI } from "@/utils/openaiClient";
import { Chat } from "@/models/client/chat";
import { Message } from "@/models/client/message";
import { generateTitleFromMessage } from "@/services/titleService";
import config from "@/config";
import logger from "@/lib/logger";
import type { ChatInput, SubAgentAccumulated } from "@/core/agents/types/chat";
import type { UIMessage } from "ai";

/** Configuration for message history loading */
export interface MessageHistoryConfig {
  /** Number of recent messages to load (default: load all) */
  topK?: number;
  /** Approximate token budget for compaction (default: 100000) */
  maxTokenEstimate?: number;
  /** Model to use for summarization (default: "gpt-4o-mini") */
  summaryModel?: string;
}

const DEFAULT_HISTORY_CONFIG: MessageHistoryConfig = {
  topK: 20,
  maxTokenEstimate: 100000,
};

/** Priority classification for messages during compaction */
export interface MessagePriority {
  messageId: string;
  score: number; // 0-100, higher = more important
  category:
    | "user-instruction"
    | "tool-result"
    | "assistant-response"
    | "summary"
    | "marker"
    | "general";
  charCount: number;
  toolResultSize?: number | undefined;
}

/** Configuration for tiered compaction */
export interface CompactionConfig {
  /** Char threshold for compressing individual tool results (default: 2000) */
  toolResultCompressionThreshold: number;
  /** Max chars for a compressed tool result summary (default: 500) */
  toolResultMaxSummaryChars: number;
  /** Number of messages per incremental summary chunk (default: 12) */
  chunkSize: number;
  /** Messages with score >= this are never summarized (default: 80) */
  protectedScoreThreshold: number;
}

const DEFAULT_COMPACTION_CONFIG: CompactionConfig = {
  toolResultCompressionThreshold: 2000,
  toolResultMaxSummaryChars: 500,
  chunkSize: 12,
  protectedScoreThreshold: 80,
};

// ─── Chat Lifecycle ─────────────────────────────────────

/**
 * Ensure a Chat record exists for the given ID.
 * If it does not exist, create one with a placeholder title.
 * @param chatId - The chat session ID
 * @param userId - Valid UUID from the User table
 * @param assistantId - Assistant identifier
 * @param organizationId - Organization identifier
 * @returns Object indicating whether the chat was newly created
 */
export async function ensureChatExists(
  chatId: string,
  userId: string,
  assistantId: string,
  organizationId: string,
): Promise<{ isNew: boolean }> {
  try {
    const existing = await Chat.get({ id: chatId });
    if (existing) {
      return { isNew: false };
    }

    await Chat.create({
      id: chatId,
      userId,
      title: "New chat",
      visibility: "private",
      assistantId,
      organizationId,
    });

    return { isNew: true };
  } catch (error) {
    logger.error("Failed to ensure chat exists", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ─── Message Persistence ────────────────────────────────

/**
 * Convert an AI SDK message to the parts format used by the database.
 * @param msg - A message from the AI SDK (UserModelMessage or ModelMessage)
 * @returns Parts array compatible with the Message_v2 schema
 */
function convertMessageToParts(
  msg: unknown,
): Array<{ type: string; text?: string; [key: string]: unknown }> {
  const message = msg as Record<string, unknown>;

  // Reason: ai-sdk v6 UIMessages use `parts`. Older code paths and
  // ModelMessages use `content`. Prefer `parts` when present so the v6 wire
  // shape from the FE survives the save/load round-trip — otherwise text is
  // silently dropped, producing empty user messages that the agent answers
  // with a generic greeting.
  const parts = message["parts"];
  if (Array.isArray(parts) && parts.length > 0) {
    return parts as Array<{ type: string; [key: string]: unknown }>;
  }

  const content = message["content"];

  if (Array.isArray(content)) {
    return content;
  }
  if (typeof content === "string") {
    return [{ type: "text", text: content }];
  }
  if (typeof content === "object" && content !== null) {
    return [content as { type: string; [key: string]: unknown }];
  }
  return [{ type: "text", text: String(content ?? "") }];
}

/**
 * Save the incoming user message to the database.
 * Extracts the last user message from the messages array.
 * @param chatId - Chat session ID
 * @param messages - Messages array from client
 * @returns The saved message ID, or empty string if nothing was saved
 */
export async function saveUserMessage(
  chatId: string,
  messages: ChatInput["messages"],
): Promise<{ id: string }> {
  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== "user") {
    logger.warn("No user message found to save", { chatId });
    return { id: "" };
  }

  const parts = convertMessageToParts(lastMessage);

  return Message.create({
    chatId,
    role: "user",
    parts,
    metadata: null,
  });
}

/**
 * Save the assistant's response message to the database.
 * Called from the onFinish callback of createUIMessageStream.
 * Strips reasoning blocks before persisting — they are only useful during the
 * current turn and would inflate token usage if reloaded into future turns.
 * @param chatId - Chat session ID
 * @param responseMessage - The complete assistant response from onFinish
 * @returns The saved message ID
 */
export async function saveAssistantMessage(
  chatId: string,
  responseMessage: UIMessage,
  options: { isContinuation?: boolean } = {},
): Promise<{ id: string }> {
  const rawParts = Array.isArray(responseMessage.parts)
    ? responseMessage.parts
    : [{ type: "text", text: String(responseMessage.parts ?? "") }];

  // Reason: Reasoning blocks are chain-of-thought artifacts produced during a single
  // turn. Persisting them causes them to be re-sent as input tokens on every future
  // turn, inflating cost with no benefit (the model doesn't need its own prior reasoning).
  const parts = rawParts.filter(
    (p) => (p as Record<string, unknown>)["type"] !== "reasoning",
  );

  const responseId = (responseMessage as { id?: string }).id;
  const isValidUuid =
    !!responseId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      responseId,
    );

  // Reason: HITL approval continuation. When the v6 SDK resumes after the
  // user approves/denies a `needsApproval` tool, it reuses the original
  // assistant message id and emits new chunks (tool-output-available or
  // tool-output-denied + follow-up text). Update the existing row in place
  // — otherwise the original "approval-requested" row sticks around and FE
  // renders both the stale Approve/Deny prompt and the Completed/Denied
  // block side by side after reload.
  if (options.isContinuation && isValidUuid) {
    const result = await Message.update({
      id: responseId!,
      parts: parts as Array<{ type: string; [key: string]: unknown }>,
      metadata: null,
    });
    if (result?.updated) {
      return { id: result.id };
    }
    // Fall through to create when no row matched (defensive).
  }

  // Reason: Persist with the SDK-supplied UUID so the FE's chat state id
  // matches the DB id. Without this, the FE submits the original assistant
  // message back with id=<sdk uuid> on continuation, but the DB row was
  // saved under a freshly generated uuid — Message.update can't find it
  // and the continuation row gets created as a duplicate.
  return Message.create({
    chatId,
    ...(isValidUuid ? { id: responseId } : {}),
    role: "assistant",
    parts: parts as Array<{ type: string; [key: string]: unknown }>,
    metadata: null,
  });
}

/**
 * Save accumulated sub-agent messages to the database.
 * Each sub-agent session is saved as a separate Message_v2 row with
 * metadata.subAgent = true for identification on reload.
 * @param chatId - Chat session ID
 * @param accumulator - Map of sub-agent session data
 */
export async function saveSubAgentMessages(
  chatId: string,
  accumulator: Map<string, SubAgentAccumulated>,
): Promise<void> {
  for (const [sessionId, agentData] of accumulator) {
    try {
      const parts: Array<{ type: string; [key: string]: unknown }> = [
        { type: "text", text: agentData.text },
        ...agentData.toolCalls.flatMap((tc) => [
          {
            type: "tool-call",
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: {},
          },
          ...(tc.result != null
            ? [
                {
                  type: "tool-result",
                  toolCallId: tc.toolCallId,
                  result: tc.result,
                },
              ]
            : []),
        ]),
      ];

      await Message.create({
        chatId,
        role: "assistant",
        parts,
        metadata: {
          subAgent: true,
          sessionId: agentData.sessionId,
          agentName: agentData.agentName,
          parentSessionId: agentData.parentSessionId,
          assistantId: agentData.assistantId,
          status: agentData.status,
          startedAt: new Date(agentData.startedAt).toISOString(),
          endedAt: agentData.endedAt
            ? new Date(agentData.endedAt).toISOString()
            : undefined,
          error: agentData.error,
        },
      });
    } catch (err) {
      logger.error("Failed to save sub-agent message", {
        sessionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ─── Sub-Agent Session History ──────────────────────────

/**
 * Load a sub-agent's persisted message history from the database.
 * Returns the sub-agent's original response as a ModelMessage[] array
 * that can be prepended to new user messages for session continuation.
 *
 * @param chatId - Chat session ID
 * @param sessionId - Sub-agent session ID
 * @returns Object with assistantId and messages array for continuation
 */
export async function loadSubAgentHistory(
  chatId: string,
  sessionId: string,
): Promise<{
  assistantId?: string | undefined;
  messages: Array<{ role: "assistant" | "user"; content: string }>;
} | null> {
  const allMessages = await Message.getByChatId({ chatId });
  if (!allMessages || allMessages.length === 0) return null;

  // Find the sub-agent message matching this sessionId
  const subAgentMsg = allMessages.find((msg) => {
    const meta = msg.metadata as Record<string, unknown> | null;
    return meta?.["subAgent"] === true && meta?.["sessionId"] === sessionId;
  });

  if (!subAgentMsg) return null;

  const meta = subAgentMsg.metadata as Record<string, unknown> | null;
  const assistantId = meta?.["assistantId"] as string | undefined;

  // Extract text from parts
  const parts = subAgentMsg.parts as Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;
  const textParts = parts?.filter((p) => p.type === "text" && p.text) || [];
  const text = textParts.map((p) => p.text).join("\n");

  // Return the sub-agent's original response as the first assistant message
  const messages: Array<{ role: "assistant" | "user"; content: string }> = [];
  if (text) {
    messages.push({ role: "assistant", content: text });
  }

  return { assistantId, messages };
}

/**
 * Find the parent (main) chat ID for a sub-agent session.
 * Queries messages with metadata.subAgent=true matching the sessionId,
 * then reads metadata.parentSessionId which is the main chat ID.
 * @param sessionId - The sub-agent's session ID
 * @returns The parent chat ID, or null if not found
 */
export async function findParentChatId(
  sessionId: string,
): Promise<string | null> {
  try {
    const { getDb } = await import("@/database/postgres");
    const { message } = await import("@/database/pgSchema");
    const { sql } = await import("drizzle-orm");

    const db = getDb();
    const results = await db
      .select({ metadata: message.metadata })
      .from(message)
      .where(
        sql`${message.metadata}->>'subAgent' = 'true' AND ${message.metadata}->>'sessionId' = ${sessionId}`,
      )
      .limit(1);

    const first = results[0];
    if (!first) return null;

    const meta = first.metadata as Record<string, unknown> | null;
    return (meta?.["parentSessionId"] as string) || null;
  } catch (error) {
    logger.error("Failed to find parent chat ID", {
      sessionId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Find the parent (main) chat ID for a sub-agent by its assistantId.
 * Queries messages with metadata.subAgent=true matching the assistantId,
 * then returns the chatId of that message (which is the main/parent chat).
 * @param assistantId - The sub-agent's assistant ID
 * @returns The parent chat ID, or null if not found
 */
export async function findParentChatIdByAssistantId(
  assistantId: string,
): Promise<string | null> {
  try {
    const { getDb } = await import("@/database/postgres");
    const { message } = await import("@/database/pgSchema");
    const { sql, desc } = await import("drizzle-orm");

    const db = getDb();
    // Reason: Get the most recent parent chat that used this sub-agent
    const results = await db
      .select({ chatId: message.chatId })
      .from(message)
      .where(
        sql`${message.metadata}->>'subAgent' = 'true' AND ${message.metadata}->>'assistantId' = ${assistantId}`,
      )
      .orderBy(desc(message.createdAt))
      .limit(1);

    const first = results[0];
    if (!first) return null;

    return first.chatId;
  } catch (error) {
    logger.error("Failed to find parent chat ID by assistantId", {
      assistantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Save a user+assistant exchange from the direct sub-agent chat modal.
 * Each message is saved as a separate row with metadata.subAgentDirectChat = true.
 */
export async function saveDirectChatExchange(
  chatId: string,
  sessionId: string,
  userText: string,
  assistantText: string,
): Promise<void> {
  try {
    // Save user message
    await Message.create({
      chatId,
      role: "user",
      parts: [{ type: "text", text: userText }],
      metadata: {
        subAgentDirectChat: true,
        sessionId,
      },
    });

    // Save assistant response
    await Message.create({
      chatId,
      role: "assistant",
      parts: [{ type: "text", text: assistantText }],
      metadata: {
        subAgentDirectChat: true,
        sessionId,
      },
    });
  } catch (err) {
    logger.error("Failed to save direct chat exchange", {
      chatId,
      sessionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Load all direct chat messages for a sub-agent session.
 * Returns user/assistant messages in chronological order.
 */
export async function loadDirectChatHistory(
  chatId: string,
  sessionId: string,
): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
  const allMessages = await Message.getByChatId({ chatId });
  if (!allMessages || allMessages.length === 0) return [];

  // Reason: Match both direct chat modal messages (subAgentDirectChat=true)
  // and accumulator-persisted messages (subAgent=true). The task tool no longer
  // calls saveDirectChatExchange, so initial invocation data comes from the
  // accumulator path. Direct modal exchanges still use subAgentDirectChat.
  const directChatMsgs = allMessages.filter((msg) => {
    const meta = msg.metadata as Record<string, unknown> | null;
    const matchesSessionId = meta?.["sessionId"] === sessionId;
    return (
      matchesSessionId &&
      (meta?.["subAgentDirectChat"] === true || meta?.["subAgent"] === true)
    );
  });

  return directChatMsgs.map((msg) => {
    const parts = msg.parts as Array<{ type: string; text?: string }>;
    const text =
      parts
        ?.filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("") || "";
    return {
      role: msg.role as "user" | "assistant",
      content: text,
    };
  });
}

// ─── Message History ────────────────────────────────────

/**
 * Read the message history configuration from environment variables,
 * optionally overridden by the assistant's metadata.top_k setting.
 * @param assistantTopK - Optional top_k value from assistant config (metadata.top_k).
 *                        Takes priority over the environment variable when set.
 * @returns MessageHistoryConfig derived from assistant config, env, or defaults
 */
export function getMessageHistoryConfig(
  assistantTopK?: number,
): MessageHistoryConfig {
  const maxTokenEstimate = parseInt(
    process.env["CHAT_HISTORY_MAX_TOKENS"] || "100000",
    10,
  );

  // Reason: Use assistant's top_k when set; otherwise omit → load all messages.
  return {
    ...(assistantTopK && assistantTopK > 0 ? { topK: assistantTopK } : {}),
    maxTokenEstimate,
    summaryModel: process.env["CHAT_HISTORY_SUMMARY_MODEL"] || "gpt-4o-mini",
  };
}

/**
 * Read the context compaction threshold from environment variables.
 * When estimated prompt tokens exceed this value, older messages are
 * automatically summarized to stay within the model's context window.
 * @returns Token threshold for triggering automatic compaction (default: 100000)
 */
export function getContextCompactThreshold(): number {
  return parseInt(process.env["CONTEXT_COMPACT_THRESHOLD"] || "100000", 10);
}

/**
 * Load message history from the database based on the configured strategy.
 * @param chatId - Chat session ID
 * @param historyConfig - History loading configuration
 * @returns Database message records
 */
export async function loadMessageHistory(
  chatId: string,
  historyConfig: MessageHistoryConfig = DEFAULT_HISTORY_CONFIG,
): Promise<Message.Info[]> {
  const allMessages = await Message.getByChatId({ chatId });

  if (!allMessages || allMessages.length === 0) {
    return [];
  }

  // Filter out sub-agent messages - they're only for client display, not LLM context
  const filteredMessages = allMessages.filter((msg) => {
    const meta = msg.metadata as Record<string, unknown> | null;
    return (
      !(meta?.["subAgent"] === true) && !(meta?.["subAgentDirectChat"] === true)
    );
  });

  if (filteredMessages.length === 0) {
    return [];
  }

  // Reason: Always apply filterCompacted() first — trims to post-compaction baseline.
  // Compaction itself is triggered externally (prepareChatSession / handleStreamFinish),
  // so this function is a pure read: filter → trim → slice.
  const baseMessages = filterCompacted(filteredMessages);

  // Reason: When topK is not set, return all messages (no slicing).
  if (historyConfig.topK == null) return baseMessages;
  return baseMessages.slice(-historyConfig.topK);
}

/**
 * Select the K messages most relevant to the current query using keyword overlap scoring.
 * Always includes the last `recentGuarantee` messages for conversation continuity.
 * Returns messages sorted chronologically (asc).
 * Falls back to top-k latest when the query yields no useful keywords.
 * @param messages - Baseline messages (post-filterCompacted, sorted asc)
 * @param topK - Maximum number of messages to return
 * @param currentQuery - Current user message text used for scoring
 * @param recentGuarantee - Always include last N messages regardless of score (default: 3)
 */
export function loadRelevantMessages(
  messages: Message.Info[],
  topK: number,
  currentQuery: string,
  recentGuarantee: number = 3,
): Message.Info[] {
  const STOPWORDS = new Set([
    "the",
    "a",
    "an",
    "is",
    "it",
    "in",
    "on",
    "at",
    "to",
    "of",
    "and",
    "or",
    "for",
    "with",
    "that",
    "this",
    "be",
    "was",
    "are",
    "do",
    "have",
    "has",
    "had",
    "not",
    "but",
    "from",
    "by",
    "as",
    "if",
    "so",
    "we",
    "you",
    "he",
    "she",
    "they",
  ]);

  const queryTokens = currentQuery
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));

  if (queryTokens.length === 0) {
    logger.debug(
      "top-k-relevant: no query tokens, falling back to top-k latest",
      { topK },
    );
    return messages.slice(-topK);
  }

  const guaranteed = messages.slice(-recentGuarantee);
  const guaranteedIds = new Set(guaranteed.map((m) => m.id));
  const candidates = messages.filter((m) => !guaranteedIds.has(m.id));

  const scored = candidates.map((msg) => {
    const text = JSON.stringify(msg.parts).toLowerCase();
    const score = queryTokens.reduce(
      (sum, token) => sum + (text.includes(token) ? 1 : 0),
      0,
    );
    return { msg, score };
  });
  scored.sort((a, b) => b.score - a.score);

  const topRelevant = scored
    .filter((s) => s.score > 0)
    .slice(0, Math.max(0, topK - recentGuarantee))
    .map((s) => s.msg);

  logger.info("top-k-relevant: messages selected", {
    queryTokens,
    relevantCount: topRelevant.length,
    guaranteedCount: guaranteed.length,
  });

  const merged = [...topRelevant, ...guaranteed];
  merged.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
  const seen = new Set<string>();
  return merged.filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
}

/**
 * OpenCode-style compaction filter: scan messages oldest→newest, find the last
 * summary+marker pair, and return only the summary + everything after the marker.
 *
 * A "pair" is:
 *   - An assistant message with metadata.synthetic=true  (the summary)
 *   - Followed by a user message with metadata.compaction=true  (the marker)
 *
 * If no marker is found, returns the full message array unchanged.
 * This function is applied before any strategy branching so all strategies
 * always start from the correct post-compaction baseline.
 *
 * @param messages - All filtered messages for the chat (sorted createdAt asc)
 * @returns Messages starting from the summary of the latest compaction
 */
export function filterCompacted(messages: Message.Info[]): Message.Info[] {
  let latestSummaryIdx = -1;
  let latestMarkerIdx = -1;

  // Forward scan: track the last summary→marker pair
  for (let i = 0; i < messages.length; i++) {
    const meta = messages[i]!.metadata as Record<string, unknown> | null;
    if (meta?.["synthetic"] === true) {
      latestSummaryIdx = i;
    }
    // A marker is only valid when it comes after a summary
    if (latestSummaryIdx >= 0 && meta?.["compaction"] === true) {
      latestMarkerIdx = i;
    }
  }

  if (latestSummaryIdx < 0 || latestMarkerIdx < 0) {
    return messages; // No compaction pair found — return as-is
  }

  // Return from the summary message onwards (includes summary + marker + all newer messages)
  return messages.slice(latestSummaryIdx);
}

/**
 * Score each message's importance for compaction decisions.
 * Higher scores = more important = less likely to be summarized.
 * @param messages - Messages to score
 * @returns Array of priority scores aligned with input messages
 */
export function scoreMessagePriority(
  messages: Message.Info[],
): MessagePriority[] {
  const totalCount = messages.length;
  return messages.map((msg, index) => {
    let score = 50; // baseline
    const parts = msg.parts as Array<{
      type: string;
      text?: string;
      [key: string]: unknown;
    }>;
    const charCount = JSON.stringify(parts).length;
    const meta = msg.metadata as Record<string, unknown> | null;

    // Category detection
    let category: MessagePriority["category"] = "general";
    if (meta?.["synthetic"] === true) {
      category = "summary";
      score = 90;
    } else if (meta?.["compaction"] === true) {
      category = "marker";
      score = 90;
    } else if (msg.role === "user") {
      category = "user-instruction";
      score = 65;
      // Reason: Boost substantive user messages that likely contain instructions/decisions
      const text = parts
        .filter((p) => p.type === "text")
        .map((p) => p.text || "")
        .join("");
      if (text.length > 100) score += 10;
    } else if (msg.role === "assistant") {
      const hasToolCalls = parts.some((p) => p.type === "tool-call");
      const hasToolResults = parts.some((p) => p.type === "tool-result");
      if (hasToolResults) {
        category = "tool-result";
        score = 35; // Reason: Tool results are the most compressible — often large JSON payloads
      } else if (hasToolCalls) {
        category = "tool-result";
        score = 40;
      } else {
        category = "assistant-response";
        score = 55;
      }
    }

    // Reason: Recent messages get a recency bonus — more likely to be relevant to the current turn
    const positionRatio = index / totalCount;
    if (positionRatio > 0.8) score += 15;
    else if (positionRatio > 0.6) score += 5;

    // Reason: Larger tool results are more compressible, so penalize them more
    let toolResultSize: number | undefined;
    const toolResultParts = parts.filter((p) => p.type === "tool-result");
    if (toolResultParts.length > 0) {
      toolResultSize = JSON.stringify(toolResultParts).length;
      if (toolResultSize > 5000) score -= 10;
      if (toolResultSize > 20000) score -= 15;
    }

    return {
      messageId: msg.id,
      score: Math.max(0, Math.min(100, score)),
      category,
      charCount,
      toolResultSize,
    };
  });
}

/**
 * Compress large tool results within messages to reduce token consumption.
 * Replaces large tool-result parts with truncated summaries.
 * Pure function — does NOT require an LLM call.
 * @param messages - Messages with potential large tool results
 * @param compactionConfig - Compaction configuration
 * @returns Messages with compressed tool results (shallow copy, parts replaced)
 */
export function compressToolResults(
  messages: Message.Info[],
  compactionConfig: CompactionConfig = DEFAULT_COMPACTION_CONFIG,
): Message.Info[] {
  return messages.map((msg) => {
    const parts = msg.parts as Array<{
      type: string;
      text?: string;
      result?: unknown;
      [key: string]: unknown;
    }>;
    const hasLargeResults = parts.some(
      (p) =>
        p.type === "tool-result" &&
        JSON.stringify(p.result ?? p).length >
          compactionConfig.toolResultCompressionThreshold,
    );

    if (!hasLargeResults) return msg;

    const compressedParts = parts.map((part) => {
      if (part.type !== "tool-result") return part;
      const resultStr = JSON.stringify(part.result ?? part);
      if (
        resultStr.length <= compactionConfig.toolResultCompressionThreshold
      ) {
        return part;
      }

      // Reason: Heuristic compression — keep first N chars for key structure + metadata
      const truncated = resultStr.slice(
        0,
        compactionConfig.toolResultMaxSummaryChars,
      );
      return {
        ...part,
        result: `[Compressed tool result — original ${resultStr.length} chars]\n${truncated}...`,
      };
    });

    return { ...msg, parts: compressedParts as typeof msg.parts };
  });
}

/**
 * Find the index of the latest synthetic summary message in the array.
 * @deprecated Use filterCompacted() instead — kept for backward compat with existing synthetic msgs.
 * @param messages - Array of messages (sorted by createdAt asc)
 * @returns Index of the latest synthetic summary, or -1 if none found
 */
function findLatestSyntheticSummaryIndex(messages: Message.Info[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    const meta = messages[i]!.metadata as Record<string, unknown> | null;
    if (meta?.["synthetic"] === true) {
      return i;
    }
  }
  return -1;
}

/**
 * Tiered compaction pipeline: compress tool results, score priorities,
 * then summarize low-priority older messages in incremental chunks.
 * Saves the summary to the database so subsequent turns can reuse it.
 * Falls back to top-k if summarization fails.
 * @param messages - All messages from the database
 * @param historyConfig - History configuration with token budget
 * @param compactionConfig - Optional tiered compaction configuration
 * @returns Compacted messages array
 */
export async function compactMessages(
  messages: Message.Info[],
  historyConfig: MessageHistoryConfig,
  compactionConfig: CompactionConfig = DEFAULT_COMPACTION_CONFIG,
): Promise<Message.Info[]> {
  const maxTokens = historyConfig.maxTokenEstimate ?? 100000;
  // Reason: Rough estimate of ~4 characters per token for budget calculation
  const charBudget = maxTokens * 4;

  // ── Phase 1: Compress large tool results ──
  const workingMessages = compressToolResults(messages, compactionConfig);

  // Check if we're within budget after tool compression alone
  const totalCharsAfterCompression = workingMessages.reduce(
    (sum, m) => sum + JSON.stringify(m.parts).length,
    0,
  );
  if (totalCharsAfterCompression <= charBudget) {
    return workingMessages;
  }

  // ── Phase 2: Score message priorities ──
  const priorities = scoreMessagePriority(workingMessages);

  // ── Phase 3: Find split point respecting priorities ──
  // Reason: Work backwards, accumulating chars. Protected messages (score >= threshold)
  // are always kept. Low-priority messages in the "older" section get summarized.
  let accumChars = 0;
  let splitIndex = 0;

  for (let i = workingMessages.length - 1; i >= 0; i--) {
    const priority = priorities[i]!;
    const msgChars = priority.charCount;

    // Always include protected messages in the "keep" set
    if (priority.score >= compactionConfig.protectedScoreThreshold) {
      accumChars += msgChars;
      continue;
    }

    if (accumChars + msgChars > charBudget) {
      splitIndex = i + 1;
      break;
    }
    accumChars += msgChars;
  }

  if (splitIndex === 0) {
    return workingMessages;
  }

  const olderMessages = workingMessages.slice(0, splitIndex);
  const recentMessages = workingMessages.slice(splitIndex);
  const chatId = messages[0]!.chatId;

  try {
    // ── Phase 3b: Incremental chunked summarization ──
    const summary = await summarizeMessagesInChunks(
      olderMessages,
      historyConfig,
      compactionConfig.chunkSize,
    );

    // Persist summary + compaction marker to DB (OpenCode pattern: summary then marker)
    try {
      await Message.create({
        chatId,
        role: "assistant",
        parts: [{ type: "text", text: `[Conversation Summary]\n${summary}` }],
        metadata: {
          synthetic: true,
          summarizedCount: olderMessages.length,
        },
      });
      // Reason: The marker is a user-role message that acts as a cut-point.
      // filterCompacted() scans for a summary+marker pair to determine where
      // pre-compaction history ends — matching the OpenCode filterCompacted() pattern.
      await Message.create({
        chatId,
        role: "user",
        parts: [
          {
            type: "text",
            text: "[Compaction marker — history before this point was summarized]",
          },
        ],
        metadata: {
          compaction: true,
          auto: true,
          summarizedCount: olderMessages.length,
        },
      });
      logger.info("Compact summary + marker saved to DB", {
        chatId,
        summarizedCount: olderMessages.length,
        summaryLength: summary.length,
      });
    } catch (saveErr) {
      logger.warn("Failed to persist compact summary/marker to DB", {
        chatId,
        error: saveErr instanceof Error ? saveErr.message : String(saveErr),
      });
    }

    // Create in-memory summary message for immediate use
    const summaryMessage: Message.Info = {
      id: `summary-${Date.now()}`,
      chatId,
      role: "assistant",
      parts: [
        { type: "text", text: `[Conversation Summary]\n${summary}` },
      ] as unknown as Message.Info["parts"],
      attachments: [] as unknown as Message.Info["attachments"],
      metadata: { synthetic: true, summarizedCount: olderMessages.length },
      createdAt: olderMessages[olderMessages.length - 1]!.createdAt,
    };

    return [summaryMessage, ...recentMessages];
  } catch (error) {
    logger.warn("Tiered compaction failed, falling back to top-k", {
      error: error instanceof Error ? error.message : String(error),
    });
    if (historyConfig.topK == null) return messages;
    return messages.slice(-historyConfig.topK);
  }
}

/**
 * Use AI to summarize a batch of older messages.
 * @param messages - Older messages to summarize
 * @param historyConfig - Config with model preference
 * @returns Summary text
 */
async function summarizeMessages(
  messages: Message.Info[],
  historyConfig: MessageHistoryConfig,
): Promise<string> {
  const apiKey = config.openai.apiKey;
  const baseURL = config.openai.openAIProxyURL || undefined;

  if (!apiKey) {
    throw new Error("No OpenAI API key configured for message summarization");
  }

  const openai = createConfiguredOpenAI(apiKey, baseURL);

  const model = openai(historyConfig.summaryModel ?? "gpt-4o-mini");

  const conversationText = messages
    .map((m) => {
      const textParts = (m.parts as Array<{ type: string; text?: string }>)
        .filter((p) => p.type === "text" && p.text)
        .map((p) => p.text)
        .join("");
      return `${m.role}: ${textParts}`;
    })
    .join("\n");

  const result = await generateText({
    model,
    system: `You are summarizing a conversation to reduce context size.
Provide a detailed summary so another agent can continue this conversation seamlessly.
Use this template exactly:

## Goal
[What goal(s) is the user trying to accomplish?]

## Instructions
[Important user instructions that are still relevant]

## Discoveries
[Notable findings, tool results, or information learned during the conversation]

## Accomplished
[What has been completed; what is still in progress; what work remains]

## Relevant files / context
[Files that were read, edited, or created relevant to the task]`,
    prompt: conversationText,
    abortSignal: AbortSignal.timeout(60_000),
  });

  return result.text;
}

/**
 * Summarize messages in incremental chunks to avoid exceeding the summarizer's
 * own context window. Each chunk produces a partial summary, and partial summaries
 * are merged into a final comprehensive summary.
 * @param messages - Messages to summarize
 * @param historyConfig - Config with model preference
 * @param chunkSize - Messages per chunk
 * @returns Merged summary text
 */
async function summarizeMessagesInChunks(
  messages: Message.Info[],
  historyConfig: MessageHistoryConfig,
  chunkSize: number = 12,
): Promise<string> {
  // Reason: If small enough for a single call, use the direct path for simplicity
  if (messages.length <= Math.floor(chunkSize * 1.5)) {
    return summarizeMessages(messages, historyConfig);
  }

  // Split into chunks and summarize each
  const chunks: Message.Info[][] = [];
  for (let i = 0; i < messages.length; i += chunkSize) {
    chunks.push(messages.slice(i, i + chunkSize));
  }

  const partialSummaries: string[] = [];
  for (const chunk of chunks) {
    const partial = await summarizeMessages(chunk, historyConfig);
    partialSummaries.push(partial);
  }

  if (partialSummaries.length === 1) return partialSummaries[0]!;

  return mergeSummaries(partialSummaries, historyConfig);
}

/**
 * Merge multiple partial summaries into a single coherent summary.
 * Deduplicates information and preserves the most important details.
 * @param summaries - Partial summaries to merge
 * @param historyConfig - Config with model preference
 * @returns Merged summary
 */
async function mergeSummaries(
  summaries: string[],
  historyConfig: MessageHistoryConfig,
): Promise<string> {
  const apiKey = config.openai.apiKey;
  const baseURL = config.openai.openAIProxyURL || undefined;

  if (!apiKey) {
    // Reason: Fallback — concatenate summaries with separators when no LLM available
    return summaries.join("\n\n---\n\n");
  }

  const openai = createConfiguredOpenAI(apiKey, baseURL);
  const model = openai(historyConfig.summaryModel ?? "gpt-4o-mini");

  const result = await generateText({
    model,
    system: `You are merging multiple conversation summaries into one coherent summary.
Deduplicate information. Preserve the most important details from each.
Use the same template structure:
## Goal
## Instructions
## Discoveries
## Accomplished
## Relevant files / context`,
    prompt: summaries
      .map((s, i) => `--- Summary ${i + 1} ---\n${s}`)
      .join("\n\n"),
    abortSignal: AbortSignal.timeout(60_000),
  });

  return result.text;
}

// ─── Message Conversion ─────────────────────────────────

/**
 * Convert database Message records into the UIMessage format expected by the AI model.
 * @param dbMessages - Message records from the database
 * @returns UIMessage-compatible array for the chat processor
 */
/**
 * Normalize a single DB part into the UIMessage part format expected by the AI SDK.
 * Handles the mismatch where client sends file parts with `data` (ModelMessage format)
 * but AI SDK UIMessage expects `url` for file parts.
 */
function normalizePartToUIFormat(
  part: Record<string, unknown>,
): Record<string, unknown> {
  if (part["type"] === "file") {
    const data = part["data"];
    // AI SDK UIMessage file parts use `url`, not `data`
    if (data && !part["url"]) {
      const { data: _data, ...rest } = part;
      // Unwrap { url: "..." } object format (AI SDK UIMessage format) to a plain string URL
      const urlValue =
        typeof data === "object" &&
        data !== null &&
        typeof (data as Record<string, unknown>)["url"] === "string"
          ? (data as Record<string, unknown>)["url"]
          : data;
      return { ...rest, type: "file", url: urlValue };
    }
  }
  return part;
}

export function convertDbMessagesToUIMessages(
  dbMessages: Message.Info[],
): UIMessage[] {
  return dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as UIMessage["role"],
    parts: Array.isArray(msg.parts)
      ? ((msg.parts as Record<string, unknown>[]).map(
          normalizePartToUIFormat,
        ) as unknown as UIMessage["parts"])
      : (msg.parts as unknown as UIMessage["parts"]),
  }));
}

// ─── Title Generation ───────────────────────────────────

/**
 * Generate a title for a new chat and save it asynchronously.
 * Does NOT block the stream -- fires and forgets.
 * @param chatId - Chat session ID
 * @param messages - The messages to derive the title from
 */
export function generateAndSaveTitle(
  chatId: string,
  messages: ChatInput["messages"],
): void {
  _generateAndSaveTitleAsync(chatId, messages).catch((err) => {
    logger.error("Failed to generate/save chat title", {
      chatId,
      error: err instanceof Error ? err.message : String(err),
    });
  });
}

/**
 * Internal async implementation for title generation and persistence.
 * @param chatId - Chat session ID
 * @param messages - Messages to derive title from
 */
async function _generateAndSaveTitleAsync(
  chatId: string,
  messages: ChatInput["messages"],
): Promise<void> {
  const firstUserMsg = messages.find((m) => m.role === "user");
  if (!firstUserMsg) return;

  const parts = convertMessageToParts(firstUserMsg);
  const title = await generateTitleFromMessage(parts);

  await Chat.updateTitle({ id: chatId, title });
  logger.info("Chat title generated and saved", { chatId, title });
}
