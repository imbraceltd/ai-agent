/**
 * Zod validation schemas for chat-client API (Legacy)
 *
 * Chat + Message schemas have been migrated to:
 *   - @/chat (Chat.Visibility, Chat.create.schema, etc.)
 *   - @/message (Message.UserPart, Message.AssistantPart, etc.)
 *   - routes/chatClient.ts (request body schemas)
 */

import { z } from "zod";

// ─── Vote Schema ───

export const voteMessageSchema = z.object({
  chatId: z.string().uuid(),
  messageId: z.string().uuid(),
  type: z.enum(["up", "down"]),
});

export type VoteMessageBody = z.infer<typeof voteMessageSchema>;

// ─── Document Schema ───

export const saveDocumentSchema = z.object({
  content: z.string(),
  title: z.string(),
  kind: z.enum(["text", "code", "image", "sheet", "imbrace-databoard"]),
});

export type SaveDocumentBody = z.infer<typeof saveDocumentSchema>;
