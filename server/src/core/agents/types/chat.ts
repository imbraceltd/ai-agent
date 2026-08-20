/**
 * Chat Types
 * Defines the types for main chat agent processing
 * Follows the same pattern as subtask types for consistency
 */

import { z } from "zod";
import {
  ModelMessage,
  ToolSet,
  UserModelMessage,
  UIMessage as SDKUIMessage,
} from "ai";

/**
 * Chat status
 */
export type ChatStatus = "pending" | "streaming" | "completed" | "error";

/**
 * Chat context - required to run the main chat agent
 * Similar to SubtaskContext but for the primary agent
 */
export interface ChatContext {
  sessionID: string;
  messageID: string;
  organizationId: string;
  xAccessToken: string;
  userId: string;
  assistantId: string;
  threadId: string;
  /** Summary of prior sub-agent work for this chat, injected into system prompt */
  subAgentSummary?: string;
  /** Pre-fetched assistant settings. When provided, processors skip the extra getAssistantSettings call. */
  assistant?: Record<string, unknown>;
  /** Optional databoard scope id propagated from ChatInput; locks databoard tools to a single board. */
  boardId?: string;
}

/**
 * Persisted sub-agent session info for session continuation.
 * Stored in chat.lastContext.subAgentSessions so the main agent
 * knows which sub-agent sessions can be resumed with task_id.
 */
export interface SubAgentSessionInfo {
  /** The session ID (used as task_id for resumption) */
  sessionId: string;
  /** Sub-agent display name */
  agentName: string;
  /** Sub-agent assistant_id */
  assistantId: string;
  /** When this session was created */
  createdAt: string;
}

/**
 * Accumulated sub-agent data collected during streaming.
 * Used to persist sub-agent messages to the database after stream completion.
 */
export interface SubAgentAccumulated {
  agentName: string;
  sessionId: string;
  parentSessionId: string;
  assistantId?: string | undefined;
  text: string;
  toolCalls: Array<{ toolName: string; toolCallId: string; result?: unknown }>;
  status: "streaming" | "completed" | "error";
  startedAt: number;
  endedAt?: number;
  error?: string;
}

/**
 * Chat options - configuration for chat execution
 * Similar to SubtaskOptions
 */
export interface ChatOptions {
  maxSteps?: number;
  temperature?: number;
  streaming?: boolean;
  showThinkingProcess?: boolean;
  /** Max input token budget for messages. When set, older messages are dropped to fit within this limit. */
  maxInputTokens?: number;
  /** Accumulator for sub-agent data during streaming. Populated by chat-processor, read by onStreamFinish. */
  subAgentAccumulator?: Map<string, SubAgentAccumulated>;
  /**
   * Mutable container for captured token usage from the agent stream.
   * Populated by chat-processor during streaming; read by onStreamFinish in chatService.
   */
  usageCapture?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    /** Set to true by chat-processor when a ContextOverflowError is caught mid-stream. */
    needsCompaction?: boolean;
  };
  /**
   * Mutable container for an error surfaced during streaming.
   * Populated by chat-processor's onError; read by onStreamFinish in chatService
   * so the error text is persisted as the assistant message instead of an empty row.
   */
  errorCapture?: {
    errorText?: string;
  };
  /** Called when the UI message stream finishes. Used to persist assistant messages. */
  onStreamFinish?: (event: {
    messages: SDKUIMessage[];
    responseMessage: SDKUIMessage;
    isContinuation: boolean;
    isAborted: boolean;
  }) => Promise<void> | void;
}

/**
 * Chat input - the input for processing a chat request
 */
export interface ChatInput {
  id: string;
  messages: UserModelMessage[] | ModelMessage[];
  organizationId: string;
  assistant_id: string;
  userId?: string;
  /**
   * True when this submit was triggered by the SDK auto-resubmit after the
   * client called addToolResult() on a need_approval tool. The trailing
   * messages already carry APPROVAL.YES/APPROVAL.NO output, so the server
   * should skip the DB history reload and act directly on those messages.
   */
  isToolApproval?: boolean;
  /**
   * Optional databoard scope id. When present, the chat is locked to this
   * board: databoard tools have `board_id` hardcoded and `create_board` is
   * hidden from the toolset. Comes from `?databoardId=…` on the FE URL.
   */
  boardId?: string;
  /**
   * Optional per-request override for the model id. When set, takes precedence
   * over `assistant.model_id`. Must be paired with `providerId` so the model
   * resolver knows whether to look it up via the system provider or a custom
   * provider config registered on the Imbrace platform.
   */
  modelId?: string;
  /**
   * Optional per-request override for the provider id. "system" uses Imbrace's
   * built-in providers; any other value is treated as a custom provider UUID
   * and resolved via `/api/v3/ai/providers/{providerId}`.
   */
  providerId?: string;
  /**
   * When true, non-streaming chat output is wrapped via `formatChatOutput`
   * (session header + <chat_result> block) so external connector consumers
   * can parse the session id alongside the reply. Mapped from the request
   * body field `"from-connector"`.
   */
  fromConnector?: boolean;
}

/**
 * Chat result - returned from chat execution
 * Similar to SubtaskResult
 */
export interface ChatResult {
  text: string;
  metadata: Record<string, unknown>;
  sessionId: string;
  success: boolean;
  error?: string | undefined;
  usage?:
    | {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      }
    | undefined;
}

/**
 * UI content part types for message handling
 */
export type UIContentPart =
  | { type: "text"; text: string }
  | { type: "file"; data: string; mediaType?: string; name?: string };

/**
 * UI message type for normalized message handling
 */
export type UIMessage = {
  role: "user" | "assistant" | "system";
  content?: UIContentPart[] | unknown;
};

/**
 * Agent tools configuration
 */
export interface AgentToolsConfig {
  allTools: ToolSet;
  mcpClient?: { close: () => Promise<void> } | null;
  cleanup: () => Promise<void>;
}

/**
 * Stream event types for chat processing
 */
export type ChatStreamEventType =
  | "text-delta"
  | "reasoning-delta"
  | "tool-call"
  | "tool-result"
  | "finish"
  | "error";

/**
 * Chat stream event
 */
export interface ChatStreamEvent {
  type: ChatStreamEventType;
  data: Record<string, unknown>;
}

/**
 * Default configuration values
 */
export const DEFAULT_CHAT_OPTIONS: Required<
  Omit<ChatOptions, "onStreamFinish" | "subAgentAccumulator" | "usageCapture" | "errorCapture" | "maxInputTokens">
> = {
  maxSteps: 50,
  temperature: 0.1,
  streaming: true,
  showThinkingProcess: false,
};
