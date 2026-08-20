// File type classification
export enum FileType {
  STRUCTURED = 'structured',
  UNSTRUCTURED = 'unstructured'
}

// File processing status
export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  ERRORED = 'errored'
}

// Supported file extensions and their classifications
export const FILE_TYPE_MAP: Record<string, FileType> = {
  // Structured files (tabular data)
  'text/csv': FileType.STRUCTURED,
  'application/vnd.ms-excel': FileType.STRUCTURED,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileType.STRUCTURED,
  
  // Unstructured files (document content)
  'application/pdf': FileType.UNSTRUCTURED,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileType.UNSTRUCTURED,
  'text/plain': FileType.UNSTRUCTURED,
  'application/json': FileType.UNSTRUCTURED,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': FileType.UNSTRUCTURED,
  'text/html': FileType.UNSTRUCTURED, // web links
};

// Column statistics for structured files
export interface ColumnStatistics {
  column_name: string;
  column_type: string;
  min_value?: string | number;
  max_value?: string | number;
  average?: number;
  distinct_count: number;
  null_count: number;
  sample_values: Array<string | number>;
}

// Table schema for structured files
export interface TableSchema {
  column_name: string;
  column_type: string;
  is_nullable: boolean;
  default_value?: string;
}

// Summary for structured files
export interface StructuredSummary {
  type: 'structured';
  table_schema: TableSchema[];
  statistics: ColumnStatistics[];
  total_rows: number;
  total_columns: number;
}

// Summary for unstructured files
export interface UnstructuredSummary {
  type: 'unstructured';
  content_summary: string;
  word_count?: number;
  page_count?: number;
  language?: string;
  key_topics?: string[];
}

// Union type for file summary
export type FileSummary = StructuredSummary | UnstructuredSummary;

// Meta information
export interface FileMeta {
  size_bytes: number;
  created_at: string;
  updated_at: string;
  mime_type: string;
  encoding?: string;
  checksum?: string;
  [key: string]: any; // Allow additional metadata
}

// Core file parameters
export interface FileParams {
  file_id: string; // Unique identifier for the file
  file_name: string;
  type: FileType;
  tags: string[]; // AI-analyzed tags e.g., ['product', 'investment product', 'bonds']
  status: FileStatus;
  file_url: string;
  summary: FileSummary;
  meta: FileMeta;
}

// File upload input
export interface FileUploadInput {
  file_name: string;
  file_url: string; // URL to download the file
  mime_type: string;
  tags?: string[]; // Optional initial tags, can be populated by AI
}

// File processing options
export interface FileProcessingOptions {
  // Structured file options
  skip_rows?: number;
  validate_data?: boolean;
  generate_statistics?: boolean;
  
  // Unstructured file options
  chunk_size?: number;
  chunk_overlap?: number;
  embedding_model?: string;
  embedding_type?: 'openai' | 'lmstudio' | 'ollama';
  generate_summary?: boolean;
  extract_topics?: boolean;
}

// File processing result
export interface FileProcessingResult {
  success: boolean;
  file_params?: FileParams;
  error?: {
    message: string;
    code: string;
    details?: any;
  };
}

// Query parameters for file search/filtering
export interface FileQueryParams {
  file_id?: string;
  type?: FileType;
  status?: FileStatus;
  tags?: string[];
  file_name_pattern?: string;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
}

// Main embedding interface
export interface EmbeddingService {
  /**
   * Process a file - routes to structured or unstructured processing based on file type
   * - Structured: Clean file and save in parquet format using DuckDB, generate table schema and statistics
   * - Unstructured: Generate embeddings and store in MongoDB vector DB, create content summary
   */
  processFile(input: FileUploadInput, options?: FileProcessingOptions): Promise<FileProcessingResult>;

  /**
   * Get file information by ID
   */
  getFile(file_id: string): Promise<FileParams | null>;

  /**
   * List files with optional filtering
   */
  listFiles(query?: FileQueryParams): Promise<{
    files: FileParams[];
    total: number;
    has_more: boolean;
  }>;

  /**
   * Update file status
   */
  updateStatus(file_id: string, status: FileStatus): Promise<boolean>;

  /**
   * Delete file and associated data
   */
  deleteFile(file_id: string): Promise<boolean>;

  /**
   * Determines if a file should be processed as structured or unstructured
   */
  classifyFileType(mime_type: string): FileType;

}