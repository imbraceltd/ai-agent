/**
 * Chat Message Utilities
 * Stateless utility functions for message conversion, file inference, and formatting.
 * Extracted from chat-processor.ts for modularity.
 */

import {
  convertToModelMessages,
  ModelMessage,
  UIMessage as SDKUIMessage,
} from "ai";
import type { UIMessage, UIContentPart } from "../types/chat";

/**
 * Convert messages to ModelMessage[] format.
 * Messages may arrive as UIMessage[] (from DB history) or ModelMessage[] (from client).
 * The AI SDK agent requires ModelMessage[], so UIMessages must be converted.
 * @param messages - Messages in either UIMessage or ModelMessage format
 * @returns ModelMessage[] ready for the agent
 */
export function toModelMessages(messages: unknown[]): ModelMessage[] {
  const first = messages[0] as Record<string, unknown> | undefined;
  // UIMessages have a 'parts' property; ModelMessages have 'content'
  if (first && "parts" in first) {
    return convertToModelMessages(messages as SDKUIMessage[]);
  }
  return messages as ModelMessage[];
}

/**
 * Infer the file kind from media type, name, or URL
 * @param mediaType - MIME type of the file
 * @param name - File name
 * @param url - File URL
 * @returns Inferred file kind
 */
export function inferFileKind(
  mediaType?: string,
  name?: string,
  url?: string,
): string {
  const mt = (mediaType || "").toLowerCase();
  const lower = `${name || ""} ${url || ""}`.toLowerCase();

  if (mt.startsWith("image/")) return "image";
  if (mt === "application/pdf" || lower.endsWith(".pdf")) return "pdf";
  if (mt.includes("csv") || lower.endsWith(".csv")) return "csv";
  if (mt.includes("excel") || lower.endsWith(".xlsx") || lower.endsWith(".xls"))
    return "excel";
  if (mt.includes("json") || lower.endsWith(".json")) return "json";
  if (mt.startsWith("text/") || lower.endsWith(".txt") || lower.endsWith(".md"))
    return "text";
  return "file";
}

/**
 * Extract the content array from a message, handling both client format (content)
 * and DB/SDK format (parts). Returns null if no array content found.
 * @param m - Message in either format
 * @returns Content array or null
 */
function getContentArray(
  m: Record<string, unknown>,
): Record<string, unknown>[] | null {
  if (Array.isArray(m["content"])) return m["content"] as Record<string, unknown>[];
  if (Array.isArray(m["parts"])) return m["parts"] as Record<string, unknown>[];
  return null;
}

/**
 * Extract file URL from a content part, handling both `data` (client format)
 * and `url` (DB/SDK format).
 * @param part - Content part record
 * @returns File URL string or null
 */
function getFileUrl(part: Record<string, unknown>): string | null {
  const data = part["data"];
  if (typeof data === "string" && data.trim().length > 0) return data;
  const url = part["url"];
  if (typeof url === "string" && url.trim().length > 0) return url;
  return null;
}

/**
 * Append file attachments as machine-readable tool hints to user messages.
 * This prevents LLM from hallucinating file URLs.
 * Handles both client format (content + data) and DB format (parts + url).
 * @param messages - Array of UI messages
 * @returns Messages with file hints appended
 */
export function appendFilesAsToolHints(messages: UIMessage[]): UIMessage[] {
  return messages.map((m) => {
    if (m.role !== "user") return m;

    const record = m as unknown as Record<string, unknown>;
    const contentArr = getContentArray(record);
    if (!contentArr) return m;

    // Find file parts - check both `data` and `url` fields
    const fileParts = contentArr.filter((p) => {
      if (p?.["type"] !== "file") return false;
      return getFileUrl(p) !== null;
    });

    if (fileParts.length === 0) return m;

    // Prevent duplicated hint blocks
    const already = contentArr.some(
      (p) =>
        p["type"] === "text" &&
        typeof p["text"] === "string" &&
        (p["text"] as string).includes("__ATTACHED_FILES_V1__"),
    );
    if (already) return m;

    const files = fileParts.map((f, i) => {
      const fileUrl = getFileUrl(f)!;
      return {
        id: `file_${i + 1}`,
        url: fileUrl,
        name: (f["name"] as string) ?? null,
        mediaType: (f["mediaType"] as string) ?? (f["mimeType"] as string) ?? null,
        kind: inferFileKind(
          (f["mediaType"] as string) ?? (f["mimeType"] as string),
          f["name"] as string,
          fileUrl,
        ),
      };
    });

    const hintPart = {
      type: "text" as const,
      text:
        `__ATTACHED_FILES_V1__\n` +
        JSON.stringify({ files }) +
        `\n__END_ATTACHED_FILES_V1__`,
    };

    // Reason: vLLM and most providers don't support `type: "file"` parts.
    // Image files are kept because the AI SDK converts them to `image_url`
    // which providers understand. Non-image files (PDF, CSV, etc.) are stripped
    // since their URLs are already preserved in the hint block above.
    const isNonImageFile = (p: Record<string, unknown>) => {
      if (p?.["type"] !== "file") return false;
      const mt = ((p["mediaType"] as string) ?? (p["mimeType"] as string) ?? "").toLowerCase();
      return !mt.startsWith("image/");
    };

    const filteredContent = contentArr.filter((p) => !isNonImageFile(p));
    if (Array.isArray(record["parts"])) {
      const filteredParts = (record["parts"] as unknown[]).filter(
        (p) => !isNonImageFile(p as Record<string, unknown>),
      );
      return { ...m, parts: [...filteredParts, hintPart] } as unknown as UIMessage;
    }
    return { ...m, content: [...filteredContent, hintPart] } as unknown as UIMessage;
  });
}

/**
 * Format the chat output for consistency
 * @param sessionId - Session ID
 * @param text - Response text
 * @returns Formatted output
 */
export function formatChatOutput(sessionId: string, text: string): string {
  return [
    `session_id: ${sessionId}`,
    "",
    "<chat_result>",
    text,
    "</chat_result>",
  ].join("\n");
}
