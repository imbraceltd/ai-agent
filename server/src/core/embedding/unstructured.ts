import { randomUUID } from "crypto";
import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MongoDBAtlasVectorSearch } from "@langchain/mongodb";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";

import {
  EmbeddingService,
  FileType,
  FileStatus,
  FileParams,
  FileUploadInput,
  FileProcessingOptions,
  FileProcessingResult,
  FileQueryParams,
  UnstructuredSummary,
  FILE_TYPE_MAP
} from "./index";

export class UnstructuredEmbeddingService implements EmbeddingService {
  private readonly DEFAULT_CHUNK_SIZE = 1000;
  private readonly DEFAULT_CHUNK_OVERLAP = 200;
  private readonly DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
  
  private mongoCollection: any;
  private embeddingConfig: {
    type: 'openai' | 'lmstudio' | 'ollama';
    apiKey?: string;
    baseUrl?: string;
    model: string;
  };

  constructor(
    mongoCollection: any,
    embeddingConfig: {
      type: 'openai' | 'lmstudio' | 'ollama';
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    }
  ) {
    this.mongoCollection = mongoCollection;
    this.embeddingConfig = {
      model: this.DEFAULT_EMBEDDING_MODEL,
      ...embeddingConfig
    };
  }

  async processFile(
    input: FileUploadInput,
    options: FileProcessingOptions = {}
  ): Promise<FileProcessingResult> {
    try {
      const fileType = this.classifyFileType(input.mime_type);
      
      if (fileType !== FileType.UNSTRUCTURED) {
        throw new Error(`File type ${input.mime_type} is not supported for unstructured processing`);
      }

      // Download and process file
      const fileBuffer = await this.downloadFile(input.file_url);
      const documents = await this.loadDocuments(fileBuffer, input.mime_type);
      
      // Split documents into chunks
      const chunks = await this.splitDocuments(documents, options);

      const fileId = randomUUID();
      
      // Generate embeddings and store
      await this.storeEmbeddings(chunks, input, options, fileId);
      
      // Generate summary
      const summary = await this.generateSummary(documents, options);
      
      // Create file params
      const fileParams: FileParams = {
        file_id: fileId,
        file_name: input.file_name,
        type: FileType.UNSTRUCTURED,
        tags: input.tags || [],
        status: FileStatus.PROCESSED,
        file_url: input.file_url,
        summary,
        meta: {
          size_bytes: fileBuffer.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          mime_type: input.mime_type
        }
      };

      return {
        success: true,
        file_params: fileParams
      };

    } catch (error) {
      return {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'PROCESSING_ERROR',
          details: error
        }
      };
    }
  }

  async getFile(file_id: string): Promise<FileParams | null> {
    try {
      const result = await this.mongoCollection.findOne({
        "metadata.file_id": file_id
      });
      
      if (!result) return null;
      
      return this.mapToFileParams(result);
    } catch (error) {
      console.error('Error getting file:', error);
      return null;
    }
  }

  async listFiles(query: FileQueryParams = {}): Promise<{
    files: FileParams[];
    total: number;
    has_more: boolean;
  }> {
    try {
      const filter = this.buildMongoFilter(query);
      const limit = query.limit || 20;
      const offset = query.offset || 0;

      const results = await this.mongoCollection
        .find(filter)
        .skip(offset)
        .limit(limit + 1)
        .toArray();

      const total = await this.mongoCollection.countDocuments(filter);
      const hasMore = results.length > limit;
      
      if (hasMore) {
        results.pop(); // Remove the extra item used for pagination check
      }

      const files = results.map((result: any) => this.mapToFileParams(result));

      return {
        files,
        total,
        has_more: hasMore
      };
    } catch (error) {
      console.error('Error listing files:', error);
      return { files: [], total: 0, has_more: false };
    }
  }

  async updateStatus(file_id: string, status: FileStatus): Promise<boolean> {
    try {
      const result = await this.mongoCollection.updateMany(
        { "metadata.file_id": file_id },
        { $set: { "metadata.status": status, "metadata.updated_at": new Date().toISOString() } }
      );
      
      return result.modifiedCount > 0;
    } catch (error) {
      console.error('Error updating status:', error);
      return false;
    }
  }

  async deleteFile(file_id: string): Promise<boolean> {
    try {
      const result = await this.mongoCollection.deleteMany({
        "file_id": file_id
      });
      
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  classifyFileType(mime_type: string): FileType {
    return FILE_TYPE_MAP[mime_type] || FileType.UNSTRUCTURED;
  }

  // Private helper methods
  private async downloadFile(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async loadDocuments(buffer: Buffer, mimeType: string) {
    // Convert Buffer to Uint8Array which is compatible with Blob
    const uint8Array = new Uint8Array(buffer);
    const blob = new Blob([uint8Array], { type: mimeType });
    let loader;

    switch (mimeType) {
      case "text/csv":
        loader = new CSVLoader(blob);
        break;
      case "application/pdf":
        loader = new PDFLoader(blob);
        break;
      case "application/json":
        loader = new JSONLoader(blob);
        break;
      case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        loader = new DocxLoader(blob);
        break;
      case "text/plain":
        loader = new TextLoader(blob);
        break;
      case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
        loader = new PPTXLoader(blob);
        break;
      default:
        throw new Error(`Unsupported file type: ${mimeType}`);
    }

    return await loader.load();
  }

  private async splitDocuments(documents: any[], options: FileProcessingOptions) {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: options.chunk_size || this.DEFAULT_CHUNK_SIZE,
      chunkOverlap: options.chunk_overlap || this.DEFAULT_CHUNK_OVERLAP,
    });

    return await textSplitter.splitDocuments(documents);
  }

  private createEmbeddings() {
    switch (this.embeddingConfig.type) {
      case 'lmstudio':
        return new OpenAIEmbeddings({
          configuration: {
            baseURL: this.embeddingConfig.baseUrl,
          },
          model: this.embeddingConfig.model,
        });
      case 'ollama':
        return new OllamaEmbeddings({
          model: this.embeddingConfig.model,
          ...(this.embeddingConfig.baseUrl && { baseUrl: this.embeddingConfig.baseUrl }),
        });
      case 'openai':
      default:
        return new OpenAIEmbeddings({
          ...(this.embeddingConfig.apiKey && { openAIApiKey: this.embeddingConfig.apiKey }),
          model: this.embeddingConfig.model,
        });
    }
  }

  private async storeEmbeddings(
    chunks: any[],
    input: FileUploadInput,
    _options: FileProcessingOptions,
    fileId: string
  ) {
    const embeddings = this.createEmbeddings();
    const createdAt = new Date().toISOString();

    const enrichedChunks = chunks.map(chunk => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        file_id: fileId,
        file_name: input.file_name,
        created_at: createdAt,
        mime_type: input.mime_type,
        tags: input.tags || []
      }
    }));

    await MongoDBAtlasVectorSearch.fromDocuments(enrichedChunks, embeddings, {
      collection: this.mongoCollection,
      indexName: "vector_index",
      textKey: "text",
      embeddingKey: "embedding",
    });

    console.log(`Finished uploading file to vector store: ${input.file_name}`);
  }

  private async generateSummary(
    documents: any[],
    options: FileProcessingOptions
  ): Promise<UnstructuredSummary> {
    const fullText = documents.map(doc => doc.pageContent).join(' ');
    const wordCount = fullText.split(/\s+/).length;
    
    // Basic content summary - in production, you might use an LLM for better summaries
    const contentSummary = fullText.substring(0, 500) + (fullText.length > 500 ? '...' : '');
    
    const summary: UnstructuredSummary = {
      type: 'unstructured',
      content_summary: contentSummary,
      word_count: wordCount,
      page_count: documents.length,
      language: 'en', // Could be detected using a language detection library
    };

    if (options.extract_topics) {
      summary.key_topics = this.extractKeyTopics(fullText);
    }

    return summary;
  }

  private extractKeyTopics(text: string): string[] {
    // Simple keyword extraction - in production, use more sophisticated NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private buildMongoFilter(query: FileQueryParams) {
    const filter: any = {};

    if (query.file_id) {
      filter["metadata.file_id"] = query.file_id;
    }

    if (query.type) {
      filter["metadata.type"] = query.type;
    }

    if (query.status) {
      filter["metadata.status"] = query.status;
    }

    if (query.tags && query.tags.length > 0) {
      filter["metadata.tags"] = { $in: query.tags };
    }

    if (query.file_name_pattern) {
      filter["metadata.file_name"] = { $regex: query.file_name_pattern, $options: 'i' };
    }

    if (query.created_after || query.created_before) {
      filter["metadata.created_at"] = {};
      if (query.created_after) {
        filter["metadata.created_at"].$gte = query.created_after;
      }
      if (query.created_before) {
        filter["metadata.created_at"].$lte = query.created_before;
      }
    }

    return {};
  }

  private mapToFileParams(mongoResult: any): FileParams {
    const metadata = mongoResult;
    
    const summary: UnstructuredSummary = {
      type: 'unstructured',
      content_summary: metadata.content_summary || '',
      word_count: metadata.word_count,
      page_count: metadata.page_count,
      language: metadata.language,
    };

    if (metadata.key_topics) {
      summary.key_topics = metadata.key_topics;
    }
    
    return {
      file_id: metadata.file_id,
      file_name: metadata.file_name,
      type: FileType.UNSTRUCTURED,
      tags: metadata.tags || [],
      status: metadata.status || FileStatus.PROCESSED,
      file_url: metadata.file_url || '',
      summary,
      meta: {
        size_bytes: metadata.size_bytes || 0,
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
        mime_type: metadata.mime_type
      }
    };
  }
}