/**
 * Session Bus
 *
 * Per-request, in-process event bus for inter-session communication.
 *
 * Each incoming chat request creates its own SessionBus instance; parent
 * sessions subscribe to child session events for real-time progress, and
 * the bus is disposed at the end of the request lifecycle.
 *
 * Implementation note: kept on Node's EventEmitter (sync, in-process). This
 * matches OpenCode's pattern where the Bus is backed by `PubSub.unbounded`
 * inside one process — the parent agent and its sub-agents always run in the
 * same process, so a Redis round-trip would only add latency and create a
 * dispose/event race. Cross-instance pub/sub stays reserved for the global
 * `Bus` (chat.status) where it's actually needed.
 */

import { EventEmitter } from "events";
import logger from "@/lib/logger";

/**
 * Event types published on the session bus
 */
export type SessionEventType =
  | "session.created"
  | "session.completed"
  | "session.error"
  | "message.text-delta"
  | "message.reasoning-delta"
  | "message.tool-call"
  | "message.tool-result"
  | "message.error"
  | "artifact.data"
  | "flow-editor.open";

/**
 * A session event published on the bus
 */
export interface SessionEvent {
  /** Child session ID that produced this event */
  sessionID: string;
  /** Parent session ID (if this is a child session event) */
  parentSessionID?: string | undefined;
  /** Human-readable agent name (e.g. "City Weather Agent") */
  agentName: string;
  /** Event type */
  type: SessionEventType;
  /** Event-specific payload */
  data: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
}

type EventHandler = (event: SessionEvent) => void;

const ALL_EVENTS_CHANNEL = "__all__";

/**
 * Per-request event bus for session communication.
 *
 * Usage:
 * ```ts
 * const bus = new SessionBus();
 *
 * // Subscribe to all events (for SSE forwarding)
 * const unsub = bus.subscribeAll((event) => {
 *   writer.write(event);
 * });
 *
 * // Publish from child session
 * bus.publish({
 *   sessionID: childId,
 *   agentName: "City Weather Agent",
 *   type: "message.text-delta",
 *   data: { text: "Hello" },
 *   timestamp: Date.now(),
 * });
 *
 * // Cleanup
 * unsub();
 * bus.dispose();
 * ```
 */
export class SessionBus {
  private emitter = new EventEmitter();
  private disposed = false;

  constructor() {
    // Allow many concurrent SSE-style subscriptions without Node warnings.
    this.emitter.setMaxListeners(50);
  }

  /**
   * Publish an event to all subscribers.
   */
  publish(event: SessionEvent): void {
    if (this.disposed) {
      logger.warn("Attempted to publish on disposed SessionBus", {
        type: event.type,
        sessionID: event.sessionID,
      });
      return;
    }
    this.emitter.emit(event.type, event);
    this.emitter.emit(ALL_EVENTS_CHANNEL, event);
  }

  /**
   * Subscribe to a specific event type
   * @returns Unsubscribe function
   */
  subscribe(type: SessionEventType, handler: EventHandler): () => void {
    if (this.disposed) return () => {};
    this.emitter.on(type, handler);
    return () => {
      this.emitter.off(type, handler);
    };
  }

  /**
   * Subscribe to ALL events (useful for forwarding to SSE stream)
   * @returns Unsubscribe function
   */
  subscribeAll(handler: EventHandler): () => void {
    if (this.disposed) return () => {};
    this.emitter.on(ALL_EVENTS_CHANNEL, handler);
    return () => {
      this.emitter.off(ALL_EVENTS_CHANNEL, handler);
    };
  }

  /**
   * Clean up all listeners and mark bus as disposed.
   */
  dispose(): void {
    this.disposed = true;
    this.emitter.removeAllListeners();
  }
}
