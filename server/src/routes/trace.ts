import { Router } from "express";
import type { Router as RouterType } from "express";
import * as traceController from "@/controllers/traceController";

const router: RouterType = Router();

// Get traces from Tempo
router.get("/traces", traceController.getTraces);

// Get a specific trace by ID
router.get("/traces/:traceId", traceController.getTraceById);

// Get available services
router.get("/services", traceController.getServices);

// Get all available span tags
router.get("/tags", traceController.getTags);

// Get values for a specific tag
router.get("/tags/:tagName/values", traceController.getTagValues);

// Search traces using TraceQL
router.get("/search/traceql", traceController.searchTraceQL);

export default router;
