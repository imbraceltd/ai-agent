/**
 * Skills tool.
 *
 * Loads pre-authored markdown "skill" files bundled with the server build
 * (src/assets/skills/ → dist/assets/skills/ via tsup.config.ts). Each skill is
 * a condensed knowledge guide that the Workflow-Developer sub-agent consults
 * before configuring specific ActivePieces pieces (Document AI, Automate Data
 * Board, webhook return-response, code step, send email).
 *
 * Why not RAG? The same prompt runs across dev/staging/prod and the
 * knowledge-hub folder IDs differ per environment — skills are deterministic:
 * the filename IS the identifier, so the prompt can call
 * `read_skill({name: "ai-agent-guide-document-ai"})` and get the same bytes
 * in every env.
 */

import { tool } from "ai";
import z from "zod/v4";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import logger from "@/lib/logger";

function getSkillsDir(): string {
  // __dirname = src/tool in ts-node / dist/tool in compiled build.
  // Assets live at <parent>/assets/skills in both cases.
  return resolve(__dirname, "..", "assets", "skills");
}

function isSafeSkillName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && basename(name) === name;
}

function resolveSkillPath(name: string): string | null {
  const dir = getSkillsDir();
  const direct = resolve(dir, `${name}.md`);
  if (existsSync(direct)) return direct;
  // Allow callers to pass the full filename including extension.
  const withExt = resolve(dir, name);
  if (withExt.endsWith(".md") && existsSync(withExt)) return withExt;
  return null;
}

/**
 * Enumerate skills available in the bundled skills directory.
 * Used to dynamically populate the `list_skills` result and to compute
 * the description shown to the LLM.
 */
function listAvailableSkills(): { name: string; size_bytes: number }[] {
  const dir = getSkillsDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .map((f) => ({
      name: f.replace(/\.md$/i, ""),
      size_bytes: statSync(resolve(dir, f)).size,
    }));
}

export const listSkills = tool({
  description:
    "List the knowledge-guide skills bundled with the server. Call this first if you are unsure which skill name to read. Returns an array of {name, size_bytes}.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      return { success: true, skills: listAvailableSkills() };
    } catch (error) {
      logger.error("list_skills failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export const readSkill = tool({
  description:
    "Read a bundled knowledge-guide skill by name and return its full markdown contents. Use this BEFORE configuring the corresponding ActivePieces piece — the guide's rules override the piece's raw schema. Known skills include: ai-agent-guide-document-ai, ai-agent-guide-automate-data-board, ai-agent-guide-webhook-return-response, ai-agent-guide-code-step, ai-agent-guide-send-email. Call list_skills if unsure.",
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        'The skill name without extension (e.g. "ai-agent-guide-document-ai").',
      ),
  }),
  execute: async ({ name }) => {
    if (!name || !isSafeSkillName(name.replace(/\.md$/i, ""))) {
      return { success: false, error: "Invalid skill name" };
    }

    const path = resolveSkillPath(name);
    if (!path) {
      return {
        success: false,
        error: `Skill "${name}" not found.`,
        available: listAvailableSkills().map((s) => s.name),
      };
    }

    try {
      const content = readFileSync(path, "utf-8");
      return { success: true, name, content };
    } catch (error) {
      logger.error("read_skill failed", { error, name });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
