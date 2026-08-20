import { Request, Response } from "express";
import logger from "@/lib/logger";
import config from "@/config";
import s3 from "@/core/modules/s3";
import * as fs from "fs";
import * as path from "path";
import { sanitizeName } from "@/utils/parseHelpers";

// Storage type definition
type StorageType = "s3" | "local";

/**
 * Initialize DuckDB configuration with S3 support
 */
async function initS3Config(connection: any): Promise<void> {
  try {
    // Load the httpfs extension to enable HTTP/HTTPS support
    await connection.run("INSTALL httpfs;\n LOAD httpfs;");

    // Install and load AWS extension
    await connection.run("INSTALL aws;\n LOAD aws;");

    // Create S3 secret with proper credentials
    await connection.run(`
      CREATE SECRET encrypted (
        TYPE s3,
        KEY_ID '${config.aws.accessKeyId}',
        SECRET '${config.aws.secretAccessKey}',
        REGION '${config.aws.region_s3}',
        ENDPOINT 's3.${config.aws.region_s3}.amazonaws.com',
        SCOPE 's3://${config.storage.s3.bucket}'
      );
    `);

    logger.info("DuckDB S3 extensions and secret configured successfully.");
  } catch (error) {
    logger.error("Error initializing DuckDB S3 config:", error);
    throw error;
  }
}

/**
 * Initialize DuckDB configuration for local storage
 */
async function initLocalConfig(_connection: any): Promise<void> {
  try {
    // Ensure the local storage directory exists
    const basePath = config.storage.local.basePath;
    const fullPath = path.join(basePath, config.storage.s3.prefix);

    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      logger.info(`Created local storage directory: ${fullPath}`);
    }

    logger.info("DuckDB local storage configured successfully.");
  } catch (error) {
    logger.error("Error initializing DuckDB local config:", error);
    throw error;
  }
}

/**
 * Generate Parquet file from JSON data and upload to S3 or local storage
 * Storage type is determined by STORAGE_TYPE environment variable
 * @route POST /api/parquet/generate
 * @body { data: Array, fileName?: string }
 * fileName example: "Engagement_Letter_Marketer_In_The_Loop_LLC_Social_Media_Strategy"
 */
export const generateParquet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    let data: any[];
    let providedFileName: string | undefined;
    let folderName: string | undefined;

    if (Array.isArray(req.body)) {
      // Direct array format
      data = req.body;
      providedFileName = undefined;
      folderName = undefined;
    } else if (req.body && typeof req.body === "object") {
      // Object format with data property
      data = req.body["data"];
      providedFileName = req.body["fileName"];
      folderName = req.body["folderName"];
    } else {
      res.status(400).json({
        error: "Input must be a JSON array or object with 'data' array",
      });
      return;
    }

    // Validate input
    if (!Array.isArray(data)) {
      res.status(400).json({ error: "Input 'data' must be a JSON array" });
      return;
    }

    if (data.length === 0) {
      res.status(400).json({ error: "Input array cannot be empty" });
      return;
    }

    // Generate filename with date prefix
    const datePrefix = new Date()
      .toISOString()
      .split("T")[0]!
      .replace(/-/g, "");

    // Sanitize and use provided filename or generate default
    let fileName: string;
    if (providedFileName && typeof providedFileName === "string") {
      fileName = `${datePrefix}_${sanitizeName(providedFileName)}`;
    } else {
      // Generate default filename
      fileName = `${datePrefix}_data_${Date.now()}`;
    }

    // Sanitize folderName if provided
    const sanitizedFolderName = (folderName && typeof folderName === "string")
      ? sanitizeName(folderName)
      : undefined;

    logger.info(`Processing ${data.length} records for parquet conversion`, {
      fileName,
      folderName: sanitizedFolderName,
    });

    // Create a new DuckDB instance in memory (lazy import to avoid crash if native bindings are missing)
    const { DuckDBInstance } = await import("@duckdb/node-api");
    const threads = config.duckdb?.threads || 4;
    const db = await DuckDBInstance.create(":memory:", {
      threads: String(threads),
    });

    const connection = await db.connect();

    try {
      // Determine storage type from environment configuration
      const storageType = config.storage.type;

      // Initialize DuckDB configuration based on storage type
      if (storageType === "s3") {
        await initS3Config(connection);
      } else {
        await initLocalConfig(connection);
      }

      // Step 1: Create a temporary table from JSON data
      // Convert the data to a format DuckDB can work with
      logger.info("Creating temporary table from JSON data");

      // Insert data into a temporary table
      const columns = Object.keys(data[0]);
      const columnDefs = columns
        .map((col) => `"${col.replace(/"/g, '""')}" VARCHAR`)
        .join(", ");

      await connection.run(`
        CREATE TABLE temp_data (
          ${columnDefs}
        );
      `);

      // Insert records in batches for better performance
      const batchSize = 1000;
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);
        const values = batch
          .map((row) => {
            const vals = columns
              .map((col) => {
                const value = row[col];
                if (value === null || value === undefined) return "NULL";
                return `'${String(value).replace(/'/g, "''")}'`;
              })
              .join(", ");
            return `(${vals})`;
          })
          .join(", ");

        await connection.run(`
          INSERT INTO temp_data VALUES ${values};
        `);
      }

      logger.info(`Inserted ${data.length} records into temporary table`);

      // Step 2: Export Parquet file based on storage type
      const prefix = config.storage.s3.prefix;
      let outputPath: string;
      let responseData: Record<string, any>;

      if (storageType === "s3") {
        // S3 Storage
        const bucketName = config.storage.s3.bucket;
        const s3Key = sanitizedFolderName
          ? `${prefix}/${sanitizedFolderName}/${fileName}.parquet`
          : `${prefix}/${fileName}.parquet`;

        if (!bucketName) {
          throw new Error("S3 Bucket name is not configured");
        }

        outputPath = `s3://${bucketName}/${s3Key}`;
        logger.info(`Uploading to S3: ${outputPath}`);

        await connection.run(`
          COPY temp_data TO '${outputPath}' (FORMAT 'parquet');
        `);

        logger.info("Successfully uploaded parquet file to S3");

        const s3Url = `https://${bucketName}.s3.${config.aws.region_s3}.amazonaws.com/${s3Key}`;
        responseData = {
          storageType: "s3",
          s3Key: s3Key,
          s3Url: s3Url,
          folderName: sanitizedFolderName,
        };
      } else {
        // Local Storage
        const basePath = config.storage.local.basePath || '/mnt/data/files/aiToolLoopAgent/';
        const localDir = sanitizedFolderName
          ? path.join(basePath, prefix, sanitizedFolderName)
          : path.join(basePath, prefix);
        const localFilePath = path.join(localDir, `${fileName}.parquet`);

        // Ensure directory exists
        if (!fs.existsSync(localDir)) {
          fs.mkdirSync(localDir, { recursive: true });
        }

        outputPath = localFilePath;
        logger.info(`Saving to local storage: ${outputPath}`);

        await connection.run(`
          COPY temp_data TO '${outputPath}' (FORMAT 'parquet');
        `);

        logger.info("Successfully saved parquet file to local storage");

        responseData = {
          storageType: "local",
          localPath: localFilePath,
          folderName: sanitizedFolderName,
        };
      }

      // Step 3: Get file schema for response
      const schemaResult = await connection.runAndReadAll("DESCRIBE temp_data");
      const schema = schemaResult.getRowObjectsJson();

      // Step 4: Response
      res.status(200).json({
        success: true,
        message: `Parquet file generated and saved to ${storageType} successfully`,
        ...responseData,
        recordCount: data.length,
        schema: schema,
        fileName: fileName,
      });
    } finally {
      // Connection is automatically cleaned up by @duckdb/node-api
    }
  } catch (error) {
    logger.error("Error generating/uploading parquet file", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: "Failed to generate or upload parquet file",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Delete a Parquet file from S3 or local storage
 * Storage type is determined by STORAGE_TYPE environment variable
 * @route DELETE /api/parquet/:fileName
 * @param fileName - Name of the parquet file to delete (without .parquet extension)
 */
export const deleteParquet = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { fileName } = req.params;
    const folderName = req.query["folderName"] || req.body["folderName"];

    if (!fileName) {
      res.status(400).json({ error: "fileName parameter is required" });
      return;
    }

    // Sanitize filename to prevent path traversal
    const sanitizedFileName = sanitizeName(fileName);

    if (!sanitizedFileName) {
      res.status(400).json({ error: "Invalid fileName" });
      return;
    }

    const storageType = config.storage.type;
    const prefix = config.storage.s3.prefix;

    // Sanitize folderName if provided
    const sanitizedFolderName = (folderName && typeof folderName === "string")
      ? sanitizeName(folderName)
      : undefined;

    logger.info(`Attempting to delete parquet file: ${sanitizedFileName}`, {
      storageType,
      folderName: sanitizedFolderName,
    });

    if (storageType === "s3") {
      // Delete from S3 using AWS SDK
      const bucketName = config.storage.s3.bucket;
      const s3Key = sanitizedFolderName
        ? `${prefix}/${sanitizedFolderName}/${sanitizedFileName}.parquet`
        : `${prefix}/${sanitizedFileName}.parquet`;

      try {
        await s3.deleteFile(bucketName, s3Key);

        logger.info(`Successfully deleted S3 parquet file: s3://${bucketName}/${s3Key}`);

        res.status(200).json({
          success: true,
          message: "Parquet file deleted successfully",
          storageType: "s3",
          fileName: sanitizedFileName,
          s3Key: s3Key,
          s3Url: `https://${bucketName}.s3.${config.aws.region_s3}.amazonaws.com/${s3Key}`,
        });
      } catch (err) {
        logger.error("Error deleting S3 parquet file", {
          error: err instanceof Error ? err.message : String(err)
        });
        res.status(500).json({
          success: false,
          error: "Failed to delete S3 file",
          details: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // Delete from local storage
      const basePath = config.storage.local.basePath;
      const localFilePath = sanitizedFolderName
        ? path.join(basePath, prefix, sanitizedFolderName, `${sanitizedFileName}.parquet`)
        : path.join(basePath, prefix, `${sanitizedFileName}.parquet`);

      // Check if file exists
      if (!fs.existsSync(localFilePath)) {
        res.status(404).json({
          error: "File not found",
          fileName: sanitizedFileName,
          localPath: localFilePath,
        });
        return;
      }

      // Delete the file
      fs.unlinkSync(localFilePath);

      logger.info(`Successfully deleted parquet file: ${localFilePath}`);

      res.status(200).json({
        success: true,
        message: "Parquet file deleted successfully",
        storageType: "local",
        fileName: sanitizedFileName,
        localPath: localFilePath,
      });
    }
  } catch (error) {
    logger.error("Error deleting parquet file", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: "Failed to delete parquet file",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * List all Parquet files from S3 or local storage
 * Storage type is determined by STORAGE_TYPE environment variable
 * @route GET /api/parquet/files
 */
export const listParquetFiles = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const folderName = req.query["folderName"] as string | undefined;
    const storageType = config.storage.type;
    const prefix = folderName
      ? `${config.storage.s3.prefix}/${folderName}`
      : config.storage.s3.prefix;

    logger.info("Listing parquet files", { storageType, folderName });

    if (storageType === "s3") {
      // List files from S3 using AWS SDK
      const bucketName = config.storage.s3.bucket;

      try {
        const s3Files = await s3.listFiles(bucketName, prefix);

        const files = s3Files.map((file) => {
          const fileName = file.key.split('/').pop()?.replace('.parquet', '') || '';
          return {
            fileName: fileName,
            filePath: file.key,
            s3Url: `https://${bucketName}.s3.${config.aws.region_s3}.amazonaws.com/${file.key}`,
            size: file.size,
            sizeFormatted: formatBytes(file.size),
            lastModified: file.lastModified?.toISOString(),
          };
        }).sort((a, b) => {
          // Sort by lastModified descending (newest first)
          if (!a.lastModified || !b.lastModified) return 0;
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        });

        res.status(200).json({
          success: true,
          storageType: "s3",
          bucket: bucketName,
          prefix: prefix,
          count: files.length,
          files: files,
        });
      } catch (err) {
        // Error accessing S3
        logger.error("Error listing S3 parquet files", {
          error: err instanceof Error ? err.message : String(err)
        });
        res.status(500).json({
          success: false,
          error: "Failed to list S3 files",
          details: err instanceof Error ? err.message : String(err),
        });
      }
    } else {
      // List files from local storage
      const basePath = config.storage.local.basePath;
      const localDir = path.join(basePath, prefix);

      // Check if directory exists
      if (!fs.existsSync(localDir)) {
        res.status(200).json({
          success: true,
          storageType: "local",
          basePath: localDir,
          count: 0,
          files: [],
        });
        return;
      }

      // Helper for recursive listing
      const getFilesRecursively = (dir: string): string[] => {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach((file) => {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          if (stat && stat.isDirectory()) {
            results = results.concat(getFilesRecursively(filePath));
          } else if (file.endsWith(".parquet")) {
            results.push(filePath);
          }
        });
        return results;
      };

      const allParquetFiles = getFilesRecursively(localDir);
      const parquetFiles = formatParquetFiles(basePath, allParquetFiles, folderName);

      logger.info(`Found ${parquetFiles.length} parquet files in local storage`);

      res.status(200).json({
        success: true,
        storageType: "local",
        basePath: localDir,
        count: parquetFiles.length,
        files: parquetFiles,
      });
    }
  } catch (error) {
    logger.error("Error listing parquet files", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      error: "Failed to list parquet files",
      details: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Map local files to API response objects
 */
function formatParquetFiles(basePath: string, allParquetFiles: string[], folderName: string | undefined) {
  return allParquetFiles
    .map((filePath) => {
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(path.join(basePath, config.storage.s3.prefix), filePath);
      const pathParts = relativePath.split(path.sep);
      const fileName = pathParts.pop()?.replace(".parquet", "") || "";
      const fileFolderName = pathParts.length > 0 ? pathParts.join("/") : (folderName || "");

      return {
        fileName,
        folderName: fileFolderName,
        filePath: filePath,
        size: stats.size,
        sizeFormatted: formatBytes(stats.size),
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
}

/**
 * Helper function to format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

