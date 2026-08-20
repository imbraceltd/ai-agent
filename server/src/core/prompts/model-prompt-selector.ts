/**
 * Model Prompt Selector
 * Selects the appropriate system prompt based on the model family.
 * Inspired by OpenCode's SystemPrompt.provider() pattern.
 */

import PROMPT_CLAUDE from "./model-prompts/claude.txt";
import PROMPT_GPT from "./model-prompts/gpt.txt";
import PROMPT_GEMINI from "./model-prompts/gemini.txt";
import PROMPT_GENERIC from "./model-prompts/generic.txt";
import type { ModelFamily } from "@/providers/imbraceModels";

/**
 * Returns the model-specific system prompt for the given model family.
 * @param family - The detected model family
 * @returns The appropriate system prompt text
 */
export function getModelPrompt(family: ModelFamily): string {
  switch (family) {
    case "claude":
      return PROMPT_CLAUDE;
    case "gpt":
      return PROMPT_GPT;
    case "gemini":
      return PROMPT_GEMINI;
    case "ollama":
    case "generic":
    default:
      return PROMPT_GENERIC;
  }
}
