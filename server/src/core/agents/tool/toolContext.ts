/**
 * Tool Context Management
 * Provides request-scoped context for tools using AsyncLocalStorage.
 * Each concurrent request gets its own isolated context, preventing
 * cross-request contamination of access tokens, assistant IDs, etc.
 */

import { AsyncLocalStorage } from "node:async_hooks";

export interface ToolContext {
  xAccessToken?: string;
  assistant_id?: string;
  assistantData?: any;
  structured_board_id?: string;
  unstructured_board_id?: string;
  investment_board_id?: string;
  board_id?: string;
  board_item?: string;
  conversation_id?: string;
  news_board_id?: string;
  session_id?: string;
  organization_id?: string;
  thread_id?: string;
  /** Imbrace user id (from chat request body). Forwarded as `x-user-id` to
   * the data-board service, which requires it for write authorization. */
  user_id?: string;
  // Model configuration for subtask execution
  model_id?: string;
  provider_id?: string;
}

// AsyncLocalStorage for per-request isolation
const asyncToolContext = new AsyncLocalStorage<ToolContext>();

// Legacy global fallback for code paths not yet migrated (e.g. ai-agent.ts)
let globalToolContext: ToolContext = {};

/**
 * Run a function with an isolated tool context.
 * All calls to getToolContext() within this async scope
 * will return this context, isolated from other concurrent requests.
 * @param context - The tool context for this request
 * @param fn - The function to execute within the isolated context
 * @returns The return value of fn
 */
export function runWithToolContext<T>(context: ToolContext, fn: () => T): T {
  return asyncToolContext.run({ ...context }, fn);
}

/**
 * Get current tool context.
 * Reads from AsyncLocalStorage if available (request-scoped),
 * otherwise falls back to the legacy global context.
 * @returns Current tool context
 */
export function getToolContext(): ToolContext {
  const store = asyncToolContext.getStore();
  if (store) {
    return { ...store };
  }
  return { ...globalToolContext };
}

/**
 * Set tool context with assistant data.
 * @deprecated Use runWithToolContext() for request-scoped isolation.
 * This function writes to a global variable and is NOT safe for concurrent requests.
 * Kept for legacy code paths (e.g. streamChatReply V1, ai-agent.ts).
 * @param context - The tool context to set globally
 */
export function setToolContext(context: ToolContext) {
  globalToolContext = { ...context };
}

/**
 * Get board ID for product data (uses structured board ID)
 */
export function getStructuredBoardId(): string | undefined {
  return getToolContext().structured_board_id;
}

/**
 * Get access token
 */
export function getAccessToken(): string | undefined {
  return getToolContext().xAccessToken;
}

/**
 * Get assistant ID
 */
export function getAssistantId(): string | undefined {
  return getToolContext().assistant_id;
}

/**
 * Get board ID for customer data API
 */
export function getBoardId(): string | undefined {
  return getToolContext().board_id;
}

/**
 * Get board item for customer data API
 */
export function getBoardItem(): string | undefined {
  return getToolContext().board_item;
}

/**
 * Get conversation ID
 */
export function getConversationId(): string | undefined {
  return getToolContext().conversation_id;
}

/**
 * Get session ID
 */
export function getSessionId(): string | undefined {
  return getToolContext().session_id;
}

/**
 * Get news board ID
 */
export function getNewsBoardId(): string | undefined {
  return getToolContext().news_board_id;
}

/**
 * Get investment board ID
 */
export function getInvestmentBoardId(): string | undefined {
  return getToolContext().investment_board_id;
}

/**
 * Get model ID for the current session
 */
export function getModelId(): string | undefined {
  const ctx = getToolContext();
  return ctx.model_id ?? ctx.assistantData?.model_id;
}

/**
 * Get provider ID for the current session
 */
export function getProviderId(): string | undefined {
  const ctx = getToolContext();
  return ctx.provider_id ?? ctx.assistantData?.provider_id;
}

/**
 * Get thread ID for the current session
 */
export function getThreadId(): string | undefined {
  return getToolContext().thread_id;
}

/**
 * Get organization ID
 */
export function getOrganizationId(): string | undefined {
  return getToolContext().organization_id;
}

/**
 * Get Imbrace user ID. Required header for the data-board service.
 */
export function getUserId(): string | undefined {
  return getToolContext().user_id;
}

/**
 * Get the Imbrace x-access-token for the current request. Used by tools
 * that hit upstream services authenticated via access-token (e.g. the
 * data-board service).
 */
export function getXAccessToken(): string | undefined {
  return getToolContext().xAccessToken;
}

/**
 * Clear tool context.
 * @deprecated Only clears the legacy global context.
 */
export function clearToolContext() {
  globalToolContext = {};
}
