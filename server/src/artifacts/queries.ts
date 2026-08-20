import {
  and,
  asc,
  desc,
  eq,
  gt,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import config from "@/config";
import type { ArtifactKind } from "../types/artifact";
import { ChatSDKError } from "./errors";
import {
  document,
  type Suggestion,
  suggestion,
} from "./schema";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

const AISDKChatClientPostgresUrl = config.database.AISDKChatClientPostgresUrl;
if (!AISDKChatClientPostgresUrl) {
  throw new ChatSDKError("bad_request:database", "Missing POSTGRES_URL");
}

const client = postgres(AISDKChatClientPostgresUrl);
const db = drizzle(client);

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
    const errorMessage = error instanceof Error ? error.message : String(error);
    const enrichedError = new Error(`Failed to save document: ${errorMessage}`);
    // Preserve original error for upstream logging/debugging
    (enrichedError as any).cause = error;
    throw enrichedError;
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function getLatestDocumentByKindAndUser({
  userId,
  kind,
}: {
  userId: string;
  kind: ArtifactKind;
}) {
  try {
    const [latestDocument] = await db
      .select()
      .from(document)
      .where(and(eq(document.userId, userId), eq(document.kind, kind)))
      .orderBy(desc(document.createdAt))
      .limit(1);

    return latestDocument ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get latest document by kind and user"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
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
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}


