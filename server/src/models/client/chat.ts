/**
 * Chat namespace
 * Schemas + business logic + DB queries for chat management
 * Follows OpenCode's functional namespace pattern
 */

import { z } from "zod";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { fn } from "@/lib/fn";
import { getDb } from "@/database/postgres";
import { chat, message, vote } from "@/database/pgSchema";
import { ChatSDKError } from "@/lib/chatSdkError";
import logger from "@/lib/logger";

export namespace Chat {
  // ── Types ──────────────────────────────────────────
  export type Info = typeof chat.$inferSelect;

  export const Visibility = z.enum(["public", "private"]);
  export type Visibility = z.infer<typeof Visibility>;

  // ── Private ────────────────────────────────────────
  function throwDbError(operation: string, error: unknown): never {
    const cause = error instanceof Error ? error.message : undefined;
    logger.error(`[Chat] ${operation}`, {
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

  export const ChatType = z.enum(["chat", "sub-agent"]);
  export type ChatType = z.infer<typeof ChatType>;

  export const create = fn(
    z.object({
      id: z.string().uuid(),
      userId: z.string().uuid(),
      title: z.string(),
      visibility: Visibility,
      assistantId: z.string().nullable().optional(),
      organizationId: z.string().nullable().optional(),
      type: ChatType.optional(),
    }),
    async (input) => {
      const db = getDb();
      try {
        await db.insert(chat).values({
          id: input.id,
          createdAt: new Date(),
          userId: input.userId,
          title: input.title,
          visibility: input.visibility,
          assistantId: input.assistantId ?? null,
          organizationId: input.organizationId ?? null,
          type: input.type ?? "chat",
        });
      } catch (error) {
        throwDbError("Failed to create chat", error);
      }
    },
  );

  export const get = fn(
    z.object({ id: z.string().uuid() }),
    async (input): Promise<Info | null> => {
      const db = getDb();
      try {
        const [result] = await db
          .select()
          .from(chat)
          .where(eq(chat.id, input.id));
        return result ?? null;
      } catch (error) {
        throwDbError("Failed to get chat", error);
      }
    },
  );

  export const list = fn(
    z.object({
      userId: z.string().uuid(),
      organizationId: z.string().nullable().optional(),
      limit: z.number().int().positive().default(10),
      startingAfter: z.string().uuid().nullable().optional(),
      endingBefore: z.string().uuid().nullable().optional(),
    }),
    async (input) => {
      const db = getDb();
      try {
        const extendedLimit = input.limit + 1;

        const baseConditions = input.organizationId
          ? and(
              eq(chat.userId, input.userId),
              eq(chat.organizationId, input.organizationId),
              eq(chat.type, "chat"),
            )
          : and(
              eq(chat.userId, input.userId),
              eq(chat.type, "chat"),
            );

        const query = (whereCondition?: SQL<any>) =>
          db
            .select()
            .from(chat)
            .where(
              whereCondition
                ? and(whereCondition, baseConditions)
                : baseConditions,
            )
            .orderBy(desc(chat.createdAt))
            .limit(extendedLimit);

        let filteredChats: Info[] = [];

        if (input.startingAfter) {
          const [cursor] = await db
            .select()
            .from(chat)
            .where(eq(chat.id, input.startingAfter))
            .limit(1);
          if (!cursor) {
            throw new ChatSDKError(
              "not_found:database",
              `Chat with id ${input.startingAfter} not found`,
            );
          }
          filteredChats = await query(gt(chat.createdAt, cursor.createdAt));
        } else if (input.endingBefore) {
          const [cursor] = await db
            .select()
            .from(chat)
            .where(eq(chat.id, input.endingBefore))
            .limit(1);
          if (!cursor) {
            throw new ChatSDKError(
              "not_found:database",
              `Chat with id ${input.endingBefore} not found`,
            );
          }
          filteredChats = await query(lt(chat.createdAt, cursor.createdAt));
        } else {
          filteredChats = await query();
        }

        const hasMore = filteredChats.length > input.limit;
        return {
          chats: hasMore
            ? filteredChats.slice(0, input.limit)
            : filteredChats,
          hasMore,
        };
      } catch (error) {
        if (error instanceof ChatSDKError) throw error;
        throwDbError("Failed to list chats", error);
      }
    },
  );

  export const update = fn(
    z.object({
      id: z.string().uuid(),
      assistantId: z.string().nullable().optional(),
      visibility: Visibility.optional(),
    }),
    async (input) => {
      const db = getDb();
      try {
        if (input.assistantId !== undefined) {
          await db
            .update(chat)
            .set({ assistantId: input.assistantId })
            .where(eq(chat.id, input.id));
        }
        if (input.visibility) {
          await db
            .update(chat)
            .set({ visibility: input.visibility })
            .where(eq(chat.id, input.id));
        }
      } catch (error) {
        throwDbError("Failed to update chat", error);
      }
    },
  );

  export const remove = fn(
    z.object({ id: z.string().uuid() }),
    async (input) => {
      const db = getDb();
      try {
        // Cascade: votes → messages → stream → chat
        await db.delete(vote).where(eq(vote.chatId, input.id));
        await db.delete(message).where(eq(message.chatId, input.id));
        try {
          await db.execute(
            sql`DELETE FROM "Stream" WHERE "chatId" = ${input.id}`,
          );
        } catch {
          // Stream table may not exist
        }
        const [deleted] = await db
          .delete(chat)
          .where(eq(chat.id, input.id))
          .returning();
        return deleted ?? null;
      } catch (error) {
        throwDbError("Failed to delete chat", error);
      }
    },
  );

  export const removeAll = fn(
    z.object({
      userId: z.string().uuid(),
      organizationId: z.string().nullable().optional(),
    }),
    async (input) => {
      const db = getDb();
      try {
        const whereCondition = input.organizationId
          ? and(
              eq(chat.userId, input.userId),
              eq(chat.organizationId, input.organizationId),
            )
          : eq(chat.userId, input.userId);

        const userChats = await db
          .select({ id: chat.id })
          .from(chat)
          .where(whereCondition);

        if (userChats.length === 0) return { deletedCount: 0 };

        const chatIds = userChats.map((c) => c.id);

        // Cascade: votes → messages → stream → chats
        await db.delete(vote).where(inArray(vote.chatId, chatIds));
        await db.delete(message).where(inArray(message.chatId, chatIds));
        try {
          await db.execute(
            sql`DELETE FROM "Stream" WHERE "chatId" IN (${sql.join(
              chatIds.map((id) => sql`${id}`),
              sql`, `,
            )})`,
          );
        } catch {
          // Stream table may not exist
        }

        const deletedChats = await db
          .delete(chat)
          .where(whereCondition)
          .returning();

        return { deletedCount: deletedChats.length };
      } catch (error) {
        throwDbError("Failed to delete all chats", error);
      }
    },
  );

  export const updateStatus = fn(
    z.object({
      id: z.string().uuid(),
      status: z.enum(["idle", "processing"]),
    }),
    async (input) => {
      const db = getDb();
      try {
        await db
          .update(chat)
          .set({ status: input.status })
          .where(eq(chat.id, input.id));
      } catch (error) {
        throwDbError("Failed to update chat status", error);
      }
    },
  );

  export const updateTitle = fn(
    z.object({
      id: z.string().uuid(),
      title: z.string().min(1).max(200),
    }),
    async (input) => {
      const db = getDb();
      try {
        await db
          .update(chat)
          .set({ title: input.title })
          .where(eq(chat.id, input.id));
      } catch (error) {
        throwDbError("Failed to update chat title", error);
      }
    },
  );
}
