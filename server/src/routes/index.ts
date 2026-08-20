import { Router, Request, Response } from "express";
import logger from "@/lib/logger";
import {
  authorize,
  requireOrganizationId,
  requireUserAndOrgContext,
} from "@/middleware/authorize";
import { ApiResponse, HealthCheckResponse } from "@/types/api";
import * as dataBoardController from "@/controllers/dataBoardController";
import config from "@/config";
import { handleGetAgentPromptSuggestion } from "@/controllers/chatController";
import chatAgentRoutes from "./chatAgent";
import chatAgentRoutesV2 from "./chatAgentV2";
import mcpRoutes from "./mcp";
import parquetRoutes from "./parquet";
import traceRoutes from "./trace";
import type { Router as RouterType } from "express";

/**
 * API Routes with Zod validation and proper logging
 */

const router: RouterType = Router();

/**
 * GET /api/config - Configuration endpoint for client
 */
router.get("/config", (_: Request, res: Response) => {
  logger.info("Config requested", { ip: _.ip });

  const response: ApiResponse<any> = {
    success: true,
    data: {
      aichat: config.aichat,
      webapp: config.webApp,
    },
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

router.get("/health", (_req: Request, res: Response): void => {
  const healthData: HealthCheckResponse = {
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: process.env["npm_package_version"] || "1.0.0",
    environment: process.env["NODE_ENV"] || "development",
  };

  const response: ApiResponse<HealthCheckResponse> = {
    success: true,
    data: healthData,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json(response);
});

/**
 * GET /api/version - Get application version
 */
router.get("/version", async (req: Request, res: Response): Promise<void> => {
  try {
    const versionData = {
      version: process.env["npm_package_version"] || "1.0.0",
      name: process.env["npm_package_name"] || "fullstack-typescript-app",
      environment: process.env["NODE_ENV"] || "development",
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
    };

    logger.debug("Version info requested", {
      ip: req.ip,
      version: versionData.version,
    });

    const response: ApiResponse<typeof versionData> = {
      success: true,
      data: versionData,
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  } catch (error) {
    logger.error("Version endpoint error", {
      error: error instanceof Error ? error.message : String(error),
      ip: req.ip,
    });

    const errorResponse: ApiResponse = {
      success: false,
      error: "Version check failed",
      timestamp: new Date().toISOString(),
    };

    res.status(500).json(errorResponse);
  }
});

// Cache management routes
router.get("/chat/get-agent-prompt-suggestion", handleGetAgentPromptSuggestion);
router.use("/chat", authorize, requireOrganizationId, chatAgentRoutes);
router.use("/v2/chat", authorize, requireOrganizationId, chatAgentRoutesV2);

// MCP configuration routes
router.use("/mcp", mcpRoutes);
// Trace API routes (Tempo integration)
router.use("/trace", traceRoutes);
// Parquet file management routes
router.use("/parquet", parquetRoutes);

// Chat client routes (data management for imbrace-chat-bot)
import chatClientRoutes from "./chatClient";
router.use("/chat-client", chatClientRoutes);

// Data Board routes
router.post(
  "/data-board/suggest-field-types",
  authorize,
  dataBoardController.suggestFieldTypes,
);
// Server-to-server variant for backend callers (e.g. data_board service) that
// auth via gateway-injected x-user-id + x-organization-id instead of a user
// access token. Skips the upstream board-model-schema fetch.
router.post(
  "/data-board/suggest-field-types-internal",
  requireUserAndOrgContext,
  dataBoardController.suggestFieldTypesInternal,
);
// Reason: lightweight board lookup for the FE — used to resolve a name when
// the chat is launched with ?databoardId=… so the greeting can address the
// user by board name instead of by raw id.
router.get(
  "/databoard/:id",
  authorize,
  requireOrganizationId,
  dataBoardController.handleGetDataboardById,
);
// Reason: list boards filtered by `?type=` for the in-chat board switcher.
// The chat-bot exposes a dropdown of same-type sibling boards so the user
// can change scope without leaving the chat.
router.get(
  "/databoards",
  authorize,
  requireOrganizationId,
  dataBoardController.handleListDataboards,
);

// Bundled sub-agent knowledge guides (PDFs for Workflow-Developer / Databoard-Engineer)
import adminGuideRoutes from "./adminGuides";
router.use("/admin/guides", adminGuideRoutes);

// Vibe-code override surface — single router covers manifest (read defaults),
// import-config (write overrides), and effective-config (read resolved state).
import assistantConfigRoutes from "./assistantConfig";
router.use("/assistants", authorize, assistantConfigRoutes);

export default router;
