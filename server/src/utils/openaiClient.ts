import { createOpenAI } from "@ai-sdk/openai";
import config from "@/config";

/**
 * Creates an AI-SDK OpenAI provider instance with the given credentials.
 * Falls back to the global config OpenAI key and proxy URL when not specified.
 *
 * @param apiKey - OpenAI API key (defaults to config.openai.apiKey)
 * @param baseURL - Optional proxy/base URL override (defaults to config.openai.openAIProxyURL)
 * @returns AI-SDK OpenAI provider instance
 */
export function createConfiguredOpenAI(
  apiKey: string = config.openai.apiKey || "",
  baseURL: string | undefined = config.openai.openAIProxyURL || undefined
) {
  return createOpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
}
