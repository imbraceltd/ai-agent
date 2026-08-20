/**
 * Chat Client Controller (Legacy)
 *
 * Auth, Vote, Document, Suggestion handlers remain here.
 * Chat + Message handlers have been migrated to:
 *   - @/chat (Chat namespace)
 *   - @/message (Message namespace)
 *   - routes/chatClient.ts (thin route handlers)
 */

import { Request, Response } from "express";
import { z } from "zod";
import { ChatSDKError } from "@/lib/chatSdkError";
import { compare } from "bcrypt-ts";
import {
  createUser,
  deleteDocumentsByIdAfterTimestamp,
  getDocumentById as getDocumentByIdQuery,
  getDocumentsById,
  getLatestDocumentByKindAndUser as getLatestDocumentByKindAndUserQuery,
  getChatById,
  getUser as getUserByEmail,
  getVotesByChatId,
  saveDocument,
  voteMessage,
  getSuggestionsByDocumentId,
} from "@/database/pgQueries";
import type { ArtifactKind } from "@/database/pgSchema";
import { saveDocumentSchema, voteMessageSchema } from "./chatClientSchemas";

/** Helper to get chatClientUser from request */
function getRequestUser(req: Request): { id: string; email: string } {
  return (req as any).chatClientUser;
}

/** Helper to handle errors consistently */
function handleError(res: Response, error: unknown): void {
  if (error instanceof ChatSDKError) {
    error.toExpressResponse(res);
    return;
  }
  const cause = error instanceof Error ? error.message : undefined;
  new ChatSDKError("bad_request:database", cause).toExpressResponse(res);
}

// ─── Auth ───

/**
 * POST /auth/user
 * Find or create user by Imbrace token (already resolved by middleware)
 */
export async function findOrCreateUser(
  req: Request,
  res: Response,
): Promise<void> {
  const user = getRequestUser(req);
  res.status(200).json(user);
}

// ─── Votes ───

/**
 * GET /chats/:chatId/votes
 * Get votes for a chat
 */
export async function getVotes(req: Request, res: Response): Promise<void> {
  try {
    const user = getRequestUser(req);
    const chatData = await getChatById({ id: req.params["chatId"]! });

    if (!chatData) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id) {
      new ChatSDKError("forbidden:vote").toExpressResponse(res);
      return;
    }

    const votes = await getVotesByChatId({ id: req.params["chatId"]! });
    res.status(200).json(votes);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * PATCH /votes
 * Vote on a message
 */
export async function voteOnMessage(
  req: Request,
  res: Response,
): Promise<void> {
  let body: z.infer<typeof voteMessageSchema>;

  try {
    body = voteMessageSchema.parse(req.body);
  } catch {
    new ChatSDKError(
      "bad_request:api",
      "Parameters chatId, messageId, and type are required.",
    ).toExpressResponse(res);
    return;
  }

  try {
    const user = getRequestUser(req);
    const chatData = await getChatById({ id: body.chatId });

    if (!chatData) {
      new ChatSDKError("not_found:vote").toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id) {
      new ChatSDKError("forbidden:vote").toExpressResponse(res);
      return;
    }

    await voteMessage({
      chatId: body.chatId,
      messageId: body.messageId,
      type: body.type,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
}

// ─── Documents ───

/**
 * POST /documents
 * Create/update document
 */
export async function createDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const id = req.query["id"] as string;

  if (!id) {
    new ChatSDKError(
      "bad_request:api",
      "Parameter id is required.",
    ).toExpressResponse(res);
    return;
  }

  let body: z.infer<typeof saveDocumentSchema>;

  try {
    body = saveDocumentSchema.parse(req.body);
  } catch {
    new ChatSDKError("bad_request:document").toExpressResponse(res);
    return;
  }

  try {
    const user = getRequestUser(req);

    const documents = await getDocumentsById({ id });

    if (documents.length > 0) {
      const doc = documents[0]!;
      if (doc.userId !== user.id) {
        new ChatSDKError("forbidden:document").toExpressResponse(res);
        return;
      }
    }

    const result = await saveDocument({
      id,
      content: body.content,
      title: body.title,
      kind: body.kind as ArtifactKind,
      userId: user.id,
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * GET /documents/:id/public
 * Get latest document version — no auth required (for share links)
 */
export async function getDocumentPublic(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const documents = await getDocumentsById({ id: req.params["id"]! });
    const latest = documents[documents.length - 1];

    if (!latest) {
      new ChatSDKError("not_found:document").toExpressResponse(res);
      return;
    }

    // Only vibe-code documents can be shared publicly
    // if ((latest as any).kind !== "vibe-code") {
    //   new ChatSDKError("forbidden:document").toExpressResponse(res);
    //   return;
    // }

    res.status(200).json(latest);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * GET /documents/:id
 * Get document versions
 */
export async function getDocument(req: Request, res: Response): Promise<void> {
  try {
    const user = getRequestUser(req);
    const documents = await getDocumentsById({ id: req.params["id"]! });
    const [doc] = documents;

    if (!doc) {
      new ChatSDKError("not_found:document").toExpressResponse(res);
      return;
    }

    if (doc.userId !== user.id) {
      new ChatSDKError("forbidden:document").toExpressResponse(res);
      return;
    }

    res.status(200).json(documents);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * DELETE /documents/:id
 * Delete document versions after timestamp
 */
export async function deleteDocument(
  req: Request,
  res: Response,
): Promise<void> {
  const timestamp = req.query["timestamp"] as string;

  if (!timestamp) {
    new ChatSDKError(
      "bad_request:api",
      "Parameter timestamp is required.",
    ).toExpressResponse(res);
    return;
  }

  try {
    const user = getRequestUser(req);
    const documents = await getDocumentsById({ id: req.params["id"]! });
    const [doc] = documents;

    if (!doc) {
      new ChatSDKError("not_found:document").toExpressResponse(res);
      return;
    }

    if (doc.userId !== user.id) {
      new ChatSDKError("forbidden:document").toExpressResponse(res);
      return;
    }

    const result = await deleteDocumentsByIdAfterTimestamp({
      id: req.params["id"]!,
      timestamp: new Date(timestamp),
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
}

// ─── Suggestions ───

/**
 * GET /documents/:documentId/suggestions
 * Get suggestions for a document
 */
export async function getSuggestions(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = getRequestUser(req);
    const suggestions = await getSuggestionsByDocumentId({
      documentId: req.params["documentId"]!,
    });

    const [first] = suggestions;

    if (!first) {
      res.status(200).json([]);
      return;
    }

    if (first.userId !== user.id) {
      new ChatSDKError("forbidden:api").toExpressResponse(res);
      return;
    }

    res.status(200).json(suggestions);
  } catch (error) {
    handleError(res, error);
  }
}

// ─── Document (single latest version) ───

/**
 * GET /documents/:id/latest
 */
export async function getDocumentLatest(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const user = getRequestUser(req);
    const doc = await getDocumentByIdQuery({ id: req.params["id"]! });

    if (!doc) {
      new ChatSDKError("not_found:document").toExpressResponse(res);
      return;
    }

    if (doc.userId !== user.id) {
      new ChatSDKError("forbidden:document").toExpressResponse(res);
      return;
    }

    res.status(200).json(doc);
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * GET /documents/latest-by-kind?kind=X
 */
export async function getDocumentLatestByKind(
  req: Request,
  res: Response,
): Promise<void> {
  const kind = req.query["kind"] as string;

  if (!kind) {
    new ChatSDKError(
      "bad_request:api",
      "Parameter kind is required.",
    ).toExpressResponse(res);
    return;
  }

  try {
    const user = getRequestUser(req);
    const doc = await getLatestDocumentByKindAndUserQuery({
      userId: user.id,
      kind: kind as ArtifactKind,
    });

    res.status(200).json(doc);
  } catch (error) {
    handleError(res, error);
  }
}

// ─── Credentials Auth ───

/**
 * POST /auth/verify-credentials
 */
export async function verifyCredentials(
  req: Request,
  res: Response,
): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    new ChatSDKError(
      "bad_request:api",
      "email and password are required.",
    ).toExpressResponse(res);
    return;
  }

  try {
    const users = await getUserByEmail(email);

    if (users.length === 0) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const [dbUser] = users;

    if (!dbUser!.password) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    const passwordsMatch = await compare(password, dbUser!.password);

    if (!passwordsMatch) {
      res.status(401).json({ error: "invalid_credentials" });
      return;
    }

    res.status(200).json({ id: dbUser!.id, email: dbUser!.email });
  } catch (error) {
    handleError(res, error);
  }
}

/**
 * POST /auth/register
 */
export async function registerUser(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (!email || !password) {
    new ChatSDKError(
      "bad_request:api",
      "email and password are required.",
    ).toExpressResponse(res);
    return;
  }

  try {
    const existingUsers = await getUserByEmail(email);

    if (existingUsers.length > 0) {
      res.status(409).json({ error: "user_exists" });
      return;
    }

    await createUser(email, password);
    res.status(201).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
}
