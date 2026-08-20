/**
 * Chat Status Emitter
 *
 * Cross-instance pub/sub for notifying SSE listeners when a chat's processing
 * status changes. Backed by the shared Bus (Redis Pub/Sub). Public API is
 * unchanged from the pre-refactor EventEmitter implementation so callers
 * don't need to be updated.
 */

import { z } from "zod";
import { Bus, BusEvent } from "@/bus";
import logger from "@/lib/logger";

const STALE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const ChatStatusEvent = BusEvent.define(
  "chat.status",
  z.object({
    chatId: z.string(),
    status: z.string(),
  }),
);

class ChatStatusEmitter {
  /**
   * Emit a status change event for a specific chat.
   * Fire-and-forget from the caller's perspective; publish errors are logged
   * internally so we don't perturb the chat request flow.
   */
  emit(chatId: string, status: string): void {
    Bus.publish(ChatStatusEvent, { chatId, status }).catch((err) =>
      logger.error("chatStatusEmitter publish failed", {
        chatId,
        status,
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    logger.debug("Chat status emitted", { chatId, status });
  }

  /**
   * Subscribe to status changes for a specific chat.
   * Returns an unsubscribe function for cleanup.
   */
  subscribe(
    chatId: string,
    callback: (status: string) => void,
  ): () => void {
    logger.info("chatStatusEmitter: subscribed", { chatId });
    const unsubscribe = Bus.subscribe(ChatStatusEvent, (event) => {
      const match = event.properties.chatId === chatId;
      // Reason: every instance receives every chat.status event from the bus.
      // Each subscriber filters by its own chatId. Logging match/skip lets us
      // verify cross-instance delivery (event reached this instance) and that
      // the filter is correct (only the right subscribers fire the callback).
      logger.debug("chatStatusEmitter: event received", {
        subscribedChatId: chatId,
        incomingChatId: event.properties.chatId,
        status: event.properties.status,
        match,
      });
      if (match) {
        callback(event.properties.status);
      }
    });
    return () => {
      logger.info("chatStatusEmitter: unsubscribed", { chatId });
      unsubscribe();
    };
  }

  /**
   * Stale timeout duration in milliseconds.
   * Used by SSE endpoints to auto-close stale connections.
   */
  get staleTimeoutMs(): number {
    return STALE_TIMEOUT_MS;
  }
}

export const chatStatusEmitter = new ChatStatusEmitter();
