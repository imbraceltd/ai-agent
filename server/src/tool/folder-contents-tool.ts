import { tool } from "ai";
import { z } from "zod";
import axios from "axios";
import logger from "@/lib/logger";
import { getToolContext } from "@/core/agents/tool/toolContext";
import config from "@/config";
import { fetchSubfolders } from "@/services/folderService";
import { credentialHeader } from "@/utils/credential";

// ─── Types ───────────────────────────────────────────────────────────

/** Parquet record from the /api/v3/ai/parquets API */
interface ParquetRecord {
  _id: string;
  id: string;
  file_name: string;
  organization_id: string;
  folder_id: string;
  board_id: string | null;
  boarditem_id: string | null;
  s3_path: string;
  description: string;
  columns: string[];
  row_count: number;
  column_count: number;
  file_type: string;
  file_size: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/** Unified file output for LLM consumption */
interface FileEntry {
  file_id?: string;
  file_name: string;
  folder_path: string;
  folder_id: string;
  /** "tabular" → use duckdb_query with s3_path; "document" → use RAGknowledge */
  type: "tabular" | "document";
  /** S3 parquet URL — only present for tabular files */
  s3_path?: string;
  /** Data description — only present for tabular files */
  description?: string;
  /** Column names — only present for tabular files */
  columns?: string[];
  /** Row count — only present for tabular files */
  row_count?: number;
}

// ─── API helpers ─────────────────────────────────────────────────────

/**
 * Fetch parquet records for the given folder_ids via the v3 AI parquets API.
 * @param folderIds - Folder IDs
 * @param organizationId - Organization ID
 * @param xAccessToken - Access token for authentication
 * @returns Array of parquet records
 */
async function fetchParquetsByFolders(
  folderIds: string[],
  organizationId: string,
  xAccessToken: string,
): Promise<ParquetRecord[]> {
  const baseUrl = config.webApp.url;
  const url = `${baseUrl}/api/v3/ai/parquets`;

  const response = await axios.get(url, {
    params: {
      organization_id: organizationId,
      folder_ids: folderIds,
      boarditem_id: "",
      board_id: "",
    },
    // Reason: The API expects repeated query params (folder_ids=id1&folder_ids=id2),
    // not comma-separated (folder_ids=id1,id2). Custom serializer handles arrays.
    paramsSerializer: (params) => {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (Array.isArray(value)) {
          for (const v of value) {
            searchParams.append(key, v);
          }
        } else {
          searchParams.append(key, String(value));
        }
      }
      return searchParams.toString();
    },
    headers: {
      Accept: "application/json",
      ...credentialHeader(xAccessToken),
    },
  });

  if (!response.data?.success) {
    throw new Error(
      response.data?.message || "Failed to fetch parquet records",
    );
  }

  return (response.data.data || []) as ParquetRecord[];
}

// ─── Tool definition ─────────────────────────────────────────────────

/**
 * Tool that retrieves ALL files from the assistant's configured folder_ids.
 * Calls two APIs sequentially then merges into a single file list:
 * 1. data-board subfolders API → gets every file (PDFs, docs, images, etc.)
 * 2. parquets API → gets S3 parquet links for tabular data
 * 3. Merge: if parquets API has a file → replace with s3_path from parquets
 */
export const folderContentsTool = tool({
  description: `MANDATORY FIRST STEP: Retrieve ALL files from the assistant's configured knowledge folders.

⚠️ CRITICAL: You MUST call this tool BEFORE using duckdb_query or RAGknowledge when the user asks about any file or data.
DO NOT guess or construct s3_path URLs yourself — only use s3_path values returned by this tool.
DO NOT use URLs from RAGknowledge sources as duckdb_query input — those are ingested text files, NOT queryable data files.

The result is a single merged file list. Each file has a "type" field:
1. **tabular** files (Excel, CSV) — have "s3_path" field pointing to a .parquet file. Query them with duckdb_query:
   SELECT * FROM "s3://bucket/path/file.parquet" LIMIT 10
2. **document** files (PDF, Word, etc.) — do NOT have s3_path. Search them with RAGknowledge tool.

REQUIRED WORKFLOW:
1. ALWAYS call this tool first → get the file list with correct s3_path values
2. For tabular files → use the exact s3_path from this tool's output with duckdb_query
3. For document files → use RAGknowledge with relevant search queries
4. NEVER skip step 1 — without it you will use wrong file paths and get errors`,
  inputSchema: z.object({
    tool_title: z
      .string()
      .describe(
        "User-facing title explaining what you are doing, e.g. 'Listing files in knowledge folders'",
      ),
  }),
  execute: async ({ tool_title }: { tool_title: string }) => {
    try {
      logger.info("Executing folder contents tool", { tool_title });

      const toolContext = getToolContext();
      const assistantData = toolContext.assistantData;

      const folderIds: string[] = assistantData?.folder_ids || [];
      if (folderIds.length === 0) {
        logger.info("No folder_ids configured in assistant");
        return {
          status: "success",
          message: "No folder_ids configured for this assistant.",
          files: [],
        };
      }

      const xAccessToken = toolContext.xAccessToken;
      if (!xAccessToken) {
        logger.error("Folder contents tool missing access token");
        return {
          status: "error",
          error: "Access token is missing from tool context",
        };
      }

      const organizationId = toolContext.organization_id || "";
      if (!organizationId) {
        logger.error("Folder contents tool missing organization_id");
        return {
          status: "error",
          error: "organization_id is missing from tool context",
        };
      }

      logger.info("Fetching folder contents", {
        folderIds,
        folderCount: folderIds.length,
        organizationId,
      });

      // Step 1: Fetch all files from subfolders API
      let subfolderFiles: {
        file_id: string;
        file_name: string;
        folder_path: string;
        folder_id: string;
      }[] = [];
      let allFolderIds = folderIds;
      try {
        const result = await fetchSubfolders(folderIds);
        subfolderFiles = result.files;
        allFolderIds =
          result.allFolderIds.length > 0 ? result.allFolderIds : folderIds;
        logger.info("Subfolders API response", {
          fileCount: subfolderFiles.length,
          files: subfolderFiles.map((f) => f.file_name),
          allFolderIds,
        });
      } catch (err: any) {
        logger.warn(
          "Failed to fetch subfolders, continuing with parquets only",
          {
            error: err instanceof Error ? err.message : String(err),
            url: `${config.dataBoard.url}/api/folders/subfolders`,
            status: err?.response?.status,
            statusText: err?.response?.statusText,
            responseData: err?.response?.data,
            folderIds,
          },
        );
      }

      logger.info("Subfolder files collected", {
        totalFiles: subfolderFiles.length,
        allFolderIds,
      });

      // Step 2: Fetch parquet records (tabular data with s3_path)
      // Reason: Use original folderIds (from assistant config), NOT allFolderIds.
      // The parquets API returns 0 results when subfolder IDs are included
      // because it does an exact match on folder_ids, not a hierarchical search.
      let parquetRecords: ParquetRecord[] = [];
      try {
        logger.info("Calling parquets API", {
          url: `${config.webApp.url}/api/v3/ai/parquets`,
          organizationId,
          folderIds,
          tokenPreview: xAccessToken
            ? `${xAccessToken.substring(0, 10)}...`
            : "MISSING",
        });
        parquetRecords = await fetchParquetsByFolders(
          folderIds,
          organizationId,
          xAccessToken,
        );
      } catch (err) {
        logger.warn(
          "Failed to fetch parquets, continuing without tabular data",
          {
            error: err instanceof Error ? err.message : String(err),
          },
        );
      }

      logger.info("Parquets API response", {
        count: parquetRecords.length,
        folderIds,
        records: parquetRecords.map((pr) => ({
          file_name: pr.file_name,
          s3_path: pr.s3_path,
          folder_id: pr.folder_id,
        })),
      });

      // Step 3: Build parquet lookup by file_name (normalized)
      const parquetByName = new Map<string, ParquetRecord>();
      for (const pr of parquetRecords) {
        parquetByName.set(pr.file_name.toLowerCase(), pr);
      }

      // Step 4: Merge — subfolder files as base, enrich with parquet s3_path
      const files: FileEntry[] = [];
      const seenParquets = new Set<string>();

      for (const ff of subfolderFiles) {
        const parquet = parquetByName.get(ff.file_name.toLowerCase());
        if (parquet) {
          // Reason: Deduplicate — same parquet can match multiple subfolder entries
          if (!seenParquets.has(parquet.s3_path)) {
            seenParquets.add(parquet.s3_path);
            files.push({
              file_id: ff.file_id,
              file_name: ff.file_name,
              folder_path: ff.folder_path,
              folder_id: ff.folder_id,
              type: "tabular",
              s3_path: parquet.s3_path,
              description: parquet.description,
              columns: parquet.columns,
              row_count: parquet.row_count,
            });
          }
        } else {
          files.push({
            file_id: ff.file_id,
            file_name: ff.file_name,
            folder_path: ff.folder_path,
            folder_id: ff.folder_id,
            type: "document",
          });
        }
      }

      // Reason: Add parquet files not found in subfolders (edge case: subfolders
      // API failed or parquets API has files not listed in subfolders)
      for (const pr of parquetRecords) {
        if (!seenParquets.has(pr.s3_path)) {
          seenParquets.add(pr.s3_path);
          files.push({
            file_name: pr.file_name,
            folder_path: "",
            folder_id: pr.folder_id,
            type: "tabular",
            s3_path: pr.s3_path,
            description: pr.description,
            columns: pr.columns,
            row_count: pr.row_count,
          });
        }
      }

      const tabularCount = files.filter((f) => f.type === "tabular").length;
      const documentCount = files.filter((f) => f.type === "document").length;
      const documentFileIds = files
        .filter((f) => f.type === "document" && f.file_id)
        .map((f) => f.file_id as string);

      logger.info("Folder contents merged", {
        total: files.length,
        tabularCount,
        documentCount,
        documentFileIds,
      });

      logger.info("Folder contents merged result", {
        files: files.map((f) => ({
          file_id: f.file_id,
          file_name: f.file_name,
          type: f.type,
          s3_path: f.s3_path || null,
        })),
      });

      return {
        status: "success",
        total_files: files.length,
        total_tabular: tabularCount,
        total_documents: documentCount,
        document_file_ids: documentFileIds,
        hint_tabular:
          'Use s3_path with duckdb_query. Example: SELECT * FROM "s3://bucket/path.parquet" LIMIT 10',
        hint_document:
          "Use RAGknowledge tool to search content of these files. Pass document_file_ids to RAGknowledge to restrict search to these specific files.",
        files,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("Folder contents tool execution failed", { error: message });

      return {
        status: "error",
        error: message,
      };
    }
  },
});

export default folderContentsTool;
