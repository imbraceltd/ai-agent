import { z } from "zod";
import { spawn } from "child_process";
import { DuckDBBinary } from "./duckdb-binary";

/**
 * DuckDB Engine - Native CLI Execution
 * Uses Bun.spawn to execute DuckDB CLI commands
 * Supports in-memory database with S3 file access
 */

// ============================================
// Result Schemas
// ============================================
const QueryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.string(), z.unknown())),
  rowCount: z.number(),
});
export type QueryResult = z.infer<typeof QueryResultSchema>;

const ExecResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  affectedRows: z.number().optional(),
});
export type ExecResult = z.infer<typeof ExecResultSchema>;

const DuckDBErrorSchema = z.object({
  error: z.literal(true),
  message: z.string(),
  hint: z.string().optional(),
});
export type DuckDBError = z.infer<typeof DuckDBErrorSchema>;

export interface QueryOptions {
  timeout?: number;
}

// ============================================
// Helper Functions
// ============================================
/**
 * Execute a command and return stdout/stderr
 */
function executeCommand(
  command: string,
  args: string[],
  signal: AbortSignal,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args);
    let stdout = "";
    let stderr = "";

    // Handle abort signal
    signal.addEventListener("abort", () => {
      proc.kill();
      reject(new Error("AbortError"));
    });

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("error", (error) => {
      reject(error);
    });

    proc.on("close", (exitCode) => {
      resolve({ stdout, stderr, exitCode: exitCode || 0 });
    });
  });
}

/**
 * Parse DuckDB JSON output
 * DuckDB CLI outputs JSON array with newlines between elements
 */
function parseOutput(stdout: string): Record<string, unknown>[] {
  const trimmed = stdout.trim();
  if (!trimmed || trimmed === "[]") return [];

  try {
    // DuckDB outputs valid JSON array, possibly with newlines
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch (error) {
    // If parsing fails, return empty array
    return [];
  }
}

/**
 * Get helpful hint for common errors
 */
function getErrorHint(stderr: string): string | undefined {
  if (stderr.includes("No such file"))
    return "Check file path. Use absolute path or s3:// URL.";
  if (stderr.includes("does not exist"))
    return "Table or file not found. Check the path.";
  if (stderr.includes("Conversion Error"))
    return "Data type mismatch. Use TRY_CAST() or COALESCE()";
  if (stderr.includes("Permission denied"))
    return "Cannot access file. Check file permissions or S3 credentials.";
  if (stderr.includes("Parser Error"))
    return "Invalid SQL syntax. Check your query.";
  if (stderr.includes("Catalog Error"))
    return "Extension or table not found. Install required extensions.";
  if (stderr.includes("HTTP Error"))
    return "Failed to access S3 file. Check credentials and bucket permissions.";
  return undefined;
}

/**
 * Check if SQL query uses st_read() which requires the spatial extension
 * @param sql SQL query string
 * @returns True if the query contains st_read function calls
 */
function containsSpatialReference(sql: string): boolean {
  return /\bst_read\s*\(/i.test(sql);
}

/**
 * Prepare SQL with required extensions and configuration
 * Auto-detects S3 references and spatial functions (st_read) to prepend
 * the necessary INSTALL/LOAD statements.
 */
function prepareSQL(sql: string): string {
  const prefixes: string[] = [];

  // Auto-load spatial extension for st_read() (used for Excel/XLSX files)
  if (containsSpatialReference(sql)) {
    prefixes.push("INSTALL spatial;\nLOAD spatial;");
  }

  // Auto-configure S3 credentials for s3:// URLs
  if (DuckDBBinary.containsS3Reference(sql)) {
    const s3Config = DuckDBBinary.getS3ConfigSQL();
    if (s3Config) {
      prefixes.push(s3Config);
    }
  }

  if (prefixes.length > 0) {
    return `${prefixes.join("\n\n")}\n\n${sql}`;
  }

  return sql;
}

// ============================================
// DuckDB Engine Namespace
// ============================================
export namespace DuckDBEngine {
  /**
   * Execute SELECT query, return JSON results
   * Uses in-memory database (:memory:)
   */
  export async function query(
    sql: string,
    options?: QueryOptions,
  ): Promise<QueryResult | DuckDBError> {
    const timeout = options?.timeout ?? 60000;
    const binary = DuckDBBinary.getBinaryPath();
    const finalSQL = prepareSQL(sql);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Use :memory: database with -json flag for JSON output
      const { stdout, stderr, exitCode } = await executeCommand(
        binary,
        [":memory:", "-json", "-c", finalSQL],
        controller.signal,
      );

      if (exitCode !== 0) {
        return {
          error: true,
          message: stderr || `DuckDB exited with code ${exitCode}`,
          hint: getErrorHint(stderr),
        };
      }

      const rows = parseOutput(stdout);

      return {
        columns: rows.length > 0 && rows[0] ? Object.keys(rows[0]) : [],
        rows,
        rowCount: rows.length,
      };
    } catch (e: unknown) {
      const error = e as Error;
      if (error.message === "AbortError") {
        return {
          error: true,
          message: `Query timeout after ${timeout}ms`,
        };
      }
      return {
        error: true,
        message: error.message || String(e),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Execute INSERT/UPDATE/DELETE/CREATE/DROP
   * Returns affected rows count when possible
   */
  export async function exec(
    sql: string,
    options?: QueryOptions,
  ): Promise<ExecResult | DuckDBError> {
    const timeout = options?.timeout ?? 60000;
    const binary = DuckDBBinary.getBinaryPath();
    const finalSQL = prepareSQL(sql);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Use :memory: database without -json flag
      const { stdout, stderr, exitCode } = await executeCommand(
        binary,
        [":memory:", "-c", finalSQL],
        controller.signal,
      );

      if (exitCode !== 0) {
        return {
          error: true,
          message: stderr || `DuckDB exited with code ${exitCode}`,
          hint: getErrorHint(stderr),
        };
      }

      // Try to extract row count from output
      // DuckDB may output "X Rows" or similar
      const rowMatch = stdout.match(/(\d+)\s*[Rr]ows?/);
      const affectedRows =
        rowMatch && rowMatch[1] ? parseInt(rowMatch[1], 10) : undefined;

      return {
        success: true,
        message: stdout.trim() || "OK",
        affectedRows,
      };
    } catch (e: unknown) {
      const error = e as Error;
      if (error.message === "AbortError") {
        return {
          error: true,
          message: `Query timeout after ${timeout}ms`,
        };
      }
      return {
        error: true,
        message: error.message || String(e),
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if DuckDB is available
   */
  export async function isAvailable(): Promise<boolean> {
    try {
      const binary = DuckDBBinary.getBinaryPath();
      const { exitCode } = await executeCommand(
        binary,
        ["-version"],
        new AbortController().signal,
      );
      return exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Get DuckDB version
   */
  export async function version(): Promise<string | null> {
    try {
      const binary = DuckDBBinary.getBinaryPath();
      const { stdout, exitCode } = await executeCommand(
        binary,
        ["-version"],
        new AbortController().signal,
      );
      if (exitCode === 0) {
        return stdout.trim();
      }
      return null;
    } catch {
      return null;
    }
  }
}
