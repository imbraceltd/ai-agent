/**
 * Routes for vibe-code override configuration.
 *
 * Three endpoints share this router because they form one logical surface:
 *   GET  /builtin/manifest                  → defaults the FE renders against
 *   POST /:assistant_id/import-config       → write overrides to MongoDB
 *   GET  /:assistant_id/effective-config    → read resolved override state
 *
 * Order matters: `/builtin/manifest` is declared FIRST so Express matches it
 * before the `/:assistant_id/...` param routes — otherwise `:assistant_id`
 * would greedily consume the literal "builtin" segment.
 */

import { Router } from "express";
import type { Router as RouterType } from "express";
import {
  getEffectiveConfig,
  importAssistantConfig,
} from "@/controllers/assistantConfigController";
import { getBuiltinManifest } from "@/controllers/builtinManifestController";

const router: RouterType = Router();

router.get("/builtin/manifest", getBuiltinManifest);
router.post("/:assistant_id/import-config", importAssistantConfig);
router.get("/:assistant_id/effective-config", getEffectiveConfig);

export default router;
