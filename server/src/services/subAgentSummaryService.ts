/**
 * Sub-Agent Summary Service
 * Summarizes sub-agent conversations and provides them as context to the main agent.
 *
 * Architecture:
 * - Each sub-agent chat (type: "sub-agent") stores its own summary in lastContext.subAgentSummary
 * - When the main agent runs, it collects summaries from related sub-agent chats
 * - Summaries are generated as structured JSON via the configured suggestion model (SUGGESTION_MODEL_*) with fallback to heuristic extraction
 */

import { generateText } from "ai";
import { createConfiguredOpenAI } from "@/utils/openaiClient";
import { Chat } from "@/models/client/chat";
import { Message } from "@/models/client/message";
import { updateChatLastContextById } from "@/database/pgQueries";
import config from "@/config";
import logger from "@/lib/logger";
import type { SubAgentSessionInfo } from "@/core/agents/types/chat";

/**
 * Structured summary schema for sub-agent results.
 * Stored in lastContext.subAgentSummary as JSON.
 */
export interface StructuredSubAgentSummary {
  /** Overall task completion status */
  status: "completed" | "partial" | "failed" | "needs_retry";
  /** Confidence in the result quality (0.0 - 1.0) */
  confidence: number;
  /** What was requested */
  task_description: string;
  /** Key findings/results (max 5 items) */
  key_findings: string[];
  /** Tools used with brief outcome */
  tools_used: Array<{
    name: string;
    outcome: "success" | "partial" | "failed";
    result_summary: string;
  }>;
  /** What was accomplished */
  accomplished: string[];
  /** What remains to be done (empty if fully completed) */
  remaining: string[];
  /** Actionable recommendations for the parent agent */
  recommendations: string[];
  /** When the summary was generated */
  generated_at: string;
  /** Number of messages in the conversation */
  message_count: number;
}

const STRUCTURED_SUMMARY_PROMPT = `You are summarizing a sub-agent conversation into a structured JSON format.
Analyze the conversation and produce a JSON object matching this exact schema:

{
  "status": "completed" | "partial" | "failed" | "needs_retry",
  "confidence": <number 0.0-1.0>,
  "task_description": "<what was requested>",
  "key_findings": ["<finding 1>", "<finding 2>"],
  "tools_used": [
    {"name": "<tool_name>", "outcome": "success"|"partial"|"failed", "result_summary": "<brief>"}
  ],
  "accomplished": ["<what was done>"],
  "remaining": ["<what still needs doing>"],
  "recommendations": ["<suggestion for parent agent>"]
}

Rules:
- status: "completed" if task was fully done, "partial" if partially done, "failed" if tools/logic failed, "needs_retry" if the sub-agent gave up or hit limits.
- confidence: 1.0 if results are definitive with tool evidence, lower if uncertain or incomplete.
- key_findings: Max 5 items, most important first. Be specific with data points.
- tools_used: List every tool that was called. result_summary should be under 50 words.
- recommendations: Suggest what the parent agent should do next (present to user, run another agent, verify results, etc.)
- Return ONLY the JSON object, no markdown code fences, no preamble.`;

const MAX_RAW_CHARS = 4000;

/**
 * Extract text content from a message's parts array.
 * @param parts - Message parts from DB
 * @returns Plain text content and tool names
 */
function extractTextFromParts(
  parts: Array<{
    type: string;
    text?: string;
    toolName?: string;
    [key: string]: unknown;
  }>,
): { text: string; toolNames: string[] } {
  let text = "";
  const toolNames: string[] = [];

  for (const part of parts) {
    if (part.type === "text" && part.text) {
      text += part.text;
    } else if (part.type === "tool-call" && part.toolName) {
      toolNames.push(part.toolName);
    }
  }

  return { text, toolNames };
}

/**
 * Build a structured fallback summary without LLM, using heuristic extraction.
 * @param conversation - Parsed conversation data
 * @param messageCount - Total messages
 * @returns StructuredSubAgentSummary
 */
function buildStructuredFallback(
  conversation: Array<{ role: string; text: string; toolNames: string[] }>,
  messageCount: number,
): StructuredSubAgentSummary {
  const userMessages = conversation.filter((m) => m.role === "user");
  const assistantMessages = conversation.filter((m) => m.role !== "user");
  const allToolNames = [...new Set(conversation.flatMap((m) => m.toolNames))];

  const taskDescription =
    userMessages.length > 0
      ? userMessages[0]!.text.slice(0, 200)
      : "No user message found";

  const keyFindings = assistantMessages
    .filter((m) => m.text.length > 50)
    .slice(-3)
    .map((m) => m.text.slice(0, 150) + (m.text.length > 150 ? "..." : ""));

  return {
    status: assistantMessages.length > 0 ? "completed" : "failed",
    confidence: 0.3, // Reason: Low confidence for heuristic fallback without LLM analysis
    task_description: taskDescription,
    key_findings: keyFindings,
    tools_used: allToolNames.map((name) => ({
      name,
      outcome: "success" as const,
      result_summary: "Tool was called (details unavailable in fallback mode)",
    })),
    accomplished:
      keyFindings.length > 0 ? ["Sub-agent produced responses"] : [],
    remaining: [],
    recommendations: ["Review sub-agent results for accuracy"],
    generated_at: new Date().toISOString(),
    message_count: messageCount,
  };
}

/**
 * Parse and validate LLM JSON output into StructuredSubAgentSummary.
 * Applies defensive parsing with reasonable defaults for missing fields.
 * @param text - Raw LLM output (should be JSON)
 * @param conversation - Fallback data source
 * @param messageCount - Total message count
 * @returns Validated StructuredSubAgentSummary
 */
function parseStructuredSummary(
  text: string,
  conversation: Array<{ role: string; text: string; toolNames: string[] }>,
  messageCount: number,
): StructuredSubAgentSummary {
  try {
    // Reason: Strip markdown code fences if present — some models wrap JSON in ```json blocks
    const cleaned = text
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();
    const parsed = JSON.parse(cleaned);

    const validStatuses = ["completed", "partial", "failed", "needs_retry"];
    const validOutcomes = ["success", "partial", "failed"];

    return {
      status: validStatuses.includes(parsed.status) ? parsed.status : "partial",
      confidence:
        typeof parsed.confidence === "number"
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.5,
      task_description:
        typeof parsed.task_description === "string"
          ? parsed.task_description
          : "Unknown task",
      key_findings: Array.isArray(parsed.key_findings)
        ? parsed.key_findings
            .filter((f: unknown) => typeof f === "string")
            .slice(0, 5)
        : [],
      tools_used: Array.isArray(parsed.tools_used)
        ? parsed.tools_used.map(
            (t: { name?: unknown; outcome?: unknown; result_summary?: unknown }) => ({
              name: String(t.name ?? "unknown"),
              outcome: validOutcomes.includes(String(t.outcome))
                ? (String(t.outcome) as "success" | "partial" | "failed")
                : "success",
              result_summary: String(t.result_summary ?? "").slice(0, 200),
            }),
          )
        : [],
      accomplished: Array.isArray(parsed.accomplished)
        ? parsed.accomplished.filter((a: unknown) => typeof a === "string")
        : [],
      remaining: Array.isArray(parsed.remaining)
        ? parsed.remaining.filter((r: unknown) => typeof r === "string")
        : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r: unknown) => typeof r === "string")
        : [],
      generated_at: new Date().toISOString(),
      message_count: messageCount,
    };
  } catch {
    return buildStructuredFallback(conversation, messageCount);
  }
}

/**
 * Produce a structured summary via LLM, with fallback to heuristic extraction.
 * @param rawPrompt - Conversation text
 * @param conversation - Parsed conversation data
 * @param chatId - Chat ID for logging
 * @param messageCount - Total message count
 * @returns StructuredSubAgentSummary
 */
async function summarizeStructured(
  rawPrompt: string,
  conversation: Array<{ role: string; text: string; toolNames: string[] }>,
  chatId: string,
  messageCount: number,
): Promise<StructuredSubAgentSummary> {
  try {
    const { modelId, providerUrl } = config.suggestion;
    const openAiKey = config.openai.apiKey;
    const openAiProxy = config.openai.openAIProxyURL || undefined;

    // Reason: Prefer SUGGESTION_MODEL_* config (vllm/ollama), fall back to OpenAI if available
    let resolvedModel: string;
    let resolvedBaseURL: string | undefined;
    let resolvedApiKey: string;

    if (modelId && providerUrl) {
      resolvedModel = modelId;
      resolvedBaseURL = providerUrl;
      resolvedApiKey = openAiKey || "no-key-required";
    } else if (openAiKey) {
      resolvedModel = "gpt-4o-mini";
      resolvedBaseURL = openAiProxy;
      resolvedApiKey = openAiKey;
    } else {
      logger.warn(
        "[subAgentSummary] No suggestion model or OpenAI key configured, using fallback",
        { chatId },
      );
      return buildStructuredFallback(conversation, messageCount);
    }

    const openai = createConfiguredOpenAI(resolvedApiKey, resolvedBaseURL);

    const { text } = await generateText({
      model: openai(resolvedModel),
      system: STRUCTURED_SUMMARY_PROMPT,
      prompt: rawPrompt,
      abortSignal: AbortSignal.timeout(60_000),
    });

    const trimmed = text.trim();
    if (!trimmed) {
      logger.warn("[subAgentSummary] LLM returned empty, using fallback", {
        chatId,
      });
      return buildStructuredFallback(conversation, messageCount);
    }

    return parseStructuredSummary(trimmed, conversation, messageCount);
  } catch (error) {
    logger.error("[subAgentSummary] Structured summarization failed, using fallback", {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
    return buildStructuredFallback(conversation, messageCount);
  }
}

/**
 * Format a structured summary (or legacy string) into markdown for prompt injection.
 * Handles backward compatibility with old string-format summaries.
 * @param summary - Either a StructuredSubAgentSummary object or a legacy string
 * @param agentName - Display name of the sub-agent
 * @returns Formatted markdown string
 */
export function formatSummaryForPrompt(
  summary: StructuredSubAgentSummary | string,
  agentName: string,
): string {
  if (typeof summary === "string") {
    return `## ${agentName}\n${summary}`;
  }

  const lines: string[] = [`## ${agentName}`];
  lines.push(
    `**Status**: ${summary.status} (confidence: ${(summary.confidence * 100).toFixed(0)}%)`,
  );
  lines.push(`**Task**: ${summary.task_description}`);

  if (summary.key_findings.length > 0) {
    lines.push("**Key Findings**:");
    summary.key_findings.forEach((f) => lines.push(`- ${f}`));
  }

  if (summary.tools_used.length > 0) {
    lines.push("**Tools Used**:");
    summary.tools_used.forEach((t) =>
      lines.push(`- ${t.name}: ${t.outcome} — ${t.result_summary}`),
    );
  }

  if (summary.accomplished.length > 0) {
    lines.push("**Accomplished**:");
    summary.accomplished.forEach((a) => lines.push(`- ${a}`));
  }

  if (summary.remaining.length > 0) {
    lines.push("**Remaining**:");
    summary.remaining.forEach((r) => lines.push(`- ${r}`));
  }

  if (summary.recommendations.length > 0) {
    lines.push("**Recommendations for you**:");
    summary.recommendations.forEach((r) => lines.push(`- ${r}`));
  }

  return lines.join("\n");
}

/**
 * Summarize a sub-agent chat's conversation and cache on its own lastContext.
 * Called after each message in a sub-agent chat (type: "sub-agent").
 * @param chatId - The sub-agent chat ID
 * @returns Summary string (formatted markdown) or empty string if no messages
 */
export async function summarizeSubAgentChat(chatId: string): Promise<string> {
  logger.info("[subAgentSummary] summarizeSubAgentChat called", { chatId });

  // Reason: Defensive check — this function should only summarize sub-agent chats
  // (type: "sub-agent"), not the parent/main chat. If called with the wrong ID,
  // skip to avoid overwriting the main chat's summary with incorrect data.
  const chatRecord = await Chat.get({ id: chatId });
  if (chatRecord && chatRecord.type !== "sub-agent") {
    logger.warn(
      "[subAgentSummary] summarizeSubAgentChat called with non-sub-agent chat, skipping",
      { chatId, type: chatRecord.type },
    );
    return "";
  }

  // ── Step 1: Load all messages from this sub-agent chat ──
  const allMessages = await Message.getByChatId({ chatId });

  if (!allMessages || allMessages.length === 0) {
    logger.info("[subAgentSummary] No messages in sub-agent chat", { chatId });
    return "";
  }

  // ── Step 2: Extract conversation data ──
  const conversation = allMessages.map((msg) => {
    const parts =
      (msg.parts as Array<{ type: string; text?: string; toolName?: string }>) ||
      [];
    const { text, toolNames } = extractTextFromParts(parts);
    const truncatedText =
      text.length > MAX_RAW_CHARS ? `${text.slice(0, MAX_RAW_CHARS)}...` : text;

    return { role: msg.role, text: truncatedText, toolNames };
  });

  // ── Step 3: Build raw prompt ──
  const rawPrompt = conversation
    .map((m) => {
      let block = `${m.role === "user" ? "User" : "Assistant"}:\n${m.text}`;
      if (m.toolNames.length > 0) {
        block += `\nTools used: ${m.toolNames.join(", ")}`;
      }
      return block;
    })
    .join("\n---\n");

  // ── Step 4: Summarize with structured format ──
  const structuredSummary = await summarizeStructured(
    rawPrompt,
    conversation,
    chatId,
    allMessages.length,
  );

  // ── Step 5: Cache structured summary on this sub-agent chat's lastContext ──
  try {
    const freshRecord = await Chat.get({ id: chatId });
    if (!freshRecord) {
      logger.warn("[subAgentSummary] Sub-agent chat not found, cannot cache", {
        chatId,
      });
      return formatSummaryForPrompt(structuredSummary, "Sub-Agent");
    }
    const existingContext =
      (freshRecord.lastContext as Record<string, unknown>) || {};
    await updateChatLastContextById({
      chatId,
      context: { ...existingContext, subAgentSummary: structuredSummary },
    });
    logger.info("[subAgentSummary] Sub-agent chat structured summary cached", {
      chatId,
      status: structuredSummary.status,
      confidence: structuredSummary.confidence,
      messageCount: allMessages.length,
    });
  } catch (error) {
    logger.warn("[subAgentSummary] Failed to cache sub-agent chat summary", {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return formatSummaryForPrompt(structuredSummary, "Sub-Agent");
}

/**
 * Collect summaries from all sub-agent chats related to a main chat.
 * Looks at messages in the main chat with metadata.subAgent=true to find
 * which sub-agent assistantIds were used, then reads their cached summaries.
 * @param mainChatId - The main chat ID (type: "chat")
 * @returns Combined summary string or empty string
 */
export async function getSubAgentSummary(mainChatId: string): Promise<string> {
  logger.info("[subAgentSummary] getSubAgentSummary called", { mainChatId });

  // ── Step 0: Validate this is a main chat ──
  const chatRecord = await Chat.get({ id: mainChatId });
  if (!chatRecord) {
    logger.warn("[subAgentSummary] Chat not found", { mainChatId });
    return "";
  }
  if (chatRecord.type !== "chat") {
    logger.info("[subAgentSummary] Skipping non-chat type", {
      mainChatId,
      type: chatRecord.type,
    });
    return "";
  }

  // ── Step 1: Check cache on main chat ──
  const lastContext = chatRecord.lastContext as Record<string, unknown> | null;
  if (lastContext?.["subAgentSummary"]) {
    const cached = lastContext["subAgentSummary"];
    // Reason: Handle both legacy string format and new structured format
    if (typeof cached === "string") {
      logger.info("[subAgentSummary] Using cached combined summary (legacy string)", {
        mainChatId,
        summaryLength: cached.length,
      });
      return cached;
    }
    if (typeof cached === "object" && cached !== null) {
      // Reason: Cached combined summary is already formatted markdown from previous run
      logger.info("[subAgentSummary] Using cached combined summary (structured)", {
        mainChatId,
      });
      return formatSummaryForPrompt(
        cached as StructuredSubAgentSummary,
        "Sub-Agent",
      );
    }
  }

  // ── Step 2: Read sub-agent sessions from parent's lastContext ──
  // Reason: Use the session registry (parent-scoped) instead of a global
  // assistantId query. This avoids cross-contamination in multi-tenant
  // environments where different parent chats may share the same assistantId.
  const subAgentSessions =
    (lastContext?.["subAgentSessions"] as SubAgentSessionInfo[]) || [];

  const summaryParts: string[] = [];

  if (subAgentSessions.length > 0) {
    // Primary path: use session registry (parent-scoped, no global query)
    logger.info("[subAgentSummary] Using session registry for lookup", {
      mainChatId,
      sessionCount: subAgentSessions.length,
    });

    for (const session of subAgentSessions) {
      try {
        const subAgentChat = await Chat.get({ id: session.sessionId });
        if (!subAgentChat) continue;

        const subContext = subAgentChat.lastContext as Record<
          string,
          unknown
        > | null;
        const cachedSummary = subContext?.["subAgentSummary"];

        if (cachedSummary) {
          summaryParts.push(
            formatSummaryForPrompt(
              cachedSummary as StructuredSubAgentSummary | string,
              session.agentName || "Sub-Agent",
            ),
          );
        }
      } catch (error) {
        logger.warn(
          "[subAgentSummary] Failed to read sub-agent summary by sessionId",
          {
            sessionId: session.sessionId,
            error: error instanceof Error ? error.message : String(error),
          },
        );
      }
    }
  } else {
    // Legacy fallback: scan messages for sessionId, then direct lookup
    // Reason: Older chats may not have lastContext.subAgentSessions yet.
    // Use sessionId from message metadata to look up sub-agent chats directly,
    // avoiding the old global assistantId query.
    const allMessages = await Message.getByChatId({ chatId: mainChatId });
    if (allMessages) {
      const seen = new Set<string>();
      for (const msg of allMessages) {
        const meta = msg.metadata as Record<string, unknown> | null;
        if (meta?.["subAgent"] === true && meta?.["sessionId"]) {
          const sessionId = meta["sessionId"] as string;
          if (seen.has(sessionId)) continue;
          seen.add(sessionId);
          const agentName = (meta["agentName"] as string) || "Sub-Agent";
          try {
            const subAgentChat = await Chat.get({ id: sessionId });
            if (!subAgentChat) continue;
            const subContext = subAgentChat.lastContext as Record<
              string,
              unknown
            > | null;
            const cachedSummary = subContext?.["subAgentSummary"];
            if (cachedSummary) {
              summaryParts.push(
                formatSummaryForPrompt(
                  cachedSummary as StructuredSubAgentSummary | string,
                  agentName,
                ),
              );
            }
          } catch (err) {
            logger.warn("[subAgentSummary] Failed to load session summary, skipping", {
              mainChatId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }
  }

  if (summaryParts.length === 0) {
    logger.info("[subAgentSummary] No sub-agent summaries found", {
      mainChatId,
    });
    return "";
  }

  const combined = summaryParts.join("\n\n");

  // ── Step 4: Cache combined summary on main chat ──
  try {
    const existingContext =
      (chatRecord.lastContext as Record<string, unknown>) || {};
    await updateChatLastContextById({
      chatId: mainChatId,
      context: { ...existingContext, subAgentSummary: combined },
    });
    logger.info("[subAgentSummary] Combined summary cached on main chat", {
      mainChatId,
      summaryLength: combined.length,
      agentCount: summaryParts.length,
    });
  } catch (error) {
    logger.warn("[subAgentSummary] Failed to cache combined summary", {
      mainChatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return combined;
}

/**
 * Invalidate the cached sub-agent summary for a chat.
 * Works for both main chats and sub-agent chats.
 * @param chatId - Chat session ID
 */
export async function invalidateSubAgentSummaryCache(
  chatId: string,
): Promise<void> {
  try {
    const chatRecord = await Chat.get({ id: chatId });
    if (!chatRecord) return;

    const existingContext =
      (chatRecord.lastContext as Record<string, unknown>) || {};
    if (!existingContext["subAgentSummary"]) return; // nothing to invalidate

    const { subAgentSummary: _, ...rest } = existingContext;
    await updateChatLastContextById({ chatId, context: rest });
    logger.debug("Sub-agent summary cache invalidated", {
      chatId,
      type: chatRecord.type,
    });
  } catch (error) {
    logger.warn("Failed to invalidate sub-agent summary cache", {
      chatId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
