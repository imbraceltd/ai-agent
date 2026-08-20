import { jsonrepair } from "jsonrepair";

/**
 * Repairs tool call input strings where models mix XML-style formatting into JSON.
 * Fixes pattern where a value leaks into the key name with XML closing tags:
 *   "key_name\nvalue_content\n</parameter": "" → "key_name": "value_content"
 * @param input - Raw tool call input string (potentially malformed JSON)
 * @returns Cleaned input string with contaminated keys fixed
 */
export function repairXmlContaminatedInput(input: string): string {
  // Reason: Some models (e.g. Bedrock-hosted) mix XML-style </parameter> tags
  // into JSON tool call inputs, causing the value to leak into the key name.
  // The regex matches: "key_name<newline>value<newline></parameter": ""
  // and replaces with: "key_name": "value"
  return input.replace(
    /"([a-z_]+)\n([\s\S]*?)\n?<\/parameter":\s*""/g,
    (_, key: string, value: string) => {
      const escaped = value
        .trim()
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"')
        .replace(/\n/g, " ");
      return `"${key}": "${escaped}"`;
    }
  );
}

/**
 * Chains XML-contamination repair with jsonrepair for full tool input recovery.
 * @param input - Raw tool call input string
 * @returns Repaired JSON string
 */
export function repairToolInput(input: string): string {
  const cleaned = repairXmlContaminatedInput(input);
  return jsonrepair(cleaned);
}
