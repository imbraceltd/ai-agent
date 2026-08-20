/**
 * MCP Configuration Routes
 * Handles HTTP streamable MCP server verification and tool management
 */

import { Router } from "express";
import * as mcpController from "@/controllers/mcpController";
import { authorize } from "@/middleware/authorize";
import type { Router as RouterType } from "express";

const router: RouterType = Router();

router.post("/verify", authorize, mcpController.verifyMCPServer);
// router.post("/tools", authorize, mcpController.listMCPTools);

export default router;
