/**
 * Session Module
 * Multi-session architecture for agent orchestration.
 */

export { SessionBus } from "./bus";
export type { SessionEvent, SessionEventType } from "./bus";

export { SessionManager } from "./session";
export type { SessionInfo, SessionStatus, SessionAgentConfig } from "./session";

// executeSubAgent + related types moved to @/ee/orchestrator/session/sub-agent-executor.
// Orchestrator code imports from there directly; core code does not need them.
