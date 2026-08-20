import { tool } from "ai";
import { z } from "zod";
import logger from "@/lib/logger";
import { DuckDBEngine } from "@/lib/duckdb";

/**
 * Native DuckDB Tool - Direct CLI Execution
 *
 * This module provides:
 * 1. Native DuckDB query execution via CLI spawn
 * 2. Support for CSV, Excel, Parquet, JSON files
 * 3. S3 file access with automatic credential configuration
 * 4. In-memory database for stateless operations
 *
 * Usage:
 * - Call getDuckDBTools() to get the native DuckDB tool
 * - No MCP dependency - uses local DuckDB binary
 */

/** Maximum characters returned from a single query result to cap token usage. */
const MAX_RESULT_CHARS = 12_000;

/**
 * Format query results for AI consumption
 */
function formatResults(results: Record<string, unknown>[]): string {
  if (results.length === 0) return "No results";

  const firstRow = results[0];
  if (!firstRow) return "No results";

  const columns = Object.keys(firstRow);

  // Use compact format when result set is small enough to read inline.
  // Raised thresholds so large-but-narrow results (e.g. 52-row field lists)
  // still use the more token-efficient compact layout instead of verbose row-by-row.
  const formatted =
    columns.length <= 8 && results.length <= 80
      ? formatCompact(results, columns)
      : formatTable(results, columns);

  // Reason: Hard cap prevents runaway tool results from flooding the context window.
  // Truncation notice tells the model data was cut so it can adjust its SQL with LIMIT.
  if (formatted.length > MAX_RESULT_CHARS) {
    return (
      formatted.slice(0, MAX_RESULT_CHARS) +
      `\n\n[...truncated — ${results.length} total rows. Use LIMIT in your SQL to reduce result size.]`
    );
  }

  return formatted;
}

/**
 * Format results in compact table format
 */
function formatCompact(
  results: Record<string, unknown>[],
  columns: string[],
): string {
  const header = columns.join(" | ");
  const separator = columns
    .map((c) => "-".repeat(Math.max(c.length, 10)))
    .join("-+-");

  const rows = results.map((row) => {
    return columns
      .map((col) => {
        const value = row[col];
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "object") return JSON.stringify(value);
        return String(value);
      })
      .join(" | ");
  });

  return [header, separator, ...rows].join("\n");
}

/**
 * Format results in detailed row-by-row format
 */
function formatTable(
  results: Record<string, unknown>[],
  columns: string[],
): string {
  const lines: string[] = [];

  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    if (!row) continue;

    lines.push(`--- Row ${i + 1} ---`);

    for (const col of columns) {
      let value = row[col];
      if (value === null || value === undefined) continue;
      if (typeof value === "object") value = JSON.stringify(value);
      lines.push(`${col}: ${value}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Native DuckDB query tool
 */
const nativeDuckDBTool = tool({
  description: `Execute a single DuckDB SQL query. Takes one \`sql\` string and returns results.

## PRECONDITION — DO NOT CALL WITHOUT A REAL DATA PATH
You MUST have a concrete, verified file path before calling this tool. Valid sources:
  1. An S3/HTTPS/local path explicitly provided in the system prompt or CHAT CONTEXT.
  2. A path returned by \`folderContentsTool\` in the current conversation.
  3. A path returned by another tool result earlier in this conversation.

If none of the above applies, DO NOT call this tool. Do NOT invent, guess, or use placeholder paths
such as \`s3://your-bucket/your-path.parquet\`, \`s3://bucket/file.parquet\`, or \`path/to/file\`.
When no real path is available, retrieve information via \`RAGknowledge\` or other available tools instead.

The response includes:
- \`result\`: formatted text table (for reading/summarizing)
- \`rows_json\`: raw JSON array — pass this directly to visualization tools, no conversion needed

## EAV Schema Patterns (Field = attribute name, Value = attribute value)

**Distribution (single field):**
\`\`\`sql
SELECT Value, COUNT(*) as count
FROM "s3://..."
WHERE Field = 'status'
GROUP BY Value ORDER BY count DESC
\`\`\`

**Date range:**
\`\`\`sql
SELECT DATE_TRUNC('month', CAST(Value AS DATE)) as month, COUNT(*) as count
FROM "s3://..."
WHERE Field = 'end_date'
  AND CAST(Value AS DATE) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '24 months')
GROUP BY 1 ORDER BY 1
\`\`\`

**Cross-field (conditional aggregation — discover document ID column first):**
\`\`\`sql
SELECT
  MAX(CASE WHEN Field = 'status' THEN Value END) as status,
  MAX(CASE WHEN Field = 'client_name' THEN Value END) as client_name,
  COUNT(*) as total_records
FROM "s3://..."
GROUP BY <document_id_column>
\`\`\`

## DuckDB SQL Reference

**Identifiers and Literals:**
- Double quotes for identifiers: \`"My Column"\`, \`"s3://bucket/file.parquet"\`
- Single quotes for string literals: \`WHERE Field = 'status'\`

**Useful shortcuts:**
- \`GROUP BY ALL\` — groups by all non-aggregated columns
- \`SELECT * EXCLUDE (col)\` — select all except specific columns
- \`FROM table\` — shorthand for \`SELECT * FROM table\`

**Date/Time:**
- \`DATE_TRUNC('month', CAST(Value AS DATE))\`
- \`CAST(Value AS DATE) BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL '24 months')\`
- \`EXTRACT(YEAR FROM CAST(Value AS DATE))\`

**Advanced:**
- \`QUALIFY ROW_NUMBER() OVER (...) <= N\` — filter window function results
- \`arg_max(col, order_col)\` — value of col at max of order_col
- Use CTEs for complex multi-step queries

**Schema exploration for S3 files:**
\`\`\`sql
DESCRIBE SELECT * FROM "duckdb_databases";
SUMMARIZE SELECT * FROM "duckdb_databases";
SELECT column_name, data_type FROM dduckdb_databases;
-- Quick preview with statistics
SUMMARIZE your_table;
\`\`\`

## NEVER DO THESE
- NEVER use \`MD_ALL_DATABASES()\` or \`COPY FROM DATABASE\` — MotherDuck-only, not supported
- NEVER use \`st_read()\` for Excel — use \`read_xlsx()\` with \`INSTALL excel; LOAD excel;\`
- NEVER guess or invent S3 paths — use Mode 1 (from prompt) or Mode 2 (from folderContentsTool)
- NEVER GROUP BY a column for document counts without confirming it is unique per document
- NEVER use \`DATE_ADD('month', 24, date)\` — use \`(CURRENT_DATE + INTERVAL '24 months')\`
- NEVER use HTML entities in SQL — write \`>=\` not \`&gt;=\`, write \`<=\` not \`&lt;=\`, write \`&\` not \`&amp;\`
- NEVER use \`GROUP_CONCAT()\` — DuckDB uses \`STRING_AGG(col, ', ')\` or \`LIST_AGG(col, ', ')\`
- NEVER use a CTE cross-field pivot for simple single-field EAV queries — use a direct \`WHERE Field = 'x'\` query instead
`,

  inputSchema: z.object({
    tool_title: z
      .string()
      .describe(
        "User-facing title explaining what you are doing with this query",
      ),
    sql: z
      .string()
      .describe("Execute a SQL query on the DuckDB or MotherDuck database."),
    timeout: z
      .number()
      .optional()
      .default(600)
      .describe("Query timeout in seconds (default: 600s)"),
  }),

  execute: async (params) => {
    try {
      logger.info("Executing native DuckDB query", {
        tool_title: params.tool_title,
        sql_preview: params.sql.substring(0, 200),
        timeout: params.timeout,
      });

      const timeoutMs = params.timeout * 1000;

      // Execute query using native engine
      const result = await DuckDBEngine.query(params.sql, {
        timeout: timeoutMs,
      });

      // Handle errors
      if ("error" in result) {
        logger.error("DuckDB query error", {
          message: result.message,
          hint: result.hint,
        });

        return {
          status: "error",
          error: result.message,
          hint: result.hint,
          timestamp: new Date().toISOString(),
        };
      }

      // Handle successful query
      logger.info("DuckDB query successful", {
        rowCount: result.rowCount,
        columnCount: result.columns.length,
      });

      if (result.rowCount === 0) {
        return {
          status: "success",
          result: "Query executed successfully. No results returned.",
          metadata: {
            rowCount: 0,
            columns: result.columns,
          },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        status: "success",
        result: formatResults(result.rows as Record<string, unknown>[]),
        rows_json: result.rows,
        metadata: {
          rowCount: result.rowCount,
          columns: result.columns,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("DuckDB tool execution error:", error);

      return {
        status: "error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  },
});

/**
 * Get all DuckDB tools
 * Returns a single native DuckDB query tool
 * Maintains API compatibility with previous MCP-based implementation
 */
export async function getDuckDBTools(): Promise<Record<string, any>> {
  try {
    // Check if DuckDB is available
    const isAvailable = await DuckDBEngine.isAvailable();

    if (!isAvailable) {
      logger.warn(
        "DuckDB binary not found. Tool will be unavailable. Please install DuckDB CLI.",
      );
      return {};
    }

    const version = await DuckDBEngine.version();
    logger.info("Native DuckDB tool initialized", { version });

    return {
      duckdb_query: nativeDuckDBTool,
    };
  } catch (error) {
    logger.error("Failed to initialize DuckDB tools", { error });
    return {};
  }
}

/**
 * Close DuckDB client (no-op for stateless CLI pattern)
 * Maintains API compatibility with previous MCP-based implementation
 */
export function closeDuckDBClient(): void {
  // No-op - CLI is stateless, each query is independent
  logger.debug("closeDuckDBClient called (no-op for native implementation)");
}

/**
 * Legacy export for backward compatibility
 */
export const duckdbTool = nativeDuckDBTool;

// Default export
export default duckdbTool;
