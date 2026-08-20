/**
 * Parses a JSON string that may be wrapped in a markdown code block.
 * Strips ```json or ``` fences before parsing.
 *
 * @param text - Raw text that may contain markdown-fenced JSON
 * @returns Parsed value, or null if parsing fails
 */
export function parseJsonFromText(text: string): unknown | null {
  let jsonText = text.trim();
  if (jsonText.startsWith("```")) {
    jsonText = jsonText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }
  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

/**
 * Sanitizes a filename or folder name to prevent path traversal and injection.
 * Replaces non-alphanumeric characters (except _ and -) with underscores,
 * collapses consecutive underscores, and trims leading/trailing underscores.
 *
 * @param name - Raw filename or folder name
 * @returns Sanitized string, or empty string if input is invalid
 */
export function sanitizeName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "");
}
