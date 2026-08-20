import { Router } from "express";
import * as parquetController from "@/controllers/parquetController";
import type { Router as RouterType } from "express";

const router: RouterType = Router();
// Generate parquet file from JSON data
router.post("/generate", parquetController.generateParquet);

// List all parquet files
router.get("/files", parquetController.listParquetFiles);

// Delete a parquet file
router.delete("/:fileName", parquetController.deleteParquet);

export default router;
