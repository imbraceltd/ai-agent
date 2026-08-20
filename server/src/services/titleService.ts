/**
 * Title generation service
 * Generates chat titles from user messages using AI
 */

import { generateText } from "ai";
import config from "@/config";
import logger from "@/lib/logger";
import { createConfiguredOpenAI } from "@/utils/openaiClient";

const titlePrompt = `
    - you will generate a short title based on the first message a user begins a conversation with
    - ensure it is not more than 80 characters long
    - the title should be a summary of the user's message
    - do not use quotes or colons`;

/**
 * Extract text content from message parts
 */
function getTextFromParts(
  parts: Array<{ type: string; text?: string }>
): string {
  return parts
    .filter((part) => part.type === "text" && part.text)
    .map((part) => part.text!)
    .join("");
}

/**
 * Generate a title from a user message
 */
export async function generateTitleFromMessage(
  messageParts: Array<{ type: string; text?: string }>
): Promise<string> {
  const messageText = getTextFromParts(messageParts);

  if (!messageText.trim()) {
    return "New chat";
  }

  try {
    if (!config.openai.apiKey) {
      logger.warn("[titleService] No OpenAI API key configured, using fallback title");
      return getFallbackTitle(messageText);
    }

    const openai = createConfiguredOpenAI();

    const { text: title } = await generateText({
      model: openai("gpt-4o-mini"),
      system: titlePrompt,
      prompt: messageText,
      abortSignal: AbortSignal.timeout(15_000),
    });

    const normalizedTitle = title.trim();
    return normalizedTitle || getFallbackTitle(messageText);
  } catch (error) {
    logger.error("[titleService] Failed to generate title", {
      error: error instanceof Error ? error.message : String(error),
    });
    return getFallbackTitle(messageText);
  }
}

/**
 * Generate a fallback title from message text
 */
function getFallbackTitle(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "New chat";
  }
  const maxLen = 80;
  if (compact.length <= maxLen) {
    return compact;
  }
  return `${compact.slice(0, maxLen - 1).trimEnd()}…`;
}
