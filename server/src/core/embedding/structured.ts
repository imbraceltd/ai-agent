import { randomUUID } from "crypto";
// Reason: DuckDB native bindings are platform-specific and crash the server on startup
// if unavailable. Lazy import ensures the server starts even without DuckDB.
let _DuckDBInstance: typeof import("@duckdb/node-api").DuckDBInstance | null =
  null;

/** * Lazily loads and caches the DuckDBInstance class. * @returns The DuckDBInstance class from @duckdb/node-api * @throws Error if DuckDB native bindings are not available */
async function getDuckDBInstance() {
  if (!_DuckDBInstance) {
    const mod = await import("@duckdb/node-api");
    _DuckDBInstance = mod.DuckDBInstance;
  }
  return _DuckDBInstance;
}
import {
  EmbeddingService,
  FileType,
  FileStatus,
  FileParams,
  FileUploadInput,
  FileProcessingOptions,
  FileProcessingResult,
  FileQueryParams,
  StructuredSummary,
  FILE_TYPE_MAP,
  TableSchema,
  ColumnStatistics,
} from "./index";
import logger from "@/lib/logger";
import { detectAllHeadersWithStructureFromUrl } from "@/lib/tabular_file";
import config from "../../config/index";
import s3 from "../modules/s3/index";

/**
 * Sanitizes column names to make them DuckDB and LLM-friendly
 * @param columnName - The original column name to sanitize
 * @param usedNames - Set of already used names to avoid collisions
 * @returns A sanitized column name that's safe for DuckDB and easy for LLMs to work with
 */
function sanitizeColumnName(
  columnName: string,
  usedNames: Set<string>
): string {
  if (!columnName || typeof columnName !== "string") {
    columnName = "unnamed_column";
  }

  // Step 1: Remove or replace problematic characters
  let sanitized = columnName
    // Remove line breaks and excessive whitespace first
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()

    // Replace common problematic characters with underscores
    .replace(/[\/\\|<>:;"'`~!@#$%^&*()+=\[\]{}.?]/g, "_")

    // Replace hyphens with underscores (more standard for SQL)
    .replace(/-/g, "_")

    // Remove parentheses and their content completely
    .replace(/\([^)]*\)/g, "")

    // Replace remaining spaces with underscores
    .replace(/\s+/g, "_")

    // Clean up multiple underscores
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  // Step 2: Ensure it starts with a letter or underscore (DuckDB requirement)
  if (!/^[a-zA-Z_]/.test(sanitized)) {
    sanitized = "col_" + sanitized;
  }

  // Step 3: Convert to snake_case for consistency
  sanitized = sanitized.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();

  // Step 4: Handle common abbreviations and make them more LLM-friendly
  const abbreviations: Record<string, string> = {
    qty: "quantity",
    amt: "amount",
    desc: "description",
    num: "number",
    ref: "reference",
    val: "value",
    cat: "category",
    sub_cat: "subcategory",
    mgr: "manager",
    mgmt: "management",
    sec: "securities",
    etf: "etf",
    roi: "return_on_investment",
    roa: "return_on_assets",
    roe: "return_on_equity",
    p_e: "price_earnings",
    ebitda: "earnings_before_interest_taxes_depreciation_amortization",
    var: "value_at_risk",
    cvar: "conditional_value_at_risk",
  };

  // Replace common abbreviations with full words
  for (const [abbrev, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbrev}\\b`, "g");
    sanitized = sanitized.replace(regex, full);
  }

  // Step 5: Limit length and make it more readable
  if (sanitized.length > 50) {
    // Split by underscores and take meaningful parts
    const parts = sanitized.split("_").filter((part) => part.length > 2);
    if (parts.length > 3) {
      // Take first part, last part, and one middle part
      sanitized = [
        parts[0],
        parts[Math.floor(parts.length / 2)],
        parts[parts.length - 1],
      ].join("_");
    } else {
      // Just truncate
      sanitized = sanitized.substring(0, 50);
    }
  }

  // Step 6: Final cleanup - ensure no invalid characters remain
  sanitized = sanitized
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");

  // Step 7: Ensure uniqueness
  let finalName = sanitized;
  let counter = 1;
  while (usedNames.has(finalName)) {
    finalName = `${sanitized}_${counter}`;
    counter++;
  }

  // Step 8: Final validation - ensure it's not empty and valid
  if (
    !finalName ||
    finalName === "_" ||
    !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(finalName)
  ) {
    finalName = `column_${usedNames.size + 1}`;
  }

  usedNames.add(finalName);
  return finalName;
}

/**
 * Creates a mapping from original column names to sanitized column names
 * @param originalHeaders - Array of original column headers
 * @returns Object mapping original names to sanitized names
 */
function createColumnMapping(
  originalHeaders: string[]
): Record<string, string> {
  const usedNames = new Set<string>();
  const mapping: Record<string, string> = {};

  for (const header of originalHeaders) {
    const sanitized = sanitizeColumnName(header, usedNames);
    mapping[header] = sanitized;
  }

  return mapping;
}

export class StructuredEmbeddingService implements EmbeddingService {
  private databaseConnection: any; // This would be your DuckDB connection

  constructor(databaseConnection: any) {
    this.databaseConnection = databaseConnection;
  }

  async processFile(
    input: FileUploadInput,
    _options: FileProcessingOptions = {}
  ): Promise<FileProcessingResult> {
    try {
      const fileType = this.classifyFileType(input.mime_type);

      if (fileType !== FileType.STRUCTURED) {
        throw new Error(
          `File type ${input.mime_type} is not supported for structured processing`
        );
      }

      logger.info(
        `Processing structured file: ${input.file_name} (${input.mime_type})`
      );

      const fileId = randomUUID();

      // Detect headers for all sheets in the file
      logger.info(`Detecting headers for file: ${input.file_name}`);
      const headerResults = await detectAllHeadersWithStructureFromUrl(
        input.file_url
      );

      logger.info(`Found ${headerResults.length} sheets with headers`, {
        fileId,
        fileName: input.file_name,
        sheets: headerResults.map((r) => ({
          sheetName: r.sheetName,
          headerRowIndexes: r.headerRowIndexes,
          headerCount: r.allHeaders.length, // Now includes ALL headers from all detected rows
          totalHeaderRows: r.headersByRow.length,
          lastDataRowIndex: r.lastDataRowIndex,
          lastSheetRowIndex: r.lastSheetRowIndex,
          totalDataRows: r.totalDataRows,
        })),
      });

      // Get file size
      const fileSize = await this.getFileSizeFromUrl(input.file_url);

      // Process all sheets in parallel for better performance
      const processedSheets: Array<{
        sheetName: string;
        s3Key: string;
        parquetUrl: string;
        success: boolean;
        errorCount: number;
        tableSchema: TableSchema[];
        statistics: ColumnStatistics[];
        totalColumns: number;
      }> = [];

      const sanitizedBaseFileName = input.file_name
        .replace(/[^a-zA-Z0-9_.-]/g, "_")
        .replace(/\.[^/.]+$/, "");

      // Create promises for all sheet processing
      const sheetProcessingPromises = headerResults.map(async (sheetResult) => {
        logger.info(`Processing sheet: ${sheetResult.sheetName}`);

        try {
          // Generate table schema from detected headers for this sheet
          const { tableSchema, totalColumns } = this.processDetectedHeaders([sheetResult]);
          
          // Create sanitized file name for this sheet
          const sanitizedSheetName = sheetResult.sheetName.replace(
            /[^a-zA-Z0-9_.-]/g,
            "_"
          );
          const sheet_id = randomUUID();
          const sanitizedFileName =
            headerResults.length > 1
              ? `${sanitizedBaseFileName}_${sanitizedSheetName}_${sheet_id}`
              : `${sanitizedBaseFileName}_${sheet_id}`;

          logger.info(`Uploading sheet to DuckDB/S3`, {
            fileId,
            fileName: input.file_name,
            sheetName: sheetResult.sheetName,
            sanitizedFileName,
            detectedHeaders: sheetResult.allHeaders,
            headerPreservation: true,
            columnRenaming: true,
          });

          const uploadResult = await this.uploadFileToParquet(
            input.file_url,
            sanitizedFileName,
            sheetResult, // Pass entire sheet result with header info
            input.mime_type,
            true // Generate statistics during upload
          );

          // Check if the upload completely failed (no S3 key or negative error count indicates failure)
          if (
            !uploadResult.success &&
            (!uploadResult.s3Key || uploadResult.errorCount === -1)
          ) {
            logger.error(
              `Failed to upload sheet ${sheetResult.sheetName} to DuckDB/S3: ${
                uploadResult.errorCount === -1
                  ? "Upload failed"
                  : `Error count ${uploadResult.errorCount}`
              }`
            );
            return null; // Return null for failed sheets
          }

          const s3Key =
            uploadResult.s3Key || `embedding/${sanitizedFileName}.parquet`;
          const parquetUrl = uploadResult.parquetUrl || this.getS3Url(s3Key);

          const processedSheet = {
            sheetName: sheetResult.sheetName,
            s3Key,
            parquetUrl,
            success: uploadResult.success || false,
            errorCount: uploadResult.errorCount || 0,
            tableSchema,
            statistics: uploadResult.statistics || [],
            totalColumns
          };

          const logMessage = uploadResult.success
            ? `Successfully processed sheet: ${sheetResult.sheetName}`
            : `Processed sheet: ${sheetResult.sheetName} with ${uploadResult.errorCount} parsing errors`;

          logger.info(logMessage, {
            fileId,
            fileName: input.file_name,
            sheetName: sheetResult.sheetName,
            s3Key,
            parquetUrl,
            errorCount: uploadResult.errorCount || 0,
            hasErrors: !uploadResult.success,
          });

          return processedSheet;
        } catch (error) {
          logger.error(`Error processing sheet ${sheetResult.sheetName}:`, {
            error: error instanceof Error ? error.message : String(error),
            sheetName: sheetResult.sheetName,
            fileId,
            fileName: input.file_name,
          });
          return null; // Return null for failed sheets
        }
      });

      // Wait for all sheets to be processed in parallel
      logger.info(`Processing ${headerResults.length} sheets in parallel...`);
      const sheetResults = await Promise.all(sheetProcessingPromises);

      // Filter out failed sheets (null values)
      const successfulSheets = sheetResults.filter(
        (sheet): sheet is NonNullable<typeof sheet> => sheet !== null
      );
      processedSheets.push(...successfulSheets);

      // If no sheets were processed successfully, throw an error
      if (processedSheets.length === 0) {
        throw new Error("Failed to process any sheets from the file");
      }

      // Create summary using the processed sheets (statistics generated during upload)
      const firstSheet = processedSheets[0];
      const allTableSchemas = processedSheets.flatMap(
        (sheet) => sheet.tableSchema
      );
      const allStatistics = processedSheets.flatMap(
        (sheet) => sheet.statistics
      );

      const summary: StructuredSummary = {
        type: "structured",
        table_schema: allTableSchemas,
        statistics: allStatistics, // Statistics generated during upload
        total_rows: 0, // Would need to count actual data rows from DuckDB
        total_columns: allTableSchemas.length,
      };

      const fileParams: FileParams = {
        file_id: fileId,
        file_name: input.file_name,
        type: FileType.STRUCTURED,
        tags: input.tags || [],
        status: FileStatus.PROCESSED,
        file_url: input.file_url,
        summary: summary,
        meta: {
          size_bytes: fileSize,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          mime_type: input.mime_type,
          // Add detected headers metadata
          detected_headers: headerResults,
          // Add processed sheets metadata
          processed_sheets: processedSheets.map((sheet) => ({
            sheet_name: sheet.sheetName,
            s3_key: sheet.s3Key,
            parquet_url: sheet.parquetUrl,
            success: sheet.success,
            error_count: sheet.errorCount,
            total_columns: sheet.totalColumns,
          })),
          // Legacy fields for backward compatibility (using first sheet if available)
          parquet_uploaded: firstSheet?.success || false,
          error_count: processedSheets.reduce(
            (sum, sheet) => sum + sheet.errorCount,
            0
          ),
        },
      };

      logger.info(
        `Successfully processed structured file with ${processedSheets.length} sheets`,
        {
          fileId,
          fileName: input.file_name,
          totalSheets: processedSheets.length,
          successfulSheets: processedSheets.filter((s) => s.success).length,
          totalErrors: processedSheets.reduce(
            (sum, sheet) => sum + sheet.errorCount,
            0
          ),
        }
      );

      return {
        success: true,
        file_params: fileParams,
      };
    } catch (error) {
      logger.error(`Error processing structured file: ${input.file_name}`, {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : "Unknown error",
          code: "PROCESSING_ERROR",
          details: error,
        },
      };
    }
  }

  async getFile(_file_id: string): Promise<FileParams | null> {
    // TODO: Implement file retrieval from DuckDB
    throw new Error("Not implemented yet");
  }

  async listFiles(_query: FileQueryParams = {}): Promise<{
    files: FileParams[];
    total: number;
    has_more: boolean;
  }> {
    // TODO: Implement file listing from DuckDB
    throw new Error("Not implemented yet");
  }

  async updateStatus(_file_id: string, _status: FileStatus): Promise<boolean> {
    // TODO: Implement status update in DuckDB
    throw new Error("Not implemented yet");
  }

  async deleteFile(_file_id: string): Promise<boolean> {
    // TODO: Implement file deletion from DuckDB
    throw new Error("Not implemented yet");
  }

  classifyFileType(mime_type: string): FileType {
    return FILE_TYPE_MAP[mime_type] || FileType.STRUCTURED;
  }

  // Private helper methods for structured data processing
  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async loadStructuredData(_buffer: Buffer, _mimeType: string) {
    // TODO: Implement structured data loading (CSV, Excel, etc.)
    throw new Error("Not implemented yet");
  }

  private async validateAndCleanData(
    _data: any[],
    _options: FileProcessingOptions
  ) {
    // TODO: Implement data validation and cleaning
    throw new Error("Not implemented yet");
  }

  private async generateSchema(_data: any[]): Promise<TableSchema[]> {
    // TODO: Implement schema generation
    throw new Error("Not implemented yet");
  }

  private async generateStatistics(_data: any[]): Promise<ColumnStatistics[]> {
    // TODO: Implement statistics generation
    throw new Error("Not implemented yet");
  }

  private async saveToParquet(
    _data: any[],
    _fileId: string,
    _input: FileUploadInput
  ) {
    // TODO: Implement saving to DuckDB as parquet
    throw new Error("Not implemented yet");
  }

  private async generateSummary(
    data: any[],
    schema: TableSchema[],
    statistics: ColumnStatistics[]
  ): Promise<StructuredSummary> {
    // Generate structured summary
    return {
      type: "structured",
      table_schema: schema,
      statistics: statistics,
      total_rows: data.length,
      total_columns: schema.length,
    };
  }

  // Helper method to process detected headers into schema (statistics generated on-demand)
  private processDetectedHeaders(headerResults: {
    sheetName: string;
    headerRowIndexes: number[];
    allHeaders: string[];
    headersByRow: { rowIndex: number; headers: string[] }[];
  }[]): {
    tableSchema: TableSchema[];
    totalColumns: number;
  } {
    const tableSchema: TableSchema[] = [];
    let totalColumns = 0;

    headerResults.forEach((sheetResult) => {
      // Create column mapping for sanitized names
      const columnMapping = createColumnMapping(sheetResult.allHeaders);

      // Use allHeaders which contains ALL headers from all detected header rows (flattened)
      sheetResult.allHeaders.forEach((header: string) => {
        if (header && header.trim().length > 0) {
          const sanitizedColumnName = columnMapping[header];

          // Create schema entry for each column using sanitized name
          const schema: TableSchema = {
            column_name: sanitizedColumnName || header.trim(),
            column_type: "string", // Default to string, would need data analysis for actual types
            is_nullable: true,
          };
          tableSchema.push(schema);
          totalColumns++;
        }
      });
    });

    return { tableSchema, totalColumns };
  }

  // Helper method to get file size from URL
  private async getFileSizeFromUrl(url: string): Promise<number> {
    try {
      const response = await fetch(url, { method: "HEAD" });
      const contentLength = response.headers.get("content-length");
      return contentLength ? parseInt(contentLength, 10) : 0;
    } catch (error) {
      logger.warn("Could not determine file size", { url, error });
      return 0;
    }
  }

  // DuckDB initialization method
  private async initDbConfig(connection: any): Promise<void> {
    try {
      // Load the httpfs extension to enable HTTP/HTTPS support
      await connection.run("INSTALL httpfs;\n LOAD httpfs;");

      // Install and load AWS extension
      await connection.run("INSTALL aws;\n LOAD aws;");

      // Try to install and load excel extension (for Excel support)
      try {
        await connection.run("INSTALL excel;\n LOAD excel;");
        logger.info("Excel extension loaded successfully");
      } catch (error) {
        logger.warn(
          "Could not load excel extension (Excel support may be limited):",
          error
        );
      }

      // Try to install and load spatial extension (includes additional geospatial support)
      try {
        await connection.run("INSTALL spatial;\n LOAD spatial;");
        logger.info(
          "Spatial extension loaded successfully (includes Excel support)"
        );
      } catch (error) {
        logger.warn(
          "Could not load spatial extension (Excel support may be limited):",
          error
        );
      }

      // Create S3 secret with proper credentials
      await connection.run(`
        CREATE SECRET encrypted (
          TYPE s3,
          KEY_ID '${config.aws.accessKeyId}',
          SECRET '${config.aws.secretAccessKey}',
          REGION '${config.aws.region_s3}',
          ENDPOINT 's3.${config.aws.region_s3}.amazonaws.com',
          SCOPE 's3://${config.aws.s3Bucket}'
        );
      `);

      logger.info("DuckDB extensions and S3 secret configured successfully.");
    } catch (error) {
      logger.error("Error initializing DuckDB config:", error);
      throw error;
    }
  }

  // Upload file to DuckDB and S3 as Parquet
  private async uploadFileToParquet(
    fileUrl: string,
    sanitizedFileName: string,
    sheetResult: {
      sheetName: string;
      headerRowIndexes: number[];
      allHeaders: string[];
      headersByRow: { rowIndex: number; headers: string[] }[];
      lastDataRowIndex: number;
      lastSheetRowIndex: number;
      totalDataRows: number;
    },
    mimeType?: string,
    generateStatistics: boolean = false
  ): Promise<{
    success: boolean;
    fileSchemas?: any[];
    errorCount?: number;
    s3Key?: string;
    parquetUrl?: string;
    statistics?: ColumnStatistics[];
  }> {
    try {
      // Extract flattened headers from sheet result
      const flattenedHeaders = sheetResult.allHeaders;

      // Create column name mapping for sanitization
      const columnMapping = createColumnMapping(flattenedHeaders);
      const sanitizedHeaders = flattenedHeaders.map(
        (header) => columnMapping[header]
      );

      // Calculate the skip parameter for CSV files based on header row index
      // For CSV files, we want to skip all rows up to the first header row
      const headerRowSkip =
        sheetResult.headerRowIndexes.length > 0
          ? Math.min(...sheetResult.headerRowIndexes)
          : 0;

      logger.info(
        `Processing file with original headers: ${flattenedHeaders.join(", ")}`
      );
      logger.info(
        `Processing file with sanitized headers: ${sanitizedHeaders.join(", ")}`
      );
      logger.info(
        `Header row detection: skip ${headerRowSkip} rows for CSV/TSV import`
      );

      // Create a new DuckDB instance for memory
      const DuckDBInstance = await getDuckDBInstance();
      const db = await DuckDBInstance.create(":memory:", {
        threads: config.duckdb.threads,
      });

      const connection = await db.connect();

      try {
        // Initialize DuckDB configuration
        await this.initDbConfig(connection);

        // Step 1: Create temporary table with raw data based on file type
        logger.info(
          `Creating table from file: ${fileUrl} (starting from detected header row)`
        );

        // Use provided MIME type or detect it from URL as fallback
        const detectedMimeType =
          mimeType || (await this.getMimeTypeFromUrl(fileUrl));
        logger.info(
          `Using MIME type: ${detectedMimeType} for file: ${fileUrl}`
        );
        let createTableQuery = "";

        if (this.isExcelMimeType(detectedMimeType)) {
          // Excel file handling - use range to start from detected header row
          logger.info(
            `Excel file detected: ${fileUrl}. Attempting to use Excel extension with range support...`
          );
          try {
            // Try to load excel extension for proper Excel support
            await connection.run("INSTALL excel;\n LOAD excel;");
            logger.info(
              "Excel extension loaded successfully for Excel support"
            );

            // For Excel files, we can use range to start from the header row
            // Calculate the starting row for Excel (1-based indexing)
            const excelStartRow = headerRowSkip + 1; // Excel uses 1-based row indexing

            if (headerRowSkip > 0) {
              // Use range to start from the detected header row
              logger.info(
                `Excel file: Using range starting from row ${excelStartRow} (skipping ${headerRowSkip} rows)`
              );
              logger.info("Sheet result details:", { sheetResult });
              // Get sheet name for range specification
              const sheetName = sheetResult.sheetName || "Sheet1";

              // Calculate the optimal column range based on detected headers
              // Convert number of columns to Excel column letter (A, B, C... Z, AA, AB, etc.)
              // Add a reasonable buffer (5-10 columns) to account for additional data columns
              const detectedColumnCount = flattenedHeaders.length;
              const bufferColumns = Math.max(
                5,
                Math.ceil(detectedColumnCount * 0.2)
              ); // 20% buffer, minimum 5
              const numColumns = Math.max(
                detectedColumnCount + bufferColumns,
                10
              ); // At least 10 columns total
              const endColumn = this.numberToExcelColumn(numColumns);

              // Calculate the optimal row range based on detected data
              // Choice between last data row vs. last sheet row:
              // - lastDataRowIndex: last row with meaningful data (more precise, less redundant)
              // - lastSheetRowIndex: last row in sheet's defined range (more comprehensive, may include empty rows)

              // Use the sheet's actual range to include all potentially relevant rows
              // This ensures we don't miss any data that might be in the sheet's defined range
              const preferredEndRowIndex =
                sheetResult.lastSheetRowIndex >= 0
                  ? sheetResult.lastSheetRowIndex
                  : sheetResult.lastDataRowIndex;

              const actualEndRow =
                preferredEndRowIndex >= 0
                  ? preferredEndRowIndex + 1 // Convert to 1-based indexing and include the last row
                  : excelStartRow + Math.max(sheetResult.totalDataRows, 1000); // Fallback with reasonable buffer

              // For DuckDB Excel extension, when using range parameter,
              // do NOT include sheet name in range spec if using sheet parameter
              const rangeSpec = `A${excelStartRow}:${endColumn}`; // Start from header row to actual end of data

              logger.info(
                `Excel range specification: sheet='${sheetName}', range='${rangeSpec}' (${numColumns} columns: A-${endColumn}, rows: ${excelStartRow}-${actualEndRow}, detected columns: ${detectedColumnCount}, buffer: ${bufferColumns}, data rows: ${sheetResult.totalDataRows}, last data row: ${sheetResult.lastDataRowIndex}, last sheet row: ${sheetResult.lastSheetRowIndex})`
              );

              createTableQuery = `
                CREATE TABLE temp_records AS
                SELECT * 
                FROM read_xlsx('${fileUrl}', sheet='${sheetName}', range='${rangeSpec}', header=true, stop_at_empty = true, all_varchar = true);
              `;
            } else {
              // No skip needed, read normally with header=true
              logger.info(
                `Excel file: Reading from beginning with header detection`
              );
              createTableQuery = `
                CREATE TABLE temp_records AS
                SELECT * 
                FROM read_xlsx('${fileUrl}', sheet='${
                sheetResult.sheetName || "Sheet1"
              }', header=true, all_varchar = true);
              `;
            }
          } catch (excelError) {
            logger.warn(
              "Excel extension not available, trying spatial extension as fallback:",
              excelError
            );
            try {
              // Fallback to spatial extension (limited range support)
              await connection.run("INSTALL spatial;\n LOAD spatial;");
              logger.info(
                "Using spatial extension as fallback for Excel support"
              );

              // Spatial extension has limited Excel support, use basic reading
              logger.warn(
                "Range functionality may be limited with spatial extension fallback"
              );
              createTableQuery = `
                CREATE TABLE temp_records AS
                SELECT * 
                FROM st_read('${fileUrl}');
              `;
            } catch (spatialError) {
              logger.error(
                "Neither Excel nor spatial extension available for Excel support:",
                spatialError
              );
              throw new Error(
                `Excel file processing failed: Excel extension required for Excel support is not available. Please convert the Excel file to CSV format. Error: ${
                  spatialError instanceof Error
                    ? spatialError.message
                    : String(spatialError)
                }`
              );
            }
          }
        } else if (this.isCSVMimeType(detectedMimeType)) {
          // CSV file handling - skip header rows and include remaining data
          logger.info(
            `CSV file detected: ${fileUrl}. Skipping ${headerRowSkip} rows to start from header.`
          );
          createTableQuery = `
            CREATE TABLE temp_records AS
            SELECT * 
            FROM read_csv('${fileUrl}', header=true, skip=${headerRowSkip}, all_varchar = true);
          `;
        } else if (this.isTSVMimeType(detectedMimeType)) {
          // TSV file handling - skip header rows and include remaining data
          logger.info(
            `TSV file detected: ${fileUrl}. Skipping ${headerRowSkip} rows to start from header.`
          );
          createTableQuery = `
            CREATE TABLE temp_records AS
            SELECT * 
            FROM read_csv('${fileUrl}', delim='\t', header=true, skip=${headerRowSkip}, store_rejects=true, rejects_table=reject_errors);
          `;
        } else if (this.isParquetMimeType(detectedMimeType)) {
          // Parquet file handling
          createTableQuery = `
            CREATE TABLE temp_records AS
            SELECT * 
            FROM read_parquet('${fileUrl}');
          `;
        } else if (this.isJSONMimeType(detectedMimeType)) {
          // JSON file handling
          createTableQuery = `
            CREATE TABLE temp_records AS
            SELECT * 
            FROM read_json('${fileUrl}');
          `;
        } else {
          // Default to CSV for unknown MIME types - skip header rows and include remaining data
          logger.warn(
            `Unknown MIME type: ${detectedMimeType} for URL: ${fileUrl}, defaulting to CSV reader with skip=${headerRowSkip}`
          );
          createTableQuery = `
            CREATE TABLE temp_records AS
            SELECT * 
            FROM read_csv('${fileUrl}', header=true, skip=${headerRowSkip}, store_rejects=true, rejects_table=reject_errors);
          `;
        }

        // Execute the table creation query
        try {
          logger.info(`Executing query: ${createTableQuery.trim()}`);
          await connection.run(createTableQuery);
        } catch (readError) {
          // Provide more helpful error messages based on file type
          if (this.isExcelMimeType(detectedMimeType)) {
            throw new Error(
              `Excel file processing failed: ${
                readError instanceof Error
                  ? readError.message
                  : String(readError)
              }. Please ensure the file is a valid Excel format or convert to CSV for better compatibility.`
            );
          } else if (this.isJSONMimeType(detectedMimeType)) {
            throw new Error(
              `JSON file processing failed: ${
                readError instanceof Error
                  ? readError.message
                  : String(readError)
              }. Please ensure the JSON file is properly formatted and compatible with DuckDB's read_json function.`
            );
          } else {
            throw new Error(
              `File processing failed: ${
                readError instanceof Error
                  ? readError.message
                  : String(readError)
              }. Please check the file format and try again.`
            );
          }
        }

        // Step 2: Create final table with row numbers and renamed columns
        // First, get the current column names
        const describeResults = await connection.runAndReadAll(
          "DESCRIBE temp_records"
        );
        const currentColumns = describeResults.getRowObjectsJson();

        logger.info(
          `Current columns: ${currentColumns
            .map((col) => col["column_name"])
            .join(", ")}`
        );
        logger.info(`Flattened headers: ${flattenedHeaders.join(", ")}`);

        // Generate column selection with renaming
        const columnSelections = ["row_number() OVER () AS id"];

        // Determine if column renaming is needed based on file type and processing method
        // For CSV/TSV files with header=true, DuckDB automatically uses header row as column names
        // For Excel files with range and header=true, DuckDB should also use proper headers
        // Only need renaming for Excel files processed without header=true (spatial extension fallback)
        const isExcelWithoutProperHeaders =
          this.isExcelMimeType(detectedMimeType) &&
          (headerRowSkip === 0 || createTableQuery.includes("st_read")); // Spatial extension fallback

        const needsColumnRenaming =
          isExcelWithoutProperHeaders && flattenedHeaders.length > 0;

        if (needsColumnRenaming) {
          // Use sanitized headers to rename columns (mainly for Excel files without proper header support)
          logger.info(
            `Excel file without proper header support detected - applying column renaming with sanitized headers`
          );
          for (
            let i = 0;
            i < Math.min(currentColumns.length, flattenedHeaders.length);
            i++
          ) {
            const currentColumnName = currentColumns[i]?.["column_name"];
            const originalHeaderName = flattenedHeaders[i];
            const sanitizedColumnName = originalHeaderName
              ? columnMapping[originalHeaderName]
              : undefined;

            if (currentColumnName && sanitizedColumnName) {
              columnSelections.push(
                `"${currentColumnName}" AS "${sanitizedColumnName}"`
              );
              logger.debug(
                `Column mapping: "${currentColumnName}" -> "${sanitizedColumnName}" (from "${originalHeaderName}")`
              );
            } else if (currentColumnName) {
              // Keep original column name if no flattened header available
              columnSelections.push(`"${currentColumnName}"`);
            }
          }

          // Handle any remaining columns that don't have flattened headers
          for (
            let i = flattenedHeaders.length;
            i < currentColumns.length;
            i++
          ) {
            const currentColumnName = currentColumns[i]?.["column_name"];
            if (currentColumnName) {
              columnSelections.push(`"${currentColumnName}"`);
            }
          }
        } else {
          // For CSV/TSV files (which already have headers) or when no renaming is needed
          // We still need to sanitize the column names for consistency
          logger.info(
            `File has proper header support - sanitizing existing column names for consistency`
          );
          for (let i = 0; i < currentColumns.length; i++) {
            const currentColumnName = currentColumns[i]?.["column_name"];
            if (currentColumnName && typeof currentColumnName === "string") {
              // Try to find a matching original header to get the sanitized version
              let sanitizedColumnName = currentColumnName;

              // Find matching original header (case-insensitive, allowing for some variation)
              const matchingHeaderIndex = flattenedHeaders.findIndex(
                (header) => {
                  if (typeof header !== "string") return false;
                  return (
                    header.toLowerCase().trim() ===
                      currentColumnName.toLowerCase().trim() ||
                    header.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ===
                      currentColumnName
                        .replace(/[^a-zA-Z0-9]/g, "")
                        .toLowerCase()
                  );
                }
              );

              if (matchingHeaderIndex >= 0) {
                const originalHeader = flattenedHeaders[matchingHeaderIndex];
                if (originalHeader && typeof originalHeader === "string") {
                  const mappedName = columnMapping[originalHeader];
                  if (mappedName) {
                    sanitizedColumnName = mappedName;
                    logger.debug(
                      `Column mapping: "${currentColumnName}" -> "${sanitizedColumnName}" (from "${originalHeader}")`
                    );
                  }
                }
              } else {
                // Fallback: sanitize the current column name directly
                const usedNames = new Set(Object.values(columnMapping));
                sanitizedColumnName = sanitizeColumnName(
                  currentColumnName,
                  usedNames
                );
                logger.debug(
                  `Column fallback mapping: "${currentColumnName}" -> "${sanitizedColumnName}"`
                );
              }

              if (sanitizedColumnName !== currentColumnName) {
                columnSelections.push(
                  `"${currentColumnName}" AS "${sanitizedColumnName}"`
                );
              } else {
                columnSelections.push(`"${currentColumnName}"`);
              }
            }
          }
        }

        const createGoodRecordsQuery = `
          CREATE TABLE good_records AS
          SELECT
              ${columnSelections.join(",\n              ")}
          FROM temp_records;
        `;

        logger.info(
          `Creating good_records table with renamed columns: ${createGoodRecordsQuery}`
        );
        await connection.run(createGoodRecordsQuery);

        // Step 3: Drop temporary table
        await connection.run(`DROP TABLE temp_records;`);

        // Step 4: Create errors table if there are any rejects (mainly for CSV/TSV files)
        const hasRejectsTable =
          this.isCSVMimeType(detectedMimeType) ||
          this.isTSVMimeType(detectedMimeType);

        if (hasRejectsTable) {
          try {
            await connection.run(`
              CREATE TABLE IF NOT EXISTS reject_errors AS SELECT * FROM reject_errors
            `);
          } catch (error) {
            // If reject_errors table doesn't exist, it means no errors occurred
            logger.debug(
              "No reject_errors table found, assuming no errors occurred"
            );
          }
        }

        // Step 5: Export to S3 as Parquet
        const s3Key = `embedding/${sanitizedFileName}.parquet`;
        logger.info(`Uploading to S3: s3://${config.aws.s3Bucket}/${s3Key}`);

        await connection.run(`
          COPY good_records TO 's3://${config.aws.s3Bucket}/${s3Key}'
        `);

        // Check for errors (only relevant for CSV/TSV files with reject handling)
        let errorCount = 0;
        if (hasRejectsTable) {
          try {
            const errorResults = await connection.runAndReadAll(
              `SELECT count(*) FROM reject_errors`
            );
            const errorResultsJson = errorResults.getRowObjectsJson();
            errorCount =
              errorResultsJson &&
              errorResultsJson.length > 0 &&
              errorResultsJson[0]
                ? parseInt(String(errorResultsJson[0]["count_star()"]))
                : 0;
          } catch (error) {
            // If reject_errors table doesn't exist, no errors occurred
            errorCount = 0;
            logger.debug(
              "Could not check reject_errors table, assuming no errors"
            );
          }
        }

        const success = errorCount === 0;

        // Log completion status
        if (!success && hasRejectsTable) {
          logger.warn(`File processing completed with ${errorCount} errors`, {
            fileName: sanitizedFileName,
            errorCount,
          });
        }

        // Get file schema
        let fileSchemas;
        let statistics: ColumnStatistics[] = [];
        
        try {
          const schemaResults = await connection.runAndReadAll(
            "describe good_records"
          );
          fileSchemas = schemaResults.getRowObjectsJson();
          
          // Generate statistics if requested and table has data
          if (generateStatistics) {
            // Check if table has any rows before generating statistics
            const countResult = await connection.runAndReadAll("SELECT COUNT(*) as row_count FROM good_records");
            const countRows = countResult.getRowObjectsJson();
            const rowCount = countRows && countRows.length > 0 ? Number(countRows[0]?.['row_count'] || 0) : 0;
            
            if (rowCount > 0) {
              logger.info(`Generating statistics for ${sanitizedFileName} (${rowCount} rows)`);
              statistics = await this.generateStatisticsFromTable(connection, 'good_records');
              logger.info(`Generated statistics for ${statistics.length} columns in ${sanitizedFileName}`);
            } else {
              logger.info(`Skipping statistics generation for ${sanitizedFileName} - table is empty`);
              statistics = [];
            }
          }
        } catch (error) {
          logger.warn("Could not retrieve file schema or generate statistics:", error);
        }

        logger.info(
          `File processing completed successfully for ${sanitizedFileName}`,
          {
            success,
            errorCount,
            s3Key,
            fileType: this.getFileTypeFromMimeType(detectedMimeType),
          }
        );

        return {
          success,
          ...(fileSchemas && { fileSchemas }),
          errorCount,
          s3Key,
          parquetUrl: this.getS3Url(s3Key),
          ...(generateStatistics && { statistics })
        };
      } finally {
        // No need to disconnect explicitly with @duckdb/node-api - it handles cleanup automatically
      }
    } catch (error) {
      logger.error("Error uploading file to DuckDB/S3:", error);
      return {
        success: false,
        errorCount: -1,
      };
    }
  }

  // Generate column statistics on-demand from a processed file
  async getFileStatistics(
    fileName: string, 
    sheetName?: string
  ): Promise<ColumnStatistics[]> {
    try {
      // Create a new DuckDB instance for memory
      const DuckDBInstance = await getDuckDBInstance();
      const db = await DuckDBInstance.create(":memory:", {
        threads: config.duckdb.threads,
      });

      const connection = await db.connect();

      try {
        await this.initDbConfig(connection);

        // Determine the S3 key based on whether it's a multi-sheet file
        let s3Key: string;
        if (sheetName) {
          s3Key = `embedding/${fileName}_${sheetName}.parquet`;
        } else {
          s3Key = `embedding/${fileName}.parquet`;
        }

        // Load data from S3 into a temporary table
        await connection.run(`
          CREATE TABLE temp_data AS 
          SELECT * FROM read_parquet('s3://${config.aws.s3Bucket}/${s3Key}')
        `);

        // Get column information
        const schemaResult = await connection.runAndReadAll("describe temp_data");
        const columns = schemaResult.getRowObjectsJson();

        const statistics: ColumnStatistics[] = [];

        // Generate statistics for each column
        for (const column of columns) {
          const columnName = String(column['column_name'] || '');
          const columnType = String(column['column_type'] || '');

          // Skip if column name is empty
          if (!columnName) continue;

          // Escape column name for SQL queries
          const escapedColumnName = `"${columnName.replace(/"/g, '""')}"`;

          // Get basic statistics
          const basicStatsQuery = `
            SELECT 
              COUNT(*) as total_count,
              COUNT(${escapedColumnName}) as non_null_count,
              COUNT(DISTINCT ${escapedColumnName}) as distinct_count
            FROM temp_data
          `;

          const basicStats = await connection.runAndReadAll(basicStatsQuery);
          const basicStatsRows = basicStats.getRowObjectsJson();
          
          if (!basicStatsRows || basicStatsRows.length === 0) {
            logger.warn(`No statistics available for column ${columnName}`);
            continue;
          }

          const basicStatsRow = basicStatsRows[0];
          
          const totalCount = Number(basicStatsRow?.['total_count'] || 0);
          const nonNullCount = Number(basicStatsRow?.['non_null_count'] || 0);
          const nullCount = totalCount - nonNullCount;
          const distinctCount = Number(basicStatsRow?.['distinct_count'] || 0);

          // Get sample values (non-null, distinct values)
          const sampleQuery = `
            SELECT DISTINCT ${escapedColumnName} as sample_value
            FROM temp_data 
            WHERE ${escapedColumnName} IS NOT NULL 
            LIMIT 5
          `;
          
          const sampleResult = await connection.runAndReadAll(sampleQuery);
          const sampleValues = sampleResult.getRowObjectsJson()
            .map(row => row['sample_value'])
            .filter(val => val !== null && val !== undefined)
            .map(val => typeof val === 'string' || typeof val === 'number' ? val : String(val)) as (string | number)[];

          let minValue, maxValue, average;

          // For numeric columns, get min, max, and average
          if (columnType.toLowerCase().includes('int') || 
              columnType.toLowerCase().includes('double') ||
              columnType.toLowerCase().includes('float') ||
              columnType.toLowerCase().includes('decimal') ||
              columnType.toLowerCase().includes('numeric')) {
            
            try {
              const numericStatsQuery = `
                SELECT 
                  MIN(CAST(${escapedColumnName} AS DOUBLE)) as min_val,
                  MAX(CAST(${escapedColumnName} AS DOUBLE)) as max_val,
                  AVG(CAST(${escapedColumnName} AS DOUBLE)) as avg_val
                FROM temp_data 
                WHERE ${escapedColumnName} IS NOT NULL 
                AND TRY_CAST(${escapedColumnName} AS DOUBLE) IS NOT NULL
              `;
              
              const numericStats = await connection.runAndReadAll(numericStatsQuery);
              const numericStatsRows = numericStats.getRowObjectsJson();
              
              if (numericStatsRows && numericStatsRows.length > 0) {
                const numericStatsRow = numericStatsRows[0];
                minValue = numericStatsRow?.['min_val'];
                maxValue = numericStatsRow?.['max_val'];
                average = numericStatsRow?.['avg_val'];
              }
            } catch (error) {
              logger.warn(`Could not calculate numeric statistics for column ${columnName}:`, error);
            }
          }

          // For string/varchar columns, get min/max length
          else if (columnType.toLowerCase().includes('varchar') || 
                   columnType.toLowerCase().includes('char') ||
                   columnType.toLowerCase().includes('text') ||
                   columnType.toLowerCase().includes('string')) {
            
            try {
              const stringStatsQuery = `
                SELECT 
                  MIN(LENGTH(CAST(${escapedColumnName} AS VARCHAR))) as min_length,
                  MAX(LENGTH(CAST(${escapedColumnName} AS VARCHAR))) as max_length,
                  AVG(LENGTH(CAST(${escapedColumnName} AS VARCHAR))) as avg_length
                FROM temp_data 
                WHERE ${escapedColumnName} IS NOT NULL
              `;
              
              const stringStats = await connection.runAndReadAll(stringStatsQuery);
              const stringStatsRows = stringStats.getRowObjectsJson();
              
              if (stringStatsRows && stringStatsRows.length > 0) {
                const stringStatsRow = stringStatsRows[0];
                minValue = stringStatsRow?.['min_length'];
                maxValue = stringStatsRow?.['max_length'];
                average = stringStatsRow?.['avg_length'];
              }
            } catch (error) {
              logger.warn(`Could not calculate string statistics for column ${columnName}:`, error);
            }
          }

          const columnStats: ColumnStatistics = {
            column_name: columnName,
            column_type: columnType,
            distinct_count: distinctCount,
            null_count: nullCount,
            sample_values: sampleValues,
            ...(minValue !== undefined && minValue !== null && 
                (typeof minValue === 'string' || typeof minValue === 'number') && 
                { min_value: minValue }),
            ...(maxValue !== undefined && maxValue !== null && 
                (typeof maxValue === 'string' || typeof maxValue === 'number') && 
                { max_value: maxValue }),
            ...(average !== undefined && average !== null && typeof average === 'number' && 
                { average: average })
          };

          statistics.push(columnStats);
        }

        logger.info(`Generated statistics for ${statistics.length} columns`, {
          fileName,
          sheetName,
          s3Key,
          columnCount: statistics.length
        });

        return statistics;

      } finally {
        // No need to disconnect explicitly with @duckdb/node-api - it handles cleanup automatically
      }
    } catch (error) {
      logger.error("Error generating file statistics:", {
        fileName,
        sheetName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  // Helper method to get file type from MIME type for logging
  private getFileTypeFromMimeType(mimeType: string): string {
    if (this.isExcelMimeType(mimeType)) return "Excel";
    if (this.isCSVMimeType(mimeType)) return "CSV";
    if (this.isTSVMimeType(mimeType)) return "TSV";
    if (this.isParquetMimeType(mimeType)) return "Parquet";
    if (this.isJSONMimeType(mimeType)) return "JSON";
    return "Unknown";
  }

  // Helper method to get MIME type from URL
  private async getMimeTypeFromUrl(fileUrl: string): Promise<string> {
    try {
      const response = await fetch(fileUrl, { method: "HEAD" });
      const contentType = response.headers.get("content-type");
      if (contentType) {
        // Extract the main MIME type (before any semicolon)
        const mainType = contentType.split(";")[0];
        const mimeType = mainType ? mainType.trim().toLowerCase() : "text/csv";

        // If we get a generic MIME type, try to be smarter about detection
        if (
          mimeType === "text/plain" ||
          mimeType === "application/octet-stream"
        ) {
          return this.getFileTypeFromUrlFallback(fileUrl);
        }

        return mimeType;
      }
    } catch (error) {
      logger.warn("Could not determine MIME type from URL headers", {
        fileUrl,
        error,
      });
    }

    // Fallback to URL-based detection if HEAD request fails
    return this.getFileTypeFromUrlFallback(fileUrl);
  }

  // Fallback method for URL-based file type detection
  private getFileTypeFromUrlFallback(fileUrl: string): string {
    const urlLower = fileUrl.toLowerCase();
    if (urlLower.includes(".xlsx")) {
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (urlLower.includes(".xls")) {
      return "application/vnd.ms-excel";
    } else if (urlLower.includes(".csv")) {
      return "text/csv";
    } else if (urlLower.includes(".tsv") || urlLower.includes(".tab")) {
      return "text/tab-separated-values";
    } else if (urlLower.includes(".parquet")) {
      return "application/octet-stream"; // Parquet doesn't have a standard MIME type
    } else if (urlLower.includes(".json")) {
      return "application/json";
    } else if (urlLower.includes(".jsonl")) {
      return "application/x-ndjson";
    }

    // Default fallback
    return "text/csv";
  }

  // Helper methods to check MIME types
  private isExcelMimeType(mimeType: string): boolean {
    return (
      mimeType ===
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      mimeType === "application/vnd.ms-excel"
    );
  }

  private isCSVMimeType(mimeType: string): boolean {
    return (
      mimeType === "text/csv" ||
      mimeType === "application/csv" ||
      mimeType === "text/comma-separated-values" ||
      mimeType === "text/plain"
    ); // GitHub and other services often serve CSV as text/plain
  }

  private isTSVMimeType(mimeType: string): boolean {
    return (
      mimeType === "text/tab-separated-values" ||
      mimeType === "text/tsv" ||
      mimeType === "application/tsv"
    );
  }

  private isParquetMimeType(mimeType: string): boolean {
    return (
      mimeType === "application/octet-stream" ||
      mimeType === "application/parquet"
    );
  }

  private isJSONMimeType(mimeType: string): boolean {
    return (
      mimeType === "application/json" ||
      mimeType === "application/x-ndjson" ||
      mimeType === "text/json"
    );
  }

  // Get file preview from uploaded Parquet
  async getFilePreview(fileName: string, limit: number = 15): Promise<any[]> {
    try {
      // Create a new DuckDB instance for memory
      const DuckDBInstance = await getDuckDBInstance();
      const db = await DuckDBInstance.create(":memory:", {
        threads: config.duckdb.threads,
      });

      const connection = await db.connect();

      try {
        await this.initDbConfig(connection);

        // Load data from S3
        const s3Key = `embedding/${fileName}.parquet`;
        const query = `
          SELECT * 
          FROM read_parquet('s3://${config.aws.s3Bucket}/${fileName}') 
          LIMIT ${limit}
        `;
        logger.info(`Running preview query: ${query.trim()}`);
        const result = await connection.runAndReadAll(query);

        return result.getRowObjectsJson();
      } finally {
        // No need to disconnect explicitly with @duckdb/node-api - it handles cleanup automatically
      }
    } catch (error) {
      logger.error("Error getting file preview:", error);
      throw error;
    }
  }

  // Get file schema from uploaded Parquet
  async getFileSchema(fileName: string): Promise<any[]> {
    try {
      // Create a new DuckDB instance for memory
      const DuckDBInstance = await getDuckDBInstance();
      const db = await DuckDBInstance.create(":memory:", {
        threads: config.duckdb.threads,
      });

      const connection = await db.connect();

      try {
        await this.initDbConfig(connection);

        // Load data from S3 and get schema
        const s3Key = `embedding/${fileName}.parquet`;
        await connection.run(`
          CREATE TABLE temp_table AS 
          SELECT * FROM read_parquet('s3://${config.aws.s3Bucket}/${s3Key}')
        `);

        const fileSchema = await connection.runAndReadAll(
          "describe temp_table"
        );
        return fileSchema.getRowObjectsJson();
      } finally {
        // No need to disconnect explicitly with @duckdb/node-api - it handles cleanup automatically
      }
    } catch (error) {
      logger.error("Error getting file schema:", error);
      throw error;
    }
  }

  // Delete file from S3 (handles multiple sheets)
  async deleteFileFromS3(
    fileName: string,
    sheetNames?: string[]
  ): Promise<boolean> {
    try {
      if (sheetNames && sheetNames.length > 0) {
        // Delete individual sheet files
        let allDeleted = true;
        for (const sheetName of sheetNames) {
          try {
            const sanitizedSheetName = sheetName.replace(
              /[^a-zA-Z0-9_.-]/g,
              "_"
            );
            const fileKey = `embedding/${fileName}_${sanitizedSheetName}.parquet`;
            await s3.deletedFileFromS3(fileKey);
            logger.info(`Successfully deleted sheet file from S3: ${fileKey}`);
          } catch (error) {
            logger.error(
              `Error deleting sheet file ${sheetName} from S3:`,
              error
            );
            allDeleted = false;
          }
        }
        return allDeleted;
      } else {
        // Delete single file (legacy support)
        const fileKey = `embedding/${fileName}.parquet`;
        await s3.deletedFileFromS3(fileKey);
        logger.info(`Successfully deleted file from S3: ${fileKey}`);
        return true;
      }
    } catch (error) {
      logger.error("Error deleting file from S3:", error);
      return false;
    }
  }

  // Validate file by attempting to read it with DuckDB
  async validateFile(fileUrl: string, mimeType?: string): Promise<boolean> {
    try {
      // Create a new DuckDB instance for memory
      const DuckDBInstance = await getDuckDBInstance();
      const db = await DuckDBInstance.create(":memory:", {
        threads: config.duckdb.threads,
      });

      const connection = await db.connect();

      try {
        await this.initDbConfig(connection);

        // Determine the correct validation query based on MIME type
        const detectedMimeType =
          mimeType || (await this.getMimeTypeFromUrl(fileUrl));
        logger.info(
          `Validating file with MIME type: ${detectedMimeType} for URL: ${fileUrl}`
        );
        let validationQuery = "";

        if (this.isExcelMimeType(detectedMimeType)) {
          // Excel file validation
          logger.info(`Validating Excel file: ${fileUrl}`);
          try {
            // Try Excel extension first
            await connection.run("INSTALL excel;\n LOAD excel;");
            validationQuery = `
              CREATE TABLE validation_table AS
              SELECT * 
              FROM read_xlsx('${fileUrl}', header=true) 
              LIMIT 1
            `;
          } catch (excelError) {
            logger.warn(
              "Excel extension not available, trying spatial extension:",
              excelError
            );
            try {
              // Fallback to spatial extension
              await connection.run("INSTALL spatial;\n LOAD spatial;");
              validationQuery = `
                CREATE TABLE validation_table AS
                SELECT * 
                FROM st_read('${fileUrl}') 
                LIMIT 1
              `;
            } catch (spatialError) {
              logger.warn(
                "Neither Excel nor spatial extension available for Excel validation:",
                spatialError
              );
              return false;
            }
          }
        } else if (this.isCSVMimeType(detectedMimeType)) {
          // CSV file validation
          validationQuery = `
            CREATE TABLE validation_table AS
            SELECT * 
            FROM read_csv('${fileUrl}') 
            LIMIT 1
          `;
        } else if (this.isTSVMimeType(detectedMimeType)) {
          // TSV file validation
          validationQuery = `
            CREATE TABLE validation_table AS
            SELECT * 
            FROM read_csv('${fileUrl}', delim='\t') 
            LIMIT 1
          `;
        } else if (this.isParquetMimeType(detectedMimeType)) {
          // Parquet file validation
          validationQuery = `
            CREATE TABLE validation_table AS
            SELECT * 
            FROM read_parquet('${fileUrl}') 
            LIMIT 1
          `;
        } else if (this.isJSONMimeType(detectedMimeType)) {
          // JSON file validation
          validationQuery = `
            CREATE TABLE validation_table AS
            SELECT * 
            FROM read_json('${fileUrl}') 
            LIMIT 1
          `;
        } else {
          // Default to CSV for unknown MIME types
          logger.warn(
            `Unknown MIME type for validation: ${detectedMimeType}, defaulting to CSV`
          );
          validationQuery = `
            CREATE TABLE validation_table AS
            SELECT * 
            FROM read_csv('${fileUrl}') 
            LIMIT 1
          `;
        }

        // Execute validation query
        await connection.run(validationQuery);
        logger.info(
          `File validation successful for ${fileUrl} (${this.getFileTypeFromMimeType(
            detectedMimeType
          )})`
        );
        return true;
      } finally {
        // No need to disconnect explicitly with @duckdb/node-api - it handles cleanup automatically
      }
    } catch (error) {
      logger.error("Error validating file:", error);
      return false;
    }
  }

  // Helper method to construct S3 URL for a given key
  private getS3Url(s3Key: string): string {
    return `https://${config.aws.s3Bucket}.s3.${config.aws.region_s3}.amazonaws.com/${s3Key}`;
  }

  // Helper method to convert column number to Excel column letter (A, B, C... Z, AA, AB, etc.)
  private numberToExcelColumn(columnNumber: number): string {
    let result = "";
    while (columnNumber > 0) {
      columnNumber--; // Make it 0-based
      result = String.fromCharCode(65 + (columnNumber % 26)) + result;
      columnNumber = Math.floor(columnNumber / 26);
    }
    return result || "A"; // Return 'A' if input is 0 or negative
  }

  // Helper method to generate statistics from an existing table in DuckDB connection
  private async generateStatisticsFromTable(connection: any, tableName: string): Promise<ColumnStatistics[]> {
    try {
      // First check if table exists and has rows
      const tableCheckResult = await connection.runAndReadAll(`SELECT COUNT(*) as row_count FROM ${tableName}`);
      const tableCheckRows = tableCheckResult.getRowObjectsJson();
      const rowCount = tableCheckRows && tableCheckRows.length > 0 ? Number(tableCheckRows[0]?.['row_count'] || 0) : 0;
      
      if (rowCount === 0) {
        logger.info(`Table ${tableName} is empty, returning empty statistics`);
        return [];
      }

      // Get column information
      const schemaResult = await connection.runAndReadAll(`describe ${tableName}`);
      const columns = schemaResult.getRowObjectsJson();

      if (!columns || columns.length === 0) {
        logger.warn(`No columns found in table ${tableName}`);
        return [];
      }

      const statistics: ColumnStatistics[] = [];

      // Generate statistics for each column
      for (const column of columns) {
        const columnName = String(column['column_name'] || '');
        const columnType = String(column['column_type'] || '');

        // Skip if column name is empty or it's the ID column
        if (!columnName || columnName.toLowerCase() === 'id') continue;

        // Escape column name for SQL queries
        const escapedColumnName = `"${columnName.replace(/"/g, '""')}"`;

        // Get basic statistics
        const basicStatsQuery = `
          SELECT 
            COUNT(*) as total_count,
            COUNT(${escapedColumnName}) as non_null_count,
            COUNT(DISTINCT ${escapedColumnName}) as distinct_count
          FROM ${tableName}
        `;

        const basicStats = await connection.runAndReadAll(basicStatsQuery);
        const basicStatsRows = basicStats.getRowObjectsJson();
        
        if (!basicStatsRows || basicStatsRows.length === 0) {
          logger.warn(`No statistics available for column ${columnName}`);
          continue;
        }

        const basicStatsRow = basicStatsRows[0];
        
        const totalCount = Number(basicStatsRow?.['total_count'] || 0);
        const nonNullCount = Number(basicStatsRow?.['non_null_count'] || 0);
        const nullCount = totalCount - nonNullCount;
        const distinctCount = Number(basicStatsRow?.['distinct_count'] || 0);

        // Get sample values (non-null, distinct values)
        const sampleQuery = `
          SELECT DISTINCT ${escapedColumnName} as sample_value
          FROM ${tableName} 
          WHERE ${escapedColumnName} IS NOT NULL 
          LIMIT 5
        `;
        
        const sampleResult = await connection.runAndReadAll(sampleQuery);
        const sampleValues = sampleResult.getRowObjectsJson()
          .map((row: any) => row['sample_value'])
          .filter((val: any) => val !== null && val !== undefined)
          .map((val: any) => typeof val === 'string' || typeof val === 'number' ? val : String(val)) as (string | number)[];

        let minValue, maxValue, average;

        // For numeric columns, get min, max, and average
        if (columnType.toLowerCase().includes('int') || 
            columnType.toLowerCase().includes('double') ||
            columnType.toLowerCase().includes('float') ||
            columnType.toLowerCase().includes('decimal') ||
            columnType.toLowerCase().includes('numeric')) {
          
          try {
            const numericStatsQuery = `
              SELECT 
                MIN(CAST(${escapedColumnName} AS DOUBLE)) as min_val,
                MAX(CAST(${escapedColumnName} AS DOUBLE)) as max_val,
                AVG(CAST(${escapedColumnName} AS DOUBLE)) as avg_val
              FROM ${tableName} 
              WHERE ${escapedColumnName} IS NOT NULL 
              AND TRY_CAST(${escapedColumnName} AS DOUBLE) IS NOT NULL
            `;
            
            const numericStats = await connection.runAndReadAll(numericStatsQuery);
            const numericStatsRows = numericStats.getRowObjectsJson();
            
            if (numericStatsRows && numericStatsRows.length > 0) {
              const numericStatsRow = numericStatsRows[0];
              minValue = numericStatsRow?.['min_val'];
              maxValue = numericStatsRow?.['max_val'];
              average = numericStatsRow?.['avg_val'];
            }
          } catch (error) {
            logger.warn(`Could not calculate numeric statistics for column ${columnName}:`, error);
          }
        }

        // For string/varchar columns, get min/max length
        else if (columnType.toLowerCase().includes('varchar') || 
                 columnType.toLowerCase().includes('char') ||
                 columnType.toLowerCase().includes('text') ||
                 columnType.toLowerCase().includes('string')) {
          
          try {
            const stringStatsQuery = `
              SELECT 
                MIN(LENGTH(CAST(${escapedColumnName} AS VARCHAR))) as min_length,
                MAX(LENGTH(CAST(${escapedColumnName} AS VARCHAR))) as max_length,
                AVG(LENGTH(CAST(${escapedColumnName} AS VARCHAR))) as avg_length
              FROM ${tableName} 
              WHERE ${escapedColumnName} IS NOT NULL
            `;
            
            const stringStats = await connection.runAndReadAll(stringStatsQuery);
            const stringStatsRows = stringStats.getRowObjectsJson();
            
            if (stringStatsRows && stringStatsRows.length > 0) {
              const stringStatsRow = stringStatsRows[0];
              minValue = stringStatsRow?.['min_length'];
              maxValue = stringStatsRow?.['max_length'];
              average = stringStatsRow?.['avg_length'];
            }
          } catch (error) {
            logger.warn(`Could not calculate string statistics for column ${columnName}:`, error);
          }
        }

        const columnStats: ColumnStatistics = {
          column_name: columnName,
          column_type: columnType,
          distinct_count: distinctCount,
          null_count: nullCount,
          sample_values: sampleValues,
          ...(minValue !== undefined && minValue !== null && 
              (typeof minValue === 'string' || typeof minValue === 'number') && 
              { min_value: minValue }),
          ...(maxValue !== undefined && maxValue !== null && 
              (typeof maxValue === 'string' || typeof maxValue === 'number') && 
              { max_value: maxValue }),
          ...(average !== undefined && average !== null && typeof average === 'number' && 
              { average: average })
        };

        statistics.push(columnStats);
      }

      return statistics;

    } catch (error) {
      logger.error("Error generating statistics from table:", {
        tableName,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}
