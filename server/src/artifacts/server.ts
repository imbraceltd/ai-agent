import { codeDocumentHandler } from "@/artifacts/code/server";
import { sheetDocumentHandler } from "@/artifacts/sheet/server";
import { textDocumentHandler } from "@/artifacts/text/server";
// import { vibeCodeDocumentHandler } from "@/artifacts/vibe-code/server";
import type { ArtifactKind } from "../types/artifact";
import { saveDocument } from "./queries";
import type { Document } from "./schema";
import logger from "@/lib/logger";

export type SaveDocumentProps = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
};

export type CreateDocumentCallbackProps = {
  id: string;
  title: string;
  description?: string | undefined;
  dataStream: any;
  userId: string;
  model?: any | undefined;
  chatId?: string | undefined;
};

export type UpdateDocumentCallbackProps = {
  document: Document;
  description: string;
  dataStream: any;
  userId: string;
  model?: any | undefined;
  chatId?: string | undefined;
};

export type DocumentHandler<T = ArtifactKind> = {
  kind: T;
  onCreateDocument: (args: CreateDocumentCallbackProps) => Promise<void>;
  onUpdateDocument: (args: UpdateDocumentCallbackProps) => Promise<void>;
};

function isUuid(value: string) {
  // RFC 4122 UUID (v1-v5)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function truncate(value: string, maxLength = 800) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}… (truncated, len=${value.length})`;
}

function getDeepestCause(error: unknown, maxDepth = 6): unknown {
  let current: any = error;
  for (let i = 0; i < maxDepth; i++) {
    const next = current?.cause;
    if (!next) break;
    current = next;
  }
  return current;
}

function serializeDbError(err: unknown) {
  if (!(err instanceof Error)) {
    return { type: typeof err, value: err };
  }

  const anyErr = err as any;
  return {
    name: err.name,
    message: truncate(err.message),
    stack: err.stack ? truncate(err.stack, 1200) : undefined,
    // Common postgres-js fields (if present)
    code: anyErr.code,
    detail: anyErr.detail,
    hint: anyErr.hint,
    schema: anyErr.schema_name,
    table: anyErr.table_name,
    column: anyErr.column_name,
    dataType: anyErr.data_type_name,
    constraint: anyErr.constraint_name,
    severity: anyErr.severity,
  };
}

export function createDocumentHandler<T extends ArtifactKind>(config: {
  kind: T;
  onCreateDocument: (params: CreateDocumentCallbackProps) => Promise<string>;
  onUpdateDocument: (params: UpdateDocumentCallbackProps) => Promise<string>;
}): DocumentHandler<T> {
  return {
    kind: config.kind,
    onCreateDocument: async (args: CreateDocumentCallbackProps) => {
      const draftContent = await config.onCreateDocument({
        id: args.id,
        title: args.title,
        description: args.description,
        dataStream: args.dataStream,
        userId: args.userId,
        model: args.model,
        chatId: args.chatId,
      });
      console.log(`user ID: ${args.userId} is UUID: ${isUuid(args.userId)}`);
      if (args.userId && isUuid(args.userId)) {
        try {
          await saveDocument({
            id: args.id,
            title: args.title,
            content: draftContent,
            kind: config.kind,
            userId: args.userId,
          });
          logger.info("Artifact saved to database", {
            kind: config.kind,
            id: args.id,
            userId: args.userId,
          });
          console.log("document saved to database:", {
            id: args.id,
            title: args.title,
            kind: config.kind,
            userId: args.userId,
          });
        } catch (error) {
          const deepestCause = getDeepestCause(error);
          logger.error("Failed saving artifact to database", {
            kind: config.kind,
            id: args.id,
            userId: args.userId,
            errorMessage:
              error instanceof Error ? truncate(error.message) : String(error),
            errorStack:
              error instanceof Error && error.stack
                ? truncate(error.stack, 1200)
                : undefined,
            errorCause: serializeDbError((error as any)?.cause),
            errorRootCause: serializeDbError(deepestCause),
          });
          console.error("Failed saving artifact to database:", {
            id: args.id,
            title: args.title,
            kind: config.kind,
            userId: args.userId,
            errorMessage:
              error instanceof Error ? truncate(error.message) : String(error),
            errorStack:
              error instanceof Error && error.stack
                ? truncate(error.stack, 1200)
                : undefined,
            errorCause: serializeDbError((error as any)?.cause),
            errorRootCause: serializeDbError(deepestCause),
          });
        }
      } else if (args.userId) {
        logger.warn("Skipping artifact DB save: userId is not a UUID", {
          kind: config.kind,
          id: args.id,
          userId: args.userId,
        });
      }

      return;
    },
    onUpdateDocument: async (args: UpdateDocumentCallbackProps) => {
      const draftContent = await config.onUpdateDocument({
        document: args.document,
        description: args.description,
        dataStream: args.dataStream,
        userId: args.userId,
        model: args.model,
        chatId: args.chatId,
      });

      if (args.userId && isUuid(args.userId)) {
        try {
          await saveDocument({
            id: args.document.id,
            title: args.document.title,
            content: draftContent,
            kind: config.kind,
            userId: args.userId,
          });
          logger.info("Artifact update saved to database", {
            kind: config.kind,
            id: args.document.id,
            userId: args.userId,
          });
        } catch (error) {
          const deepestCause = getDeepestCause(error);
          logger.error("Failed saving artifact update to database", {
            kind: config.kind,
            id: args.document.id,
            userId: args.userId,
            errorMessage:
              error instanceof Error ? truncate(error.message) : String(error),
            errorStack:
              error instanceof Error && error.stack
                ? truncate(error.stack, 1200)
                : undefined,
            errorCause: serializeDbError((error as any)?.cause),
            errorRootCause: serializeDbError(deepestCause),
          });
        }
      } else if (args.userId) {
        logger.warn(
          "Skipping artifact DB save (update): userId is not a UUID",
          {
            kind: config.kind,
            id: args.document.id,
            userId: args.userId,
          },
        );
      }

      return;
    },
  };
}

/*
 * Use this array to define the document handlers for each artifact kind.
 */
export const documentHandlersByArtifactKind: DocumentHandler<ArtifactKind>[] = [
  textDocumentHandler,
  codeDocumentHandler,
  sheetDocumentHandler,
  // vibeCodeDocumentHandler,
];

export const artifactKinds = ["text", "code", "sheet"] as const;
