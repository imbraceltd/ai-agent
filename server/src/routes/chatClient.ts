/**
 * Chat Client API Routes
 * Prefix: /api/chat-client
 *
 * Chat + Message routes use namespace pattern (Chat/Message).
 * Vote/Document/Suggestion routes still use legacy controller.
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authorize } from "@/middleware/authorize";
import { chatClientAuth } from "@/middleware/chatClientAuth";
import { Chat } from "@/models/client/chat";
import { Message } from "@/models/client/message";
import { ChatSDKError } from "@/lib/chatSdkError";
import { generateTitleFromMessage } from "@/services/titleService";
import type { Router as RouterType } from "express";
import { chatStatusEmitter } from "@/lib/chatStatusEmitter";
import logger from "@/lib/logger";

// Legacy controller — Vote, Document, Suggestion (not yet migrated)
import * as ctrl from "@/controllers/chatClientController";

const router: RouterType = Router();

// ── Helpers ──────────────────────────────────────────

function getRequestUser(req: Request): { id: string; email: string } {
  return (req as any).chatClientUser;
}

function handleError(res: Response, error: unknown): void {
  if (error instanceof ChatSDKError) {
    error.toExpressResponse(res);
    return;
  }
  if (error instanceof z.ZodError) {
    const cause = error.issues.map((i) => i.message).join("; ");
    new ChatSDKError("bad_request:api", cause).toExpressResponse(res);
    return;
  }
  const cause = error instanceof Error ? error.message : undefined;
  new ChatSDKError("bad_request:database", cause).toExpressResponse(res);
}

// ── Request Schemas (HTTP-level validation) ──────────

const createChatBody = z.object({
  id: z.string().uuid(),
  message: z.object({
    id: z.string().uuid().optional(),
    role: z.literal("user"),
    parts: z.array(Message.UserPart),
    metadata: z.record(z.unknown()).optional(),
  }),
  selectedVisibilityType: Chat.Visibility,
  assistantId: z.string().min(1).max(128).optional(),
  organizationId: z.string().min(1).max(128).optional(),
  type: Chat.ChatType.optional(),
});

const updateChatBody = z.object({
  assistantId: z.string().min(1).max(128).nullable().optional(),
  visibility: Chat.Visibility.optional(),
});

const saveMessageBody = z.object({
  message: z.object({
    id: z.string().min(1),
    chatId: z.string().uuid(),
    role: z.literal("assistant"),
    parts: z.array(Message.AssistantPart),
    metadata: z.record(z.unknown()).nullable().optional(),
  }),
});

const generateTitleBody = z.object({
  message: z.object({
    parts: z.array(
      z.object({ type: z.string(), text: z.string().optional() }).passthrough(),
    ),
  }),
});

// ── Auth Routes (no Imbrace token) ───────────────────

router.post("/auth/verify-credentials", ctrl.verifyCredentials);
router.post("/auth/register", ctrl.registerUser);

// ── Public Routes (no auth required) ─────────────────

router.get("/documents/:id/public", ctrl.getDocumentPublic);

// ── Middleware ────────────────────────────────────────

router.use(authorize);
router.use(chatClientAuth);

// ── Auth/User ────────────────────────────────────────

router.post("/auth/user", ctrl.findOrCreateUser);

// ── Chats ────────────────────────────────────────────

router.post("/chats", async (req: Request, res: Response) => {
  let body: z.infer<typeof createChatBody>;
  try {
    body = createChatBody.parse(req.body);
  } catch (error) {
    handleError(res, error);
    return;
  }

  try {
    const user = getRequestUser(req);
    const {
      id,
      message: msg,
      selectedVisibilityType,
      assistantId,
      organizationId,
      type,
    } = body;

    const existingChat = await Chat.get({ id });
    const created = !existingChat;

    if (existingChat) {
      if (existingChat.userId !== user.id) {
        new ChatSDKError("forbidden:chat").toExpressResponse(res);
        return;
      }
      if (assistantId && existingChat.assistantId !== assistantId) {
        await Chat.update({ id, assistantId });
      }
    } else {
      let title: string;
      try {
        title = await generateTitleFromMessage(msg.parts as any);
      } catch {
        const textParts = (msg.parts as any[])
          .filter((p: any) => p.type === "text")
          .map((p: any) => p.text)
          .join("");
        const compact = textParts.replace(/\s+/g, " ").trim();
        title = compact
          ? compact.length <= 80
            ? compact
            : `${compact.slice(0, 79).trimEnd()}…`
          : "New chat";
      }

      await Chat.create({
        id,
        userId: user.id,
        title,
        visibility: selectedVisibilityType,
        assistantId: assistantId ?? null,
        organizationId: organizationId ?? null,
        type: type ?? "chat",
      });
    }

    await Message.create({
      id: msg.id,
      chatId: id,
      role: "user",
      parts: msg.parts as any,
      metadata: msg.metadata ?? null,
    });

    res.status(created ? 201 : 200).json({ ok: true, id, created });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/chats", async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const limit = parseInt(req.query["limit"] as string) || 10;
    const startingAfter = (req.query["starting_after"] as string) || null;
    const endingBefore = (req.query["ending_before"] as string) || null;
    const organizationId = (req.query["organization_id"] as string) || null;

    if (startingAfter && endingBefore) {
      new ChatSDKError(
        "bad_request:api",
        "Only one of starting_after or ending_before can be provided.",
      ).toExpressResponse(res);
      return;
    }

    const result = await Chat.list({
      userId: user.id,
      organizationId,
      limit,
      startingAfter,
      endingBefore,
    });

    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.delete("/chats", async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const organizationId = (req.query["organization_id"] as string) || null;
    const result = await Chat.removeAll({ userId: user.id, organizationId });
    res.status(200).json(result);
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/chats/:id", async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const chatData = await Chat.get({ id: req.params["id"]! });

    if (!chatData) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id && chatData.visibility !== "public") {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    res.status(200).json(chatData);
  } catch (error) {
    handleError(res, error);
  }
});

// ── Chat Status SSE Stream ──────────────────────────────

router.get("/chats/:id/status/stream", async (req: Request, res: Response) => {
  const chatId = req.params["id"]!;

  try {
    const user = getRequestUser(req);
    const chatData = await Chat.get({ id: chatId });

    if (!chatData) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id && chatData.visibility !== "public") {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    // Set SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // If already idle, send immediately and close
    if (chatData.status !== "processing") {
      res.write(`data: ${JSON.stringify({ status: "idle" })}\n\n`);
      res.end();
      return;
    }

    // Chat is processing — listen for status change
    let closed = false;

    const cleanup = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      clearTimeout(staleTimer);
    };

    const unsubscribe = chatStatusEmitter.subscribe(chatId, (status) => {
      if (closed) return;
      res.write(`data: ${JSON.stringify({ status })}\n\n`);
      if (status === "idle") {
        res.end();
        cleanup();
      }
    });

    // Stale protection: auto-close after timeout
    const staleTimer = setTimeout(() => {
      if (closed) return;
      logger.warn("SSE status stream timed out, sending idle", { chatId });
      res.write(`data: ${JSON.stringify({ status: "idle", stale: true })}\n\n`);
      res.end();
      cleanup();
    }, chatStatusEmitter.staleTimeoutMs);

    // Send initial status so client knows connection is established
    res.write(`data: ${JSON.stringify({ status: "processing" })}\n\n`);

    // Cleanup on client disconnect
    req.on("close", cleanup);
  } catch (error) {
    handleError(res, error);
  }
});

router.patch("/chats/:id", async (req: Request, res: Response) => {
  let body: z.infer<typeof updateChatBody>;
  try {
    body = updateChatBody.parse(req.body);
  } catch {
    new ChatSDKError("bad_request:api").toExpressResponse(res);
    return;
  }

  try {
    const user = getRequestUser(req);
    const chatData = await Chat.get({ id: req.params["id"]! });

    if (!chatData) {
      new ChatSDKError(
        "not_found:database",
        "Chat not found",
      ).toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id) {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    await Chat.update({
      id: req.params["id"]!,
      assistantId: body.assistantId,
      visibility: body.visibility,
    });

    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

router.delete("/chats/:id", async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const chatData = await Chat.get({ id: req.params["id"]! });

    if (!chatData) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id) {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    const deleted = await Chat.remove({ id: req.params["id"]! });
    res.status(200).json(deleted);
  } catch (error) {
    handleError(res, error);
  }
});

// ── Messages ─────────────────────────────────────────

router.post("/messages", async (req: Request, res: Response) => {
  let body: z.infer<typeof saveMessageBody>;
  try {
    body = saveMessageBody.parse(req.body);
  } catch (error) {
    handleError(res, error);
    return;
  }

  try {
    const user = getRequestUser(req);
    const { message: msg } = body;

    const chatData = await Chat.get({ id: msg.chatId });
    if (!chatData) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }
    if (chatData.userId !== user.id) {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    const result = await Message.create({
      id: msg.id,
      chatId: msg.chatId,
      role: msg.role,
      parts: msg.parts as any,
      metadata: msg.metadata ?? null,
    });

    res.status(200).json({ ok: true, id: result.id });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/chats/:chatId/messages", async (req: Request, res: Response) => {
  try {
    const user = getRequestUser(req);
    const chatData = await Chat.get({ id: req.params["chatId"]! });

    if (!chatData) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }

    if (chatData.userId !== user.id && chatData.visibility !== "public") {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    const messages = await Message.getByChatId({
      chatId: req.params["chatId"]!,
    });
    res.status(200).json(messages);
  } catch (error) {
    handleError(res, error);
  }
});

router.delete("/messages/:id/trailing", async (req: Request, res: Response) => {
  try {
    const msg = await Message.getById({ id: req.params["id"]! });
    if (!msg) {
      new ChatSDKError("not_found:chat").toExpressResponse(res);
      return;
    }

    const user = getRequestUser(req);
    const chatData = await Chat.get({ id: msg.chatId });
    if (!chatData || chatData.userId !== user.id) {
      new ChatSDKError("forbidden:chat").toExpressResponse(res);
      return;
    }

    await Message.deleteTrailing({ messageId: req.params["id"]! });
    res.status(200).json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

// ── Votes (legacy controller) ────────────────────────

router.get("/chats/:chatId/votes", ctrl.getVotes);
router.patch("/votes", ctrl.voteOnMessage);

// ── Documents (legacy controller) ────────────────────

router.post("/documents", ctrl.createDocument);
router.get("/documents/latest-by-kind", ctrl.getDocumentLatestByKind);
router.get("/documents/:id/latest", ctrl.getDocumentLatest);
router.get("/documents/:id", ctrl.getDocument);
router.delete("/documents/:id", ctrl.deleteDocument);

// ── Suggestions (legacy controller) ──────────────────

router.get("/documents/:documentId/suggestions", ctrl.getSuggestions);

// ── Title Generation ─────────────────────────────────

router.post("/chats/:chatId/title", async (req: Request, res: Response) => {
  let body: z.infer<typeof generateTitleBody>;
  try {
    body = generateTitleBody.parse(req.body);
  } catch {
    new ChatSDKError("bad_request:api").toExpressResponse(res);
    return;
  }

  try {
    const title = await generateTitleFromMessage(body.message.parts as any);
    res.status(200).json({ title });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
