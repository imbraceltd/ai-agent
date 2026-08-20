/**
 * Admin routes for the sub-agent knowledge guides.
 *
 * Five reference PDFs are bundled in `src/assets/guides/` and copied into
 * `dist/assets/guides/` by tsup on build (see tsup.config.ts). These routes
 * let an operator discover and download them from a deployed server so they
 * can be ingested into a knowledge-hub folder — without needing the repo's
 * `docs/` directory on their local machine.
 *
 * Workflow:
 *   1. GET  /api/admin/guides                → list available guide files
 *   2. GET  /api/admin/guides/:filename      → stream the PDF bytes
 *   3. Upload the downloaded PDFs to a knowledge-hub folder via the existing
 *      admin UI, then set that folder on assistant.folder_ids.
 *
 * The handler resolves the assets path relative to `__dirname` so it works in
 * both `ts-node` (src/assets) and compiled prod (dist/assets).
 */

import { Router, Request, Response } from "express";
import type { Router as RouterType } from "express";
import { existsSync, statSync, readdirSync, createReadStream } from "node:fs";
import { resolve, basename } from "node:path";
import logger from "@/lib/logger";

const router: RouterType = Router();

function getGuidesDir(): string {
  // __dirname resolves to src/routes in dev and dist/routes in prod.
  // Assets live at <parent>/assets/guides in both cases.
  return resolve(__dirname, "..", "assets", "guides");
}

function isSafeFilename(name: string): boolean {
  // Reject traversal, absolute paths, or anything other than [a-zA-Z0-9._-]+.pdf
  return /^[a-zA-Z0-9._-]+\.pdf$/.test(name) && basename(name) === name;
}

router.get("/", (_req: Request, res: Response) => {
  const dir = getGuidesDir();
  if (!existsSync(dir)) {
    res.status(500).json({
      success: false,
      error: "Guides asset directory is missing from the deployment",
      path: dir,
    });
    return;
  }

  try {
    const files = readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .map((f) => {
        const stat = statSync(resolve(dir, f));
        return {
          filename: f,
          size_bytes: stat.size,
          download_url: `/api/admin/guides/${encodeURIComponent(f)}`,
        };
      });

    res.json({
      success: true,
      data: files,
      note: "Download these PDFs and upload them to the target knowledge-hub folder. Set assistant.folder_ids to that folder so folderContentsTool + RAGknowledge can retrieve them.",
    });
  } catch (error) {
    logger.error("admin/guides list failed", { error });
    res.status(500).json({ success: false, error: "Failed to list guides" });
  }
});

router.get("/:filename", (req: Request, res: Response) => {
  const { filename } = req.params as { filename: string };

  if (!filename || !isSafeFilename(filename)) {
    res.status(400).json({ success: false, error: "Invalid filename" });
    return;
  }

  const filePath = resolve(getGuidesDir(), filename);
  if (!existsSync(filePath)) {
    res.status(404).json({ success: false, error: "Guide not found" });
    return;
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  createReadStream(filePath).pipe(res);
});

export default router;
