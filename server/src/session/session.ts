/**
 * Session Manager
 * Manages session hierarchy for multi-agent orchestration.
 * Inspired by OpenCode's Session module with parent-child linking.
 *
 * Each request creates a SessionManager that tracks the parent session
 * and any child sessions spawned for sub-agents. Sessions are in-memory
 * for the request lifecycle (no DB persistence needed for session state).
 */

import { randomUUID } from "crypto";
import logger from "@/lib/logger";
import { SessionBus } from "./bus";

/**
 * Agent configuration attached to a session
 */
export interface SessionAgentConfig {
  assistant_id: string;
  name: string;
  instructions: string;
  model_id?: string;
  provider_id?: string;
  temperature?: number;
  workflow_function_call?: string[];
}

/**
 * Session status
 */
export type SessionStatus = "pending" | "running" | "completed" | "error";

/**
 * Session info - represents one agent session in the hierarchy
 */
export interface SessionInfo {
  /** Unique session ID */
  id: string;
  /** Parent session ID (undefined for root session) */
  parentID?: string;
  /** Agent name (e.g. "Weather Station" or "City Weather Agent") */
  agentName: string;
  /** Agent configuration */
  agentConfig: SessionAgentConfig;
  /** Current status */
  status: SessionStatus;
  /** Creation timestamp */
  createdAt: number;
  /** Completion timestamp */
  completedAt?: number;
}

/**
 * Session Manager - manages parent-child session hierarchy.
 *
 * Usage:
 * ```ts
 * const bus = new SessionBus();
 * const manager = new SessionManager(bus);
 *
 * // Create parent session
 * const parent = manager.createSession({
 *   agentName: "Weather Station",
 *   agentConfig: { ... },
 * });
 *
 * // Create child session for sub-agent
 * const child = manager.createChildSession(parent.id, {
 *   agentName: "City Weather Agent",
 *   agentConfig: { ... },
 * });
 *
 * // Track progress
 * manager.updateStatus(child.id, "running");
 * manager.updateStatus(child.id, "completed");
 *
 * // Cleanup
 * manager.dispose();
 * ```
 */
export class SessionManager {
  private sessions = new Map<string, SessionInfo>();
  private bus: SessionBus;

  constructor(bus: SessionBus) {
    this.bus = bus;
  }

  /**
   * Create a root session (for the parent/team_lead agent)
   */
  createSession(params: {
    agentName: string;
    agentConfig: SessionAgentConfig;
    id?: string;
  }): SessionInfo {
    const session: SessionInfo = {
      id: params.id || randomUUID(),
      agentName: params.agentName,
      agentConfig: params.agentConfig,
      status: "pending",
      createdAt: Date.now(),
    };

    this.sessions.set(session.id, session);

    logger.debug("Session created", {
      sessionID: session.id,
      agent: session.agentName,
    });

    return session;
  }

  /**
   * Create a child session linked to a parent
   */
  createChildSession(
    parentID: string,
    params: {
      agentName: string;
      agentConfig: SessionAgentConfig;
    },
  ): SessionInfo {
    const parent = this.sessions.get(parentID);
    if (!parent) {
      logger.warn("Parent session not found, creating orphan child", {
        parentID,
        childAgent: params.agentName,
      });
    }

    const session: SessionInfo = {
      id: randomUUID(),
      parentID,
      agentName: params.agentName,
      agentConfig: params.agentConfig,
      status: "pending",
      createdAt: Date.now(),
    };

    this.sessions.set(session.id, session);

    // Publish session created event
    this.bus.publish({
      sessionID: session.id,
      parentSessionID: parentID,
      agentName: session.agentName,
      type: "session.created",
      data: {
        assistant_id: params.agentConfig.assistant_id,
      },
      timestamp: Date.now(),
    });

    logger.debug("Child session created", {
      sessionID: session.id,
      parentID,
      agent: session.agentName,
    });

    return session;
  }

  /**
   * Register an existing session in the in-memory store.
   * Used when reusing a previously created sub-agent session across request
   * boundaries (SessionManager is per-request, so the old session won't exist).
   * @param sessionId - The existing session ID to reuse
   * @param parentID - Parent session ID
   * @param params - Agent name and config
   * @returns The registered SessionInfo
   */
  registerSession(
    sessionId: string,
    parentID: string,
    params: {
      agentName: string;
      agentConfig: SessionAgentConfig;
    },
  ): SessionInfo {
    const session: SessionInfo = {
      id: sessionId,
      parentID,
      agentName: params.agentName,
      agentConfig: params.agentConfig,
      status: "pending",
      createdAt: Date.now(),
    };

    this.sessions.set(session.id, session);

    // Reason: Publish session.created so chat-processor's accumulator picks it up
    // and tracks this sub-agent's streaming output.
    this.bus.publish({
      sessionID: session.id,
      parentSessionID: parentID,
      agentName: session.agentName,
      type: "session.created",
      data: {
        assistant_id: params.agentConfig.assistant_id,
      },
      timestamp: Date.now(),
    });

    logger.debug("Existing session registered", {
      sessionID: session.id,
      parentID,
      agent: session.agentName,
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): SessionInfo | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get all child sessions of a parent
   */
  getChildSessions(parentID: string): SessionInfo[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.parentID === parentID,
    );
  }

  /**
   * Update session status
   */
  updateStatus(id: string, status: SessionStatus): void {
    const session = this.sessions.get(id);
    if (!session) {
      logger.warn("Cannot update status: session not found", { id, status });
      return;
    }

    session.status = status;
    if (status === "completed" || status === "error") {
      session.completedAt = Date.now();
    }

    // Publish status change event
    const eventType =
      status === "completed"
        ? "session.completed"
        : status === "error"
          ? "session.error"
          : undefined;

    if (eventType) {
      this.bus.publish({
        sessionID: session.id,
        parentSessionID: session.parentID,
        agentName: session.agentName,
        type: eventType,
        data: { status },
        timestamp: Date.now(),
      });
    }

    logger.debug("Session status updated", {
      sessionID: id,
      agent: session.agentName,
      status,
    });
  }

  /**
   * List all sessions
   */
  listSessions(): SessionInfo[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Clean up all sessions
   */
  dispose(): void {
    this.sessions.clear();
  }
}
