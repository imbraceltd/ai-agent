import config from "@/config";

/**
 * DuckDB Binary Configuration
 * Provides paths and configuration for DuckDB CLI operations
 */
export namespace DuckDBBinary {
  /**
   * Get the path to the DuckDB CLI binary
   * @returns Path to duckdb binary (from config or default)
   */
  export function getBinaryPath(): string {
    return config.duckdb.binaryPath;
  }

  /**
   * Get the temporary directory for DuckDB operations
   * @returns Path to temp directory
   */
  export function getTempDir(): string {
    return config.duckdb.tempDir;
  }

  /**
   * Generate SQL to configure S3 access with AWS credentials
   * This SQL should be prepended to queries that access S3 files
   * @returns SQL string to configure S3 extensions and credentials
   */
  export function getS3ConfigSQL(): string {
    const { accessKeyId, secretAccessKey, region_s3 } = config.aws;

    // Only return config SQL if credentials are available
    if (!accessKeyId || !secretAccessKey) {
      return "";
    }

    // Construct the S3 endpoint URL based on region
    // For ap-east-1 and other regions, use the regional endpoint format
    const endpoint = `s3.${region_s3}.amazonaws.com`;

    return `
-- Install and load S3 extensions
INSTALL httpfs;
LOAD httpfs;

-- Configure AWS credentials and endpoint for S3 access
SET s3_region = '${region_s3}';
SET s3_endpoint = '${endpoint}';
SET s3_url_style = 'path';
SET s3_access_key_id = '${accessKeyId}';
SET s3_secret_access_key = '${secretAccessKey}';
`.trim();
  }

  /**
   * Check if a path is an S3 URL
   * @param path File path or URL
   * @returns True if the path starts with s3://
   */
  export function isS3Path(path: string): boolean {
    return path.toLowerCase().startsWith("s3://");
  }

  /**
   * Detect if SQL query contains S3 references
   * @param sql SQL query string
   * @returns True if the query references S3 paths
   */
  export function containsS3Reference(sql: string): boolean {
    return /s3:\/\//i.test(sql);
  }
}
