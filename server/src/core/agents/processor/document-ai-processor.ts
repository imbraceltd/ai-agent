/**
 * Document AI Processor
 * Handles document extraction pipeline for assistants with agent_type === "document-ai".
 *
 * Two-step pipeline:
 *   Step 1 — Vision: extract raw data from document images using a vision model
 *   Step 2 — Format: format extracted data per output schema using a process model
 *
 * Returns a Response with text/event-stream (same contract as chat-processor.ts).
 */

import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  generateObject,
} from "ai";
import logger from "@/lib/logger";
import config from "@/config";
import { resolveImbraceModel } from "@/providers/imbraceModels";
import {
  getBoardSchema,
  createBoardItems,
} from "@/core/agents/services/getBoardDetails";
import type { ChatContext, ChatInput, ChatOptions } from "../types/chat";
import {
  fetchUrlAsBase64,
  pdfBase64ToPngPages,
  splitPagesIntoChunks,
  extractDocumentUrl,
  parseJsonWithRepair,
  boardFieldsToZodSchema,
  buildRawJsonSchema,
  type PdfChunk,
  type BoardField,
} from "./document-ai-utils";
import {
  vllmHttpInvoke,
  cleanJsonResponse,
  parseJsonWithRepairEnhanced,
  aggregateChunkResults,
  groupDataByKey,
  fixTimezone,
  resizeImageIfNeeded,
  formatMessagesForProvider,
  detectMappingKeyHeuristic,
  detectProviderType,
  extractTextFromResponse,
} from "./document-ai-helpers";

// ── Config type ────────────────────────────────────────────────────────────────

/** Document AI config read from the assistant's `document_ai` sub-object. */
interface DocumentAiConfig {
  /** Vision model name — from document_ai.vlm_model */
  visionModelName: string;
  /** Vision model provider ID — from document_ai.vlm_provider_id */
  visionProviderId: string;
  /** DataBoard ID for output schema — from document_ai.board_id */
  boardId?: string;
  /** Source languages joined as CSV — from document_ai.source_languages */
  language?: string;
  /** Extra instructions for step 1 OCR/vision — from document_ai.additional_document_instructions */
  documentInstructions?: string;
  /** Extra instructions for step 2 formatting — from document_ai.additionalInstructions */
  additionalInstructions?: string;
  /** Pages per PDF chunk (defaults based on provider) */
  chunkSize: number;
  /** Max concurrent chunk processing (defaults based on provider) */
  maxConcurrent: number;
  /** Retry attempts per chunk — from document_ai.retry_time */
  maxRetries: number;
  /** Use chunked processing for large PDFs */
  useEnhancedProcessing: boolean;
  /** UTC offset in hours — parsed from document_ai.time_offset */
  utc?: number;
  /** Detected provider type (openai / kimi / ollama / vllm …) */
  detectedVisionProvider?: string;
  /** Continue processing remaining chunks when one fails — from document_ai.continue_on_failure */
  continueOnFailure: boolean;
}

/**
 * Parse a UTC offset string like "UTC+08:00" or "+08:00" into a numeric hour offset.
 * Returns undefined if the string cannot be parsed.
 */
function parseUtcOffset(value: unknown): number | undefined {
  if (typeof value === "number" && !isNaN(value)) return value;
  if (typeof value !== "string") return undefined;
  // Matches: "UTC+08:00", "UTC-05:30", "+08:00", "-05:30", "8", "-5"
  const match = value.match(/([+-]?)(\d{1,2})(?::(\d{2}))?/);
  if (!match) return undefined;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = parseInt(match[2]!, 10);
  const minutes = match[3] ? parseInt(match[3], 10) : 0;
  return sign * (hours + minutes / 60);
}

/**
 * Extract DocumentAiConfig from a raw assistant MongoDB document.
 *
 * Field priority (first defined wins):
 *   1. Nested `document-ai` sub-object  (document-ai.model, board_id, …)
 *   2. Root-level fallback fields        (model_id, provider_id, core_task, …)
 */
function extractDocumentAiConfig(
  assistant: Record<string, unknown>,
): DocumentAiConfig {
  // Reason: the platform stores document-AI-specific settings in a nested
  // sub-object. Support both "document_ai" (underscore, new schema) and
  // "document-ai" (hyphen, legacy schema).
  const sub = (assistant["document_ai"] ??
    assistant["document-ai"] ??
    {}) as Record<string, unknown>;

  // ── Model resolution ──────────────────────────────────────────────────────
  // "vlm_model" is the new field name; "model" is the legacy field name.
  const modelName =
    (sub["vlm_model"] as string | undefined) ||
    (sub["model"] as string | undefined) ||
    (assistant["model_id"] as string | undefined) ||
    (assistant["modelName"] as string | undefined) ||
    "";

  // "vlm_provider_id" is the new field name; fall back to root provider_id.
  const visionProviderId =
    (sub["vlm_provider_id"] as string | undefined) ||
    (sub["visionProviderId"] as string | undefined) ||
    (assistant["provider_id"] as string | undefined) ||
    "system";

  // ── Build base config ─────────────────────────────────────────────────────
  const cfg: DocumentAiConfig = {
    visionModelName: modelName,
    visionProviderId,
    chunkSize:
      (sub["chunkSize"] as number) || (assistant["chunkSize"] as number) || 10,
    maxConcurrent:
      (sub["maxConcurrent"] as number) ||
      (assistant["maxConcurrent"] as number) ||
      30,
    maxRetries:
      (sub["retry_time"] as number) ||
      (sub["maxRetries"] as number) ||
      (assistant["maxRetries"] as number) ||
      1,
    useEnhancedProcessing:
      (sub["useEnhancedProcessing"] ?? assistant["useEnhancedProcessing"]) !==
      false,
    detectedVisionProvider: detectProviderType(modelName, visionProviderId),
    continueOnFailure:
      (sub["continue_on_failure"] as boolean | undefined) ??
      (assistant["continueOnFailure"] as boolean | undefined) ??
      true,
  };

  // Optimize chunk settings to match ai-service defaults:
  //   Kimi: chunkSize=3, maxConcurrent=3
  //   OLM:  chunkSize=1, maxConcurrent=1 (heavier model, needs serialization)
  const isOlm = cfg.visionModelName.toLowerCase().includes("olm");
  if (isOlm) {
    cfg.chunkSize = cfg.chunkSize === 10 ? 1 : cfg.chunkSize;
    cfg.maxConcurrent = cfg.maxConcurrent === 30 ? 1 : cfg.maxConcurrent;
  } else if (
    cfg.detectedVisionProvider === "kimi" ||
    cfg.detectedVisionProvider === "ollama"
  ) {
    cfg.chunkSize = cfg.chunkSize === 10 ? 3 : cfg.chunkSize;
    cfg.maxConcurrent = cfg.maxConcurrent === 30 ? 3 : cfg.maxConcurrent;
  }

  // ── Optional fields ───────────────────────────────────────────────────────

  // board_id: prefer document_ai.board_id, fall back to root boardId
  const boardId =
    (sub["board_id"] as string | undefined) ||
    (assistant["boardId"] as string | undefined);
  if (boardId) cfg.boardId = boardId;

  // language: "source_languages" (array) → join as CSV; fall back to legacy string
  const sourceLangs = sub["source_languages"];
  const language =
    (Array.isArray(sourceLangs) && sourceLangs.length > 0
      ? (sourceLangs as string[]).join(", ")
      : undefined) ||
    (sub["source_language"] as string | undefined) ||
    (assistant["language"] as string | undefined);
  if (language) cfg.language = language;

  // documentInstructions (Step 1 OCR): from document_ai.additional_document_instructions
  const documentInstructions =
    (sub["additional_document_instructions"] as string | undefined) ||
    (sub["additionalDocumentInstructions"] as string | undefined);
  if (documentInstructions) cfg.documentInstructions = documentInstructions;

  // additionalInstructions (Step 2 formatting): from document_ai.additionalInstructions
  const additionalInstructions =
    (sub["additionalInstructions"] as string | undefined) ||
    (sub["additional_instructions"] as string | undefined);
  if (additionalInstructions)
    cfg.additionalInstructions = additionalInstructions;

  // utc: parse "UTC+08:00" / "+08:00" / number from document_ai.time_offset
  const rawUtc = sub["time_offset"] ?? assistant["utc"];
  const utcNum = parseUtcOffset(rawUtc);
  if (utcNum !== undefined) cfg.utc = utcNum;

  return cfg;
}

// ── Stream helpers ─────────────────────────────────────────────────────────────

/**
 * Write a single progress text event to the stream.
 * Emits text-start / text-delta / text-end with a unique ID.
 */
function writeTextEvent(writer: any, text: string, id: string): void {
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: text });
  writer.write({ type: "text-end", id });
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Semaphore ──────────────────────────────────────────────────────────────────

/** Simple promise-based semaphore for bounding concurrent async operations. */
class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly maxConcurrent: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.maxConcurrent) {
      this.active++;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.queue.push(resolve));
  }

  private release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

// ── Step 1: Vision extraction ──────────────────────────────────────────────────

/**
 * Extract data from a set of document images using the vision model.
 * Supports multiple providers (OpenAI, Gemini, vLLM, Kimi, etc.).
 *
 * @param visionModel - AI SDK vision-capable model instance
 * @param imageBase64List - Base64 PNG images to process
 * @param provider - Provider type (for special handling)
 * @param chunkLabel - Label for log messages
 * @returns Extracted data as parsed value
 */
async function extractFromImages(
  visionModel: unknown,
  imageBase64List: string[],
  provider: string = "openai",
  chunkLabel = "document",
  _language?: string,
  additionalDocumentInstructions?: string,
): Promise<unknown> {
  const extractionInstruction = `Please extract thoroughly all data from this document image. Include all labels, headers, descriptions, title, text, numbers, dates, tables, forms, and any other information you can recognize, including handwriting. Organize the extracted data in a comprehensive JSON structure matching the original document layout.
Notes:
Try best and pay most attention to extract numerical data or non-english letters (e.g.: chinese) if present as accurately as possible when doing OCR for handwriting because they can be hard to recognize.
For numerical data or id, please ensure accuracy and clarity and base on its label to detect the best result possible
Only do raw OCR and do not try to interpret or format the data.
Do exhaustive extraction with the document from top to bottom and left to right.
Do not alter, interpret or format the data, especially handwriting, just extract as is.
Ignore border or boxed border, just extract the content inside the border. If box has not content, ignore it, do not make up values.
Ignore blurry, illegible, or unreadable text, do not make up values.
Additional Instructions: ${additionalDocumentInstructions || "None"}
`;

  logger.info(`Document AI Step 1: extracting from ${chunkLabel}`, {
    provider,
    imageCount: imageBase64List.length,
  });

  // // Handle vLLM direct HTTP path
  // if (provider === "vllm") {
  //   const messages = [
  //     {
  //       role: "system",
  //       content:
  //         "You are a document analysis assistant. Extract all visible data and return JSON.",
  //     },
  //     {
  //       role: "user",
  //       content: [
  //         { type: "text", text: extractionInstruction },
  //         ...imageBase64List.map((b64) => ({
  //           type: "image_url",
  //           image_url: { url: `data:image/png;base64,${b64}` },
  //         })),
  //       ],
  //     },
  //   ];

  //   try {
  //     const result = await vllmHttpInvoke(visionModel, messages, {
  //       jsonMode: true,
  //     });
  //     return parseJsonWithRepairEnhanced(result);
  //   } catch (err) {
  //     logger.warn(`vLLM direct HTTP failed for ${chunkLabel}, falling back`, {
  //       error: err instanceof Error ? err.message : String(err),
  //     });
  //     // Fall through to standard AI SDK path
  //   }
  // }

  // Standard AI SDK path (OpenAI, Gemini, etc.)
  const imageParts = imageBase64List.map((b64) => ({
    type: "image" as const,
    image: Buffer.from(b64, "base64"),
    mimeType: "image/png" as const,
  }));

  const result = await generateText({
    model: visionModel as Parameters<typeof generateText>[0]["model"],
    system:
      "You are a document analysis assistant. Your task is to extract all visible text, data, and information from the provided image. Be comprehensive and include all details you can recognize. Return the information in a structured JSON format with clear categories.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text" as const, text: extractionInstruction },
          ...imageParts,
        ],
      },
    ],
  });

  return parseJsonWithRepairEnhanced(result.text);
}

// ── Chunk processing ───────────────────────────────────────────────────────────

interface ChunkResultType {
  chunkId: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Step 1 extraction for the chunked PDF path (V3 — matches process_single_chunk
 * in chat-ai backend's process_large_pdf). Uses a SHORT extraction prompt and
 * takes `additionalInstructions` as the system message — this is a deliberate
 * role-swap inherited from chat-ai's chunked pipeline:
 *   chunked Step 1 system  ← additionalInstructions
 *   chunked Step 2 system  ← additionalDocumentInstructions
 */
async function extractChunkV3(
  visionModel: unknown,
  chunk: PdfChunk,
  provider: string,
  additionalInstructions?: string,
): Promise<unknown> {
  const systemContent =
    additionalInstructions ||
    "You are a document analysis assistant. Extract all visible text and data. Return structured JSON. CRITICAL: Extract ALL documents present.";

  const userText = `Extract ALL data from pages ${chunk.startPage}-${chunk.endPage}. Include labels, text, numbers, dates, tables. Organize in JSON matching original layout. This is chunk ${chunk.chunkId + 1}.`;

  const imageParts = chunk.pages.map((b64) => ({
    type: "image" as const,
    image: Buffer.from(b64, "base64"),
    mimeType: "image/png" as const,
  }));

  logger.info(
    `Document AI Step 1 (V3): extracting chunk ${chunk.chunkId + 1}/${chunk.totalChunks}`,
    { provider, pages: `${chunk.startPage}-${chunk.endPage}` },
  );

  const result = await generateText({
    model: visionModel as Parameters<typeof generateText>[0]["model"],
    system: systemContent,
    messages: [
      {
        role: "user",
        content: [{ type: "text" as const, text: userText }, ...imageParts],
      },
    ],
  });

  return parseJsonWithRepairEnhanced(result.text);
}

/**
 * Process a single PDF chunk through Step 1 (V3) with retry logic.
 * Enhanced with provider-specific handling and fallbacks.
 */
async function processChunk(
  visionModel: unknown,
  chunk: PdfChunk,
  maxRetries: number,
  provider: string = "openai",
  _language?: string,
  additionalInstructions?: string,
): Promise<ChunkResultType> {
  const label = `chunk ${chunk.chunkId + 1}/${chunk.totalChunks} (pages ${chunk.startPage}–${chunk.endPage})`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Resize images for Kimi if needed
      let processedPages = chunk.pages;
      if (provider === "kimi") {
        processedPages = await Promise.all(
          chunk.pages.map((p) => resizeImageIfNeeded(p)),
        );
      }
      const resizedChunk: PdfChunk = { ...chunk, pages: processedPages };

      const result = await extractChunkV3(
        visionModel,
        resizedChunk,
        provider,
        additionalInstructions,
      );

      return { chunkId: chunk.chunkId, success: true, result };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (attempt < maxRetries) {
        logger.warn(
          `Retrying ${label} (attempt ${attempt + 2}/${maxRetries + 1})`,
          { error: errMsg },
        );
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        logger.error(`All attempts exhausted for ${label}`, { error: errMsg });
        return { chunkId: chunk.chunkId, success: false, error: errMsg };
      }
    }
  }

  return { chunkId: chunk.chunkId, success: false, error: "Exhausted retries" };
}

// ── Step 2: Formatting ─────────────────────────────────────────────────────────

/**
 * Format extracted data according to the output schema (Step 2).
 * Enhanced with provider-specific support and batch processing.
 *
 * @param processModel - AI SDK model for formatting
 * @param extractedData - Output from Step 1
 * @param zodSchema - Zod schema for generateObject (null = no schema)
 * @param rawSchemaStr - JSON Schema as string (for prompt embedding)
 * @param provider - Provider type for special handling
 * @param language - Optional response language
 * @param additionalInstructions - Optional formatting instructions
 * @returns Formatted structured data
 */
async function formatExtractedData(
  processModel: unknown,
  extractedData: unknown,
  zodSchema: ReturnType<typeof boardFieldsToZodSchema>,
  rawSchemaStr: string | null,
  provider: string = "openai",
  language?: string,
  additionalInstructions?: string,
): Promise<unknown> {
  const langNote = language ? ` Please respond in ${language}.` : "";
  const extractedStr = JSON.stringify(extractedData, null, 2);
  const extractedCount = Array.isArray(extractedData)
    ? extractedData.length
    : 1;
  // Reason: when extractedData is an array with >1 items the model will
  // naturally produce an array output, which fails a single-object Zod schema.
  // We track this flag so we can use `output: 'array'` mode for generateObject
  // and tailor the fallback prompt accordingly.
  const isMultiRecord =
    Array.isArray(extractedData) && extractedData.length > 1;

  const systemPrompt = `You are a data processing assistant. Your task is to take previously extracted document data and format it according to a specific schema and additional instructions. Return a JSON object that strictly follows the provided schema.${langNote}`;

  const userPrompt = `Using the extracted data below, please create a JSON response that follows the specified schema and incorporates the additional instructions.${langNote}

Extracted Data: ${extractedStr}
Extracted Data Total Numbers: ${extractedCount}

Additional Instructions: ${additionalInstructions || "None"}

Required Output Schema: ${rawSchemaStr ?? ""}

Please return a JSON object that follows the schema exactly and incorporates any relevant data from the extracted information.
Please analyze the extracted data thoroughly and ensure that all relevant information is included in the final JSON response based on given json outputschema. You should read description in each field of the schema to determine which data from the extracted data is relevant to the schema.
Do not alter or interpret extracted data in any way, just use it to fill the schema.
Please return an array of JSON objects if Extracted Data Total Numbers is greater than 1, otherwise return a single JSON object.`;

  logger.info("Document AI Step 2: formatting extracted data", {
    extractedCount,
    isMultiRecord,
    hasSchema: zodSchema !== null,
    provider,
  });

  // Handle vLLM path
  if (provider === "vllm" && !zodSchema) {
    try {
      const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ];

      const result = await vllmHttpInvoke(processModel, messages, {
        jsonMode: true,
      });
      return parseJsonWithRepairEnhanced(result);
    } catch (err) {
      logger.warn("vLLM formatting failed, falling back to AI SDK", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Standard AI SDK path
  if (zodSchema) {
    try {
      if (isMultiRecord) {
        // Reason: generateObject with a single-object Zod schema fails when the
        // model returns an array (as it should for multi-record documents).
        // Using output: 'array' tells the SDK to expect an array of items each
        // matching the per-item schema, which aligns with the model's output.
        const result = await generateObject({
          model: processModel as Parameters<typeof generateObject>[0]["model"],
          output: "array",
          schema: zodSchema,
          system: systemPrompt,
          prompt: userPrompt,
        });
        return result.object;
      } else {
        const result = await generateObject({
          model: processModel as Parameters<typeof generateObject>[0]["model"],
          schema: zodSchema,
          system: systemPrompt,
          prompt: userPrompt,
        });
        return result.object;
      }
    } catch (schemaErr) {
      logger.warn(
        "generateObject schema validation failed, falling back to no-schema JSON mode",
        {
          error:
            schemaErr instanceof Error ? schemaErr.message : String(schemaErr),
        },
      );

      // Reason: try JSON mode without strict schema validation as an intermediate
      // step. The schema field names are still embedded in the prompt via
      // rawSchemaStr so the model will use the correct field names without the
      // SDK enforcing Zod constraints that caused the original failure.
      try {
        const noSchemaResult = await generateObject({
          model: processModel as Parameters<typeof generateObject>[0]["model"],
          output: "no-schema",
          system: systemPrompt,
          prompt: isMultiRecord
            ? `${userPrompt}\n\nIMPORTANT: Return a JSON ARRAY, one object per record.`
            : userPrompt,
        });
        return noSchemaResult.object;
      } catch (noSchemaErr) {
        logger.warn(
          "generateObject no-schema fallback failed, falling back to generateText",
          {
            error:
              noSchemaErr instanceof Error
                ? noSchemaErr.message
                : String(noSchemaErr),
          },
        );
        // Fall through to generateText path below
      }
    }
  }

  // Final fallback: generateText + JSON repair.
  // Reason: when multiple records are present, explicitly instruct the model to
  // return a JSON array so the output can still be fed to createBoardItems.
  const fallbackPrompt = isMultiRecord
    ? `${userPrompt}\n\nIMPORTANT: Your response MUST be a JSON ARRAY (e.g. [{...}, {...}]), one object per record.`
    : userPrompt;

  const result = await generateText({
    model: processModel as Parameters<typeof generateText>[0]["model"],
    system: systemPrompt,
    prompt: fallbackPrompt,
  });

  return parseJsonWithRepairEnhanced(result.text);
}

// ── Step 2 (V3): Batched format with File URL injection ────────────────────────

/**
 * Step 2 formatter for the chunked PDF path. Mirrors `process_batch_with_ai`
 * in chat-ai backend: takes data already grouped by `mappingKey`, injects the
 * source `fileUrl` into the prompt so the model can populate any "File URL"
 * schema field, and uses `additionalDocumentInstructions` as the system
 * prompt (deliberate role-swap from the V2 single-image path).
 */
async function formatBatchWithAI(
  processModel: unknown,
  groupedData: Record<string, unknown[]>,
  mappingKey: string,
  fileUrl: string,
  zodSchema: ReturnType<typeof boardFieldsToZodSchema>,
  rawSchemaStr: string | null,
  language?: string,
  additionalDocumentInstructions?: string,
): Promise<unknown> {
  const groupCount = Object.keys(groupedData).length;
  const langLine = language ? ` Please respond in ${language}.` : "";

  const systemContent =
    additionalDocumentInstructions ||
    `You are a data processing assistant. Take aggregated document data locally grouped by '${mappingKey}' and format it according to a specific schema.\n\nCRITICAL: Return ACTUAL DATA VALUES, not schema definitions. Fill schema fields with extracted content.`;

  const userContent = `Process this grouped data and fill schema with ACTUAL DATA:

Grouped Data by ${mappingKey}: ${JSON.stringify(groupedData, null, 2)}
Mapping Key: ${mappingKey}
Number of unique documents: ${groupCount}
File URL: ${fileUrl || "Not provided"}

Required Output Schema: ${rawSchemaStr ?? ""}

CRITICAL REQUIREMENTS:
1. Process ALL ${groupCount} unique documents.
2. Return JSON array with ACTUAL DATA VALUES.
3. Fill each schema field with corresponding data.${langLine}`;

  logger.info("Document AI Step 2 (V3 batch): formatting grouped data", {
    mappingKey,
    groupCount,
    fileUrl: fileUrl ? fileUrl.slice(0, 80) : "(empty)",
    hasSchema: zodSchema !== null,
  });

  // Reason: chat-ai's process_batch_with_ai uses prompt-embedded JSON schema
  // and parses the response with permissive repair — it does NOT bind Zod
  // for strict validation. Mirror that because the model routinely returns
  // shapes that fail Zod (Currency as string, dates as DD/MM/YYYY, ...) but
  // are still recoverable. The schema is preserved in the prompt via
  // `rawSchemaStr`.
  void zodSchema; // kept in signature for parity; intentionally unused

  const result = await generateText({
    model: processModel as Parameters<typeof generateText>[0]["model"],
    system: systemContent,
    prompt: `${userContent}\n\nIMPORTANT: Return a JSON ARRAY, one object per unique document.`,
  });

  // Reason: parse + unwrap. The model often wraps the JSON array in markdown
  // fences, in a single-key dict, or returns a JSON string nested inside an
  // array. Mirror chat-ai's process_batch_with_ai post-processing so
  // downstream (createBoardItems) always receives an array of plain objects.
  let parsed = parseJsonWithRepairEnhanced(result.text);

  // Unwrap "[<jsonString>]" — generateText sometimes returns a 1-element array
  // whose only element is the JSON-encoded payload as a string.
  if (
    Array.isArray(parsed) &&
    parsed.length === 1 &&
    typeof parsed[0] === "string"
  ) {
    parsed = parseJsonWithRepairEnhanced(parsed[0]);
  }

  // Unwrap { someKey: [...] } — chat-ai does this when dict has a single
  // array-valued key (model wraps the array under "results"/"documents"/etc.).
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed)
  ) {
    const keys = Object.keys(parsed as Record<string, unknown>);
    if (keys.length === 1) {
      const inner = (parsed as Record<string, unknown>)[keys[0]!];
      if (Array.isArray(inner)) parsed = inner;
    }
  }

  // Final shape: always return as-is — pipeline + createBoardItems handle
  // both array and single-object inputs.
  return parsed;
}

// ── Main processor ─────────────────────────────────────────────────────────────

/**
 * Process a chat request through the document AI pipeline.
 * Returns a Response with text/event-stream (same contract as processChatStream).
 *
 * @param input - Chat input (messages, assistant_id, orgId, etc.)
 * @param context - Request context (xAccessToken, sessionID, organizationId)
 * @param options - Chat options (onStreamFinish hook for DB persistence)
 * @param assistant - Pre-fetched assistant MongoDB document
 * @returns SSE Response
 */
export async function processDocumentAiStream(
  input: ChatInput,
  context: ChatContext,
  options: ChatOptions,
  assistant: Record<string, unknown>,
): Promise<Response> {
  const { messages } = input;
  const { organizationId, xAccessToken, sessionID } = context;
  const startTime = Date.now();

  // The `assistant` passed in already carries the full `document_ai` sub-object
  // (fetched via getAssistantSettings in streamChatReplyV2), so no extra DB
  // read is needed here.
  const cfg = extractDocumentAiConfig(assistant);

  logger.info("Starting document-AI pipeline", {
    sessionID,
    hasDocumentInstructions: !!cfg.documentInstructions,
    hasAdditionalInstructions: !!cfg.additionalInstructions,
    visionModel: cfg.visionModelName,
    boardId: cfg.boardId,
    useEnhancedProcessing: cfg.useEnhancedProcessing,
  });

  const stream = createUIMessageStream({
    ...(options.onStreamFinish ? { onFinish: options.onStreamFinish } : {}),
    execute: async ({ writer }) => {
      const w = writer as any;

      try {
        // ── Phase 0: Extract document URL ────────────────────────────
        const documentUrl = extractDocumentUrl(messages as unknown[]);
        if (!documentUrl) {
          writeTextEvent(
            w,
            "Error: No document URL found in the message. Please attach a file or provide a URL.",
            makeId("err"),
          );
          return;
        }

        logger.info("Document URL extracted", { sessionID, documentUrl });

        // ── Phase 1: Resolve AI models ────────────────────────────────
        if (!cfg.visionModelName) {
          writeTextEvent(
            w,
            "Error: Assistant is missing modelName configuration for document-AI.",
            makeId("err"),
          );
          return;
        }

        writeTextEvent(w, "Resolving AI model...", makeId("progress"));

        const visionResolved = await resolveImbraceModel(
          organizationId,
          xAccessToken,
          cfg.visionModelName,
          cfg.visionProviderId,
        );

        const visionModel = visionResolved.model;
        // Reason: single model handles both extraction (step 1) and formatting (step 2).
        const processModel = visionModel;

        // ── Phase 2: Resolve board schema ─────────────────────────────
        let zodSchema: ReturnType<typeof boardFieldsToZodSchema> = null;
        let rawSchemaStr: string | null = null;
        // Reason: hoisted so Phase 10 can use field IDs for board item creation.
        let boardFields: BoardField[] | null = null;

        if (cfg.boardId) {
          writeTextEvent(w, "Fetching output schema...", makeId("progress"));
          try {
            boardFields = (await getBoardSchema(cfg.boardId, xAccessToken)) as
              | BoardField[]
              | null;

            if (boardFields && boardFields.length > 0) {
              zodSchema = boardFieldsToZodSchema(boardFields);
              rawSchemaStr = JSON.stringify(buildRawJsonSchema(boardFields));
              logger.info("Board schema resolved", {
                boardId: cfg.boardId,
                fieldCount: boardFields.length,
                fields: boardFields.map((f) => ({
                  name: f.name,
                  type: f.type,
                  // dump unknown extra props (e.g. child_board) for TableInTable fields
                  extra: Object.fromEntries(
                    Object.entries(f as unknown as Record<string, unknown>).filter(
                      ([k]) =>
                        ![
                          "_id",
                          "name",
                          "type",
                          "description",
                          "data",
                          "is_identifier",
                        ].includes(k),
                    ),
                  ),
                })),
              });
            }
          } catch (schemaErr) {
            // Reason: schema fetch failure is non-fatal — we log and continue
            // with raw extraction instead of blocking the entire pipeline.
            logger.warn(
              "Board schema fetch failed; continuing without schema",
              {
                boardId: cfg.boardId,
                error:
                  schemaErr instanceof Error
                    ? schemaErr.message
                    : String(schemaErr),
              },
            );
          }
        }

        // ── Phase 3: Fetch document ───────────────────────────────────
        writeTextEvent(w, "Fetching document...", makeId("progress"));
        const { extension, base64 } = await fetchUrlAsBase64(documentUrl);

        logger.info("Document fetched", {
          sessionID,
          extension,
          sizeKb: Math.round((base64.length * 3) / 4 / 1024),
        });

        // ── Phase 4: PDF → images ──────────────────────────────────────
        let allPages: string[];

        if (extension === "pdf") {
          writeTextEvent(w, "Converting PDF to images...", makeId("progress"));
          allPages = await pdfBase64ToPngPages(base64);
          logger.info("PDF converted to images", {
            sessionID,
            pageCount: allPages.length,
          });
        } else {
          // Non-PDF: treat as a single image
          allPages = [base64];
        }

        // ── Phase 5–7: Vision extraction + Step 2 format ──────────────
        // Reason: PDFs go through the V3 chunked path (matches chat-ai
        // backend's `process_large_pdf` + `process_batch_with_ai`):
        //   - Step 1 uses a SHORT chunked prompt with `cfg.additionalInstructions`
        //     as the system message (deliberate role-swap from V2).
        //   - After aggregation, results are grouped by a heuristic mapping key
        //     (Invoice No / Document ID).
        //   - Step 2 receives the grouped data, the source File URL, and uses
        //     `cfg.documentInstructions` as the system message.
        // Non-PDF (single-image) keeps the V2 single-document path.
        let extractedData: unknown;
        let finalResult: unknown;
        const isPdf = extension === "pdf";

        if (isPdf) {
          const chunks = splitPagesIntoChunks(allPages, cfg.chunkSize);

          writeTextEvent(
            w,
            `Extracting data from ${chunks.length} chunks (${allPages.length} pages total)...`,
            makeId("progress"),
          );

          logger.info("Processing PDF (V3 chunked path)", {
            sessionID,
            totalPages: allPages.length,
            chunkCount: chunks.length,
            chunkSize: cfg.chunkSize,
            maxConcurrent: cfg.maxConcurrent,
          });

          const semaphore = new Semaphore(cfg.maxConcurrent);
          const chunkResults = await Promise.all(
            chunks.map((chunk) =>
              semaphore.run(() =>
                processChunk(
                  visionModel,
                  chunk,
                  cfg.maxRetries,
                  cfg.detectedVisionProvider || "openai",
                  cfg.language,
                  // V3 swap: chunked Step 1 system ← additionalInstructions
                  cfg.additionalInstructions,
                ),
              ),
            ),
          );

          const successCount = chunkResults.filter((r) => r.success).length;
          const failedChunks = chunkResults.filter((r) => !r.success);

          writeTextEvent(
            w,
            `Extracted data from ${successCount}/${chunks.length} chunks.`,
            makeId("progress"),
          );

          if (!cfg.continueOnFailure && failedChunks.length > 0) {
            const failedIds = failedChunks.map((r) => r.chunkId + 1).join(", ");
            throw new Error(
              `${failedChunks.length} chunk(s) failed (chunk IDs: ${failedIds}) and continue_on_failure is disabled.`,
            );
          }

          extractedData = aggregateChunkResults(chunkResults);

          logger.info("Step 1 (V3) extraction complete", {
            sessionID,
            resultType: typeof extractedData,
            isArray: Array.isArray(extractedData),
          });

          // Phase 6 — group by mapping key
          let mappingKey = "Document ID";
          let groupedData: Record<string, unknown[]> = {};

          if (Array.isArray(extractedData) && extractedData.length > 0) {
            mappingKey = detectMappingKeyHeuristic(extractedData);
            groupedData = groupDataByKey(extractedData, mappingKey);
          } else if (extractedData && typeof extractedData === "object") {
            groupedData = { default: [extractedData] };
          } else {
            groupedData = { default: [{ raw_value: extractedData }] };
          }

          writeTextEvent(
            w,
            `Grouped extracted data by "${mappingKey}" (${Object.keys(groupedData).length} unique groups).`,
            makeId("progress"),
          );

          // Phase 7 — Step 2 batched format with File URL injection
          if (!zodSchema && !rawSchemaStr) {
            finalResult = extractedData;
          } else {
            writeTextEvent(
              w,
              "Formatting extracted data...",
              makeId("progress"),
            );
            try {
              finalResult = await formatBatchWithAI(
                processModel,
                groupedData,
                mappingKey,
                documentUrl,
                zodSchema,
                rawSchemaStr,
                cfg.language,
                // V3 swap: batched Step 2 system ← documentInstructions
                cfg.documentInstructions,
              );
            } catch (formatErr) {
              logger.warn(
                "Batched formatting failed, returning raw extraction",
                {
                  error:
                    formatErr instanceof Error
                      ? formatErr.message
                      : String(formatErr),
                },
              );
              finalResult = extractedData;
              writeTextEvent(
                w,
                "Warning: Data formatting failed — board items may not be added correctly. Raw extraction will be used.",
                makeId("warn"),
              );
            }
          }
        } else {
          // Non-PDF (single image) — V2 path
          writeTextEvent(
            w,
            "Extracting data from document...",
            makeId("progress"),
          );
          extractedData = await extractFromImages(
            visionModel,
            allPages,
            cfg.detectedVisionProvider || "openai",
            "document",
            cfg.language,
            cfg.documentInstructions,
          );

          logger.info("Step 1 (V2) extraction complete", {
            sessionID,
            resultType: typeof extractedData,
            isArray: Array.isArray(extractedData),
          });

          if (!zodSchema && !rawSchemaStr) {
            finalResult = extractedData;
          } else {
            writeTextEvent(
              w,
              "Formatting extracted data...",
              makeId("progress"),
            );
            try {
              finalResult = await formatExtractedData(
                processModel,
                extractedData,
                zodSchema,
                rawSchemaStr,
                cfg.detectedVisionProvider || "openai",
                cfg.language,
                cfg.additionalInstructions,
              );
            } catch (formatErr) {
              logger.warn("Formatting failed, returning raw extraction", {
                error:
                  formatErr instanceof Error
                    ? formatErr.message
                    : String(formatErr),
              });
              finalResult = extractedData;
              writeTextEvent(
                w,
                "Warning: Data formatting failed — board items may not be added correctly. Raw extraction will be used.",
                makeId("warn"),
              );
            }
          }
        }

        // ── Phase 8: Fix timezone ────────────────────────────────────
        if (cfg.utc) {
          finalResult = fixTimezone(finalResult, cfg.utc);
          logger.info("Timezone adjusted for UTC");
        }

        logger.info("Step 2 formatting complete", {
          sessionID,
          durationMs: Date.now() - startTime,
        });

        // ── Phase 9: Write final result ───────────────────────────────
        // Emit the structured JSON as the assistant text message.
        // This is persisted to DB via the onFinish hook in chatService.
        const finalJson = JSON.stringify(finalResult, null, 2);
        const resultId = makeId("result");

        w.write({ type: "text-start", id: resultId });
        w.write({ type: "text-delta", id: resultId, delta: finalJson });
        w.write({ type: "text-end", id: resultId });

        logger.info("Document AI pipeline complete", {
          sessionID,
          resultLength: finalJson.length,
          durationMs: Date.now() - startTime,
        });

        // ── Phase 10: Create board item(s) ────────────────────────────
        if (
          cfg.boardId &&
          boardFields &&
          boardFields.length > 0 &&
          xAccessToken
        ) {
          writeTextEvent(w, "Adding data to board...", makeId("progress"));
          try {
            const createdIds = await createBoardItems(
              cfg.boardId,
              boardFields,
              finalResult,
              xAccessToken,
            );
            const webAppUrl = config.webApp.url.replace(/\/$/, "");
            const links = createdIds.map(
              (id) => `${webAppUrl}/document-ai/${id}`,
            );
            const msg =
              links.length > 0
                ? `Board item(s) created: ${links.join(" ")}`
                : "Board items created (no IDs returned).";
            writeTextEvent(w, msg, makeId("progress"));
            logger.info("Board items created", {
              boardId: cfg.boardId,
              count: createdIds.length,
            });
          } catch (boardErr) {
            // Reason: non-fatal — log and warn but do not abort the stream so
            // the extracted JSON is always persisted to DB via onFinish.
            logger.warn("Board item creation failed", {
              boardId: cfg.boardId,
              error:
                boardErr instanceof Error ? boardErr.message : String(boardErr),
            });
            writeTextEvent(
              w,
              "Warning: Could not add data to board.",
              makeId("progress"),
            );
          }
        }
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Document processing failed";

        logger.error("Document AI pipeline error", {
          sessionID,
          error: errorMsg,
          durationMs: Date.now() - startTime,
        });

        throw err;
      }
    },
  });

  return createUIMessageStreamResponse({ stream });
}
