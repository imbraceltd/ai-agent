/**
 * PostgreSQL query functions (Drizzle ORM)
 * Adapted from imbrace-chat-bot/lib/db/queries.ts
 */

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  sql,
  type SQL,
} from "drizzle-orm";
import { getDb } from "./postgres";
import {
  type ArtifactKind,
  type Chat,
  type DBMessage,
  type Suggestion,
  type User,
  type VisibilityType,
  chat,
  document,
  message,
  suggestion,
  user,
  vote,
} from "./pgSchema";
import { generateHashedPassword, generateUUID } from "./pgUtils";
import { ChatSDKError } from "@/lib/chatSdkError";
import logger from "@/lib/logger";

function formatDbErrorCause(error: unknown): string | undefined {
  if (error instanceof Error) {
    if (error.message.includes("ECONNREFUSED")) {
      return "Database connection was refused. Ensure Postgres is running.";
    }
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string") {
      if (code === "42P01") {
        return "Database schema is missing (undefined_table). Run migrations.";
      }
      if (code === "28P01") {
        return "Database credentials rejected (invalid_password). Check POSTGRES_URL.";
      }
      if (code === "3D000") {
        return "Database does not exist. Check POSTGRES_URL.";
      }
      if (code === "23503") {
        return "Database foreign key violation. Clear cookies and sign in again.";
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return undefined;
}

function throwDbError(operation: string, error: unknown): never {
  const cause = formatDbErrorCause(error);
  logger.error(`[pgQueries] ${operation}`, {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    code: typeof error === "object" && error !== null && "code" in error ? (error as any).code : undefined,
  });
  throw new ChatSDKError(
    "bad_request:database",
    cause ? `${operation}: ${cause}` : operation
  );
}

// ─── User Queries ───

export async function getUser(email: string): Promise<User[]> {
  const db = getDb();
  try {
    return await db.select().from(user).where(eq(user.email, email));
  } catch (error) {
    throwDbError("Failed to get user by email", error);
  }
}

export async function createUser(email: string, password: string) {
  const db = getDb();
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.insert(user).values({ email, password: hashedPassword });
  } catch (error) {
    throwDbError("Failed to create user", error);
  }
}

export async function createGuestUser() {
  const db = getDb();
  const email = `guest-${Date.now()}`;
  const password = generateHashedPassword(generateUUID());

  try {
    return await db
      .insert(user)
      .values({ email, password })
      .returning({ id: user.id, email: user.email });
  } catch (error) {
    throwDbError("Failed to create guest user", error);
  }
}

export async function createOrFindUserByEmail(email: string) {
  const db = getDb();
  try {
    const existingUsers = await db
      .select()
      .from(user)
      .where(eq(user.email, email));

    if (existingUsers.length > 0) {
      return existingUsers[0];
    }

    const password = generateHashedPassword(generateUUID());
    const [newUser] = await db
      .insert(user)
      .values({ email, password })
      .returning({ id: user.id, email: user.email });

    return newUser;
  } catch (error) {
    throwDbError("Failed to create or find user by email", error);
  }
}

// ─── Chat Queries ───

export async function saveChat({
  id,
  userId,
  title,
  visibility,
  assistantId,
  organizationId,
}: {
  id: string;
  userId: string;
  title: string;
  visibility: VisibilityType;
  assistantId?: string | null;
  organizationId?: string | null;
}) {
  const db = getDb();
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
      visibility,
      assistantId: assistantId ?? null,
      organizationId: organizationId ?? null,
    });
  } catch (error) {
    throwDbError("Failed to save chat", error);
  }
}

export async function deleteChatById({ id }: { id: string }) {
  const db = getDb();
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    try {
      await db.execute(sql`DELETE FROM "Stream" WHERE "chatId" = ${id}`);
    } catch {
      // ignore: Stream table may have been dropped
    }
    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (error) {
    throwDbError("Failed to delete chat by id", error);
  }
}

export async function deleteAllChatsByUserId({
  userId,
}: {
  userId: string;
}) {
  const db = getDb();
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    try {
      await db.execute(
        sql`DELETE FROM "Stream" WHERE "chatId" IN (${sql.join(
          chatIds.map((chatId) => sql`${chatId}`),
          sql`, `
        )})`
      );
    } catch {
      // ignore: Stream table may have been dropped
    }

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (error) {
    throwDbError("Failed to delete all chats by user id", error);
  }
}

export async function getChatsByUserId({
  id,
  organizationId,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  organizationId?: string | null;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  const db = getDb();
  try {
    const extendedLimit = limit + 1;

    const baseConditions = organizationId
      ? and(eq(chat.userId, id), eq(chat.organizationId, organizationId))
      : eq(chat.userId, id);

    const query = (whereCondition?: SQL<any>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, baseConditions)
            : baseConditions
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (error) {
    if (error instanceof ChatSDKError) throw error;
    throwDbError("Failed to get chats by user id", error);
  }
}

export async function getChatById({ id }: { id: string }) {
  const db = getDb();
  try {
    const [selectedChat] = await db
      .select()
      .from(chat)
      .where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }
    return selectedChat;
  } catch (error) {
    throwDbError("Failed to get chat by id", error);
  }
}

// ─── Message Queries ───

export async function saveMessages({
  messages,
}: {
  messages: DBMessage[];
}) {
  const db = getDb();
  try {
    return await db.insert(message).values(messages);
  } catch (error) {
    throwDbError("Failed to save messages", error);
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  const db = getDb();
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (error) {
    throwDbError("Failed to get messages by chat id", error);
  }
}

export async function getMessageById({ id }: { id: string }) {
  const db = getDb();
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (error) {
    throwDbError("Failed to get message by id", error);
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  const db = getDb();
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map((m) => m.id);

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }

    return [];
  } catch (error) {
    throwDbError(
      "Failed to delete messages by chat id after timestamp",
      error
    );
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  const db = getDb();
  try {
    const cutoff = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, cutoff),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (error) {
    throwDbError("Failed to get message count by user id", error);
  }
}

// ─── Vote Queries ───

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  const db = getDb();
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(
          and(eq(vote.messageId, messageId), eq(vote.chatId, chatId))
        );
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (error) {
    throwDbError("Failed to vote message", error);
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  const db = getDb();
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (error) {
    throwDbError("Failed to get votes by chat id", error);
  }
}

// ─── Document Queries ───

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
}) {
  const db = getDb();
  try {
    return await db
      .insert(document)
      .values(
        {
          id,
          title,
          kind,
          content,
          userId,
          createdAt: new Date(),
        } as typeof document.$inferInsert
      )
      .returning();
  } catch (error) {
    throwDbError("Failed to save document", error);
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  const db = getDb();
  try {
    return await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));
  } catch (error) {
    throwDbError("Failed to get documents by id", error);
  }
}

export async function getDocumentById({ id }: { id: string }) {
  const db = getDb();
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));
    return selectedDocument;
  } catch (error) {
    throwDbError("Failed to get document by id", error);
  }
}

export async function getLatestDocumentByKindAndUser({
  userId,
  kind,
}: {
  userId: string;
  kind: ArtifactKind;
}) {
  const db = getDb();
  try {
    const [latestDocument] = await db
      .select()
      .from(document)
      .where(and(eq(document.userId, userId), eq(document.kind, kind)))
      .orderBy(desc(document.createdAt))
      .limit(1);
    return latestDocument ?? null;
  } catch (error) {
    throwDbError("Failed to get latest document by kind and user", error);
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  const db = getDb();
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (error) {
    throwDbError("Failed to delete documents by id after timestamp", error);
  }
}

// ─── Suggestion Queries ───

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  const db = getDb();
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (error) {
    throwDbError("Failed to save suggestions", error);
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  const db = getDb();
  try {
    return await db
      .select()
      .from(suggestion)
      .where(eq(suggestion.documentId, documentId));
  } catch (error) {
    throwDbError("Failed to get suggestions by document id", error);
  }
}

// ─── Chat Update Queries ───

export async function updateChatVisibilityById({
  chatId,
  visibility,
}: {
  chatId: string;
  visibility: VisibilityType;
}) {
  const db = getDb();
  try {
    return await db
      .update(chat)
      .set({ visibility })
      .where(eq(chat.id, chatId));
  } catch (error) {
    throwDbError("Failed to update chat visibility by id", error);
  }
}

export async function updateChatAssistantIdById({
  chatId,
  assistantId,
}: {
  chatId: string;
  assistantId: string | null;
}) {
  const db = getDb();
  try {
    return await db
      .update(chat)
      .set({ assistantId })
      .where(eq(chat.id, chatId));
  } catch (error) {
    throwDbError("Failed to update chat assistant id by id", error);
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  context: Record<string, unknown>;
}) {
  const db = getDb();
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    throwDbError("Failed to update lastContext for chat", error);
  }
}

export async function updateChatTitleById({
  chatId,
  title,
}: {
  chatId: string;
  title: string;
}) {
  const db = getDb();
  try {
    return await db
      .update(chat)
      .set({ title })
      .where(eq(chat.id, chatId));
  } catch (error) {
    throwDbError("Failed to update chat title by id", error);
  }
}
