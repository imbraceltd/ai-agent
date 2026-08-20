/**
 * Databoard skills tool.
 *
 * Loads pre-authored markdown "skill" files specific to the Databoard agent
 * (board CRUD, field types, naming, TableInTable, MapToBoard). Bundled at
 * src/assets/databoard-skills/ → dist/assets/databoard-skills/ via
 * tsup.config.ts.
 *
 * Kept separate from the workflow `skills-tool` so the Databoard sub-agent
 * never sees ActivePieces workflow guides (Document AI, code-step, etc.).
 */

import { tool } from "ai";
import z from "zod/v4";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import logger from "@/lib/logger";

function getSkillsDir(): string {
  // __dirname = src/tool/databoard in ts-node / dist/tool/databoard in compiled build.
  // Assets live at <root>/assets/databoard-skills in both cases.
  return resolve(__dirname, "..", "..", "assets", "databoard-skills");
}

function isSafeSkillName(name: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(name) && basename(name) === name;
}

function resolveSkillPath(name: string): string | null {
  const dir = getSkillsDir();
  const direct = resolve(dir, `${name}.md`);
  if (existsSync(direct)) return direct;
  const withExt = resolve(dir, name);
  if (withExt.endsWith(".md") && existsSync(withExt)) return withExt;
  return null;
}

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

export const listDataboardSkills = tool({
  description:
    "List the Databoard knowledge-guide skills bundled with the server. Call this first if you are unsure which skill name to read. Returns an array of {name, size_bytes}.",
  inputSchema: z.object({}),
  execute: async () => {
    try {
      return { success: true, skills: listAvailableSkills() };
    } catch (error) {
      logger.error("list_databoard_skills failed", { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});

export const readDataboardSkill = tool({
  description:
    'Read a bundled Databoard knowledge-guide skill by name and return its full markdown contents. Use this BEFORE calling create_board or update_board_schema for non-trivial cases. Known skills: databoard-naming-conventions, databoard-board-types, databoard-field-types-reference, databoard-table-in-table-guide, databoard-map-to-board-guide. Call list_databoard_skills if unsure.',
  inputSchema: z.object({
    name: z
      .string()
      .describe(
        'The skill name without extension (e.g. "databoard-field-types-reference").',
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
      logger.error("read_databoard_skill failed", { error, name });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
});
