/**
 * Message namespace
 * Part schemas + business logic + DB queries for message management
 * Follows OpenCode's functional namespace pattern
 */

import { z } from "zod";
import { and, asc, eq, gte, inArray } from "drizzle-orm";
import { fn } from "@/lib/fn";
import { getDb } from "@/database/postgres";
import { message, vote } from "@/database/pgSchema";
import { ChatSDKError } from "@/lib/chatSdkError";
import { generateUUID } from "@/database/pgUtils";
import logger from "@/lib/logger";

export namespace Message {
  // ── Types ──────────────────────────────────────────
  export type Info = typeof message.$inferSelect;

  // ── Schemas (User) ────────────────────────────

  export const TextPart = z.object({
    type: z.literal("text"),
    text: z.string().min(1).max(2000),
  });

  export const FilePart = z.object({
    type: z.literal("file"),
    mediaType: z.string(),
    name: z.string().min(1).max(100),
    url: z.string().url(),
  });

  export const UserPart = z.union([TextPart, FilePart]);

  // ── Part Schemas (Assistant) ───────────────────────

  export const AssistantTextPart = z.object({
    type: z.literal("text"),
    text: z.string(),
    providerMetadata: z.unknown().optional(),
    state: z.string().optional(),
  });

  export const StepStartPart = z.object({
    type: z.literal("step-start"),
  });

  export const ToolCallPart = z.object({
    type: z.literal("tool-call"),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.unknown(),
    state: z.string().optional(),
  });

  export const ToolResultPart = z.object({
    type: z.literal("tool-result"),
    toolCallId: z.string(),
    result: z.unknown(),
    isError: z.boolean().optional(),
  });

  export const ReasoningPart = z.object({
    type: z.literal("reasoning"),
    text: z.string(),
    providerMetadata: z.unknown().optional(),
  });

  export const SourcePart = z.object({
    type: z.literal("source"),
    source: z.unknown(),
  });

  export const MessageFilePart = z.object({
    type: z.literal("file"),
    mediaType: z.string(),
    url: z.string().optional(),
    data: z.string().optional(),
  });

  export const AssistantPart = z.union([
    AssistantTextPart,
    StepStartPart,
    ToolCallPart,
    ToolResultPart,
    ReasoningPart,
    SourcePart,
    MessageFilePart,
    z.object({ type: z.string() }).passthrough(),
  ]);

  // ── Private ────────────────────────────────────────
  function throwDbError(operation: string, error: unknown): never {
    const cause = error instanceof Error ? error.message : undefined;
    logger.error(`[Message] ${operation}`, {
      error: cause,
      stack: error instanceof Error ? error.stack : undefined,
      code:
        typeof error === "object" && error !== null && "code" in error
          ? (error as any).code
          : undefined,
    });
    throw new ChatSDKError(
      "bad_request:database",
      cause ? `${operation}: ${cause}` : operation,
    );
  }

  // ── Functions ──────────────────────────────────────

  export const create = fn(
    z.object({
      id: z.string().optional(),
      chatId: z.string().uuid(),
      role: z.enum(["user", "assistant"]),
      parts: z.array(z.any()),
      metadata: z.record(z.unknown()).nullable().optional(),
    }),
    async (input) => {
      const db = getDb();

      // Resolve message ID — normalize non-UUID IDs from upstream services
      let messageId: string;
      let parts = input.parts;

      if (!input.id) {
        messageId = generateUUID();
      } else {
        const isValidUUID = z.string().uuid().safeParse(input.id).success;
        messageId = isValidUUID ? input.id : generateUUID();
        if (!isValidUUID) {
          parts = [
            { type: "source", source: { upstreamMessageId: input.id } },
            ...parts,
          ];
        }
      }

      try {
        await db.insert(message).values({
          id: messageId,
          chatId: input.chatId,
          role: input.role,
          parts: parts as any,
          attachments: [],
          metadata: input.metadata ?? null,
          createdAt: new Date(),
        });
        return { id: messageId };
      } catch (error) {
        throwDbError("Failed to create message", error);
      }
    },
  );

  export const getById = fn(
    z.object({ id: z.string().uuid() }),
    async (input): Promise<Info | null> => {
      const db = getDb();
      try {
        const [result] = await db
          .select()
          .from(message)
          .where(eq(message.id, input.id));
        return result ?? null;
      } catch (error) {
        throwDbError("Failed to get message", error);
      }
    },
  );

  export const getByChatId = fn(
    z.object({ chatId: z.string().uuid() }),
    async (input) => {
      const db = getDb();
      try {
        return await db
          .select()
          .from(message)
          .where(eq(message.chatId, input.chatId))
          .orderBy(asc(message.createdAt));
      } catch (error) {
        throwDbError("Failed to get messages by chat id", error);
      }
    },
  );

  /**
   * Update an existing assistant/user message's parts. Used for HITL
   * approval continuation — the agent re-emits the same SDK-generated
   * messageId after a `tool-approval-request` is resolved, and the response
   * extends the original message (tool result + follow-up text). Without
   * this update path we'd insert a duplicate row with the same SDK id (PK
   * conflict) or a stale row with state="approval-requested" sticks around.
   */
  export const update = fn(
    z.object({
      id: z.string().uuid(),
      parts: z.array(z.any()),
      metadata: z.record(z.unknown()).nullable().optional(),
    }),
    async (input) => {
      const db = getDb();
      try {
        const result = await db
          .update(message)
          .set({
            parts: input.parts as any,
            ...(input.metadata !== undefined
              ? { metadata: input.metadata }
              : {}),
          })
          .where(eq(message.id, input.id))
          .returning({ id: message.id });
        return { id: result[0]?.id ?? input.id, updated: result.length > 0 };
      } catch (error) {
        throwDbError("Failed to update message", error);
      }
    },
  );

  export const deleteTrailing = fn(
    z.object({ messageId: z.string().uuid() }),
    async (input) => {
      const db = getDb();
      try {
        const msg = await getById({ id: input.messageId });
        if (!msg) {
          throw new ChatSDKError("not_found:chat", "Message not found");
        }

        const messagesToDelete = await db
          .select({ id: message.id })
          .from(message)
          .where(
            and(
              eq(message.chatId, msg.chatId),
              gte(message.createdAt, msg.createdAt),
            ),
          );

        const messageIds = messagesToDelete.map((m) => m.id);

        if (messageIds.length > 0) {
          await db
            .delete(vote)
            .where(
              and(
                eq(vote.chatId, msg.chatId),
                inArray(vote.messageId, messageIds),
              ),
            );
          await db
            .delete(message)
            .where(
              and(
                eq(message.chatId, msg.chatId),
                inArray(message.id, messageIds),
              ),
            );
        }

        return { chatId: msg.chatId, deletedCount: messageIds.length };
      } catch (error) {
        if (error instanceof ChatSDKError) throw error;
        throwDbError("Failed to delete trailing messages", error);
      }
    },
  );
}
