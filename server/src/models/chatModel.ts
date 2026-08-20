import { getGenericModel } from "@/database/genericModel";

/**
 * Chat and Message models for chat management
 * Similar to Next.js chat application schema
 */

// Type definitions
export interface ChatMessage {
  id: string;
  chatId: string;
  role: "user" | "assistant" | "system" | "tool";
  parts: Array<{
    type: string;
    content?: string;
    [key: string]: any;
  }>;
  attachments?: any[];
  createdAt: Date;
}

export interface Chat {
  id: string;
  userId: string;
  organizationId: string;
  title: string;
  visibility: "private" | "public" | "organization";
  assistant_id?: string;
  createdAt: Date;
  updatedAt: Date;
  lastContext?: {
    modelId?: string;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    [key: string]: any;
  };
}

export interface StreamRecord {
  streamId: string;
  chatId: string;
  createdAt: Date;
}

// Create models using the generic model function
export const chatModel = getGenericModel("chats");
export const messageModel = getGenericModel("messages");
export const streamModel = getGenericModel("streams");

export default {
  chatModel,
  messageModel,
  streamModel,
};


