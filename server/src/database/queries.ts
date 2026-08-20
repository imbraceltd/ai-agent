import { chatModel, messageModel, streamModel, Chat, ChatMessage, StreamRecord } from "@/models/chatModel";
import logger from "@/lib/logger";

/**
 * Database queries for chat management
 * Adapted from Next.js chat application pattern
 */

/**
 * Get all chats for a user/organization
 */
export async function getChatsByUserId({
  userId,
  organizationId,
  limit = 50,
}: {
  userId?: string | undefined;
  organizationId: string;
  limit?: number;
}): Promise<Chat[]> {
  try {
    const filter: any = { organizationId };
    if (userId) {
      filter.userId = userId;
    }

    const chats = await chatModel
      .find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return chats as unknown as Chat[];
  } catch (error) {
    logger.error("Error fetching chats:", error);
    throw error;
  }
}

/**
 * Get a specific chat by ID
 */
export async function getChatById({ id }: { id: string }): Promise<Chat | null> {
  try {
    const chat = await chatModel.findOne({ id }).lean();
    return chat as unknown as Chat | null;
  } catch (error) {
    logger.error("Error fetching chat by ID:", error);
    throw error;
  }
}

/**
 * Save a new chat
 */
export async function saveChat(chat: Partial<Chat>): Promise<Chat> {
  try {
    const newChat = await chatModel.create({
      ...chat,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    logger.info("Chat saved successfully", { chatId: newChat.id });
    return newChat.toObject() as unknown as Chat;
  } catch (error) {
    logger.error("Error saving chat:", error);
    throw error;
  }
}

/**
 * Update chat title
 */
export async function updateChatTitle({
  id,
  title,
}: {
  id: string;
  title: string;
}): Promise<void> {
  try {
    await chatModel.updateOne(
      { id },
      { 
        $set: { 
          title,
          updatedAt: new Date(),
        } 
      }
    );
    logger.info("Chat title updated", { chatId: id, title });
  } catch (error) {
    logger.error("Error updating chat title:", error);
    throw error;
  }
}

/**
 * Update chat last context (usage data)
 */
export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  context: any;
}): Promise<void> {
  try {
    await chatModel.updateOne(
      { id: chatId },
      { 
        $set: { 
          lastContext: context,
          updatedAt: new Date(),
        } 
      }
    );
    logger.info("Chat context updated", { chatId });
  } catch (error) {
    logger.error("Error updating chat context:", error);
    throw error;
  }
}

/**
 * Delete a chat by ID
 */
export async function deleteChatById({ id }: { id: string }): Promise<Chat | null> {
  try {
    // Delete associated messages
    await messageModel.deleteMany({ chatId: id });
    
    // Delete associated streams
    await streamModel.deleteMany({ chatId: id });
    
    // Delete the chat
    const deletedChat = await chatModel.findOneAndDelete({ id }).lean();
    
    logger.info("Chat deleted successfully", { chatId: id });
    return deletedChat as unknown as Chat | null;
  } catch (error) {
    logger.error("Error deleting chat:", error);
    throw error;
  }
}

/**
 * Get messages for a specific chat
 */
export async function getMessagesByChatId({ id }: { id: string }): Promise<ChatMessage[]> {
  try {
    const messages = await messageModel
      .find({ chatId: id })
      .sort({ createdAt: 1 })
      .lean();

    return messages as unknown as ChatMessage[];
  } catch (error) {
    logger.error("Error fetching messages:", error);
    throw error;
  }
}

/**
 * Save messages to database
 */
export async function saveMessages({ messages }: { messages: Partial<ChatMessage>[] }): Promise<void> {
  try {
    if (!messages || messages.length === 0) {
      return;
    }

    await messageModel.insertMany(
      messages.map(msg => ({
        ...msg,
        createdAt: msg.createdAt || new Date(),
      }))
    );

    logger.info("Messages saved successfully", { count: messages.length });
  } catch (error) {
    logger.error("Error saving messages:", error);
    throw error;
  }
}

/**
 * Get message count for rate limiting
 */
export async function getMessageCountByUserId({
  id,
  differenceInHours = 24,
}: {
  id: string;
  differenceInHours?: number;
}): Promise<number> {
  try {
    const timeThreshold = new Date(Date.now() - differenceInHours * 60 * 60 * 1000);
    
    const count = await messageModel.countDocuments({
      userId: id,
      role: "user",
      createdAt: { $gte: timeThreshold },
    });

    return count;
  } catch (error) {
    logger.error("Error counting messages:", error);
    return 0;
  }
}

/**
 * Create stream ID record
 */
export async function createStreamId({ streamId, chatId }: { streamId: string; chatId: string }): Promise<void> {
  try {
    await streamModel.create({
      streamId,
      chatId,
      createdAt: new Date(),
    });
    logger.info("Stream ID created", { streamId, chatId });
  } catch (error) {
    logger.error("Error creating stream ID:", error);
    throw error;
  }
}

/**
 * Get stream by ID
 */
export async function getStreamById({ id }: { id: string }): Promise<StreamRecord | null> {
  try {
    const stream = await streamModel.findOne({ streamId: id }).lean();
    return stream as StreamRecord | null;
  } catch (error) {
    logger.error("Error fetching stream:", error);
    throw error;
  }
}

