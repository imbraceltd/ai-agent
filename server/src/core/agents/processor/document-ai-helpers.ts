/**
 * Document AI Helpers
 * Enhanced utilities for multi-provider support, batch processing, and resilience.
 * Mirrors Python document_ai_assistant functionality.
 */

import logger from "@/lib/logger";
import { jsonrepair } from "jsonrepair";
import type { z } from "zod";
import config from "@/config";

// ── vLLM HTTP Invoker ──────────────────────────────────────────────────────────

interface VllmConfig {
  baseUrl: string;
  apiKey: string | undefined;
  modelName: string;
}

/**
 * Extract vLLM configuration from a model instance (ChatOpenAI-compatible).
 * Returns null if not a vLLM model.
 */
export function extractVllmConfig(model: any): VllmConfig | null {
  try {
    const baseUrl = model.openai_api_base || model.baseURL;
    if (!baseUrl) return null;

    const apiKey =
      model.openai_api_key?.get_secret_value?.() ||
      model.apiKey ||
      process.env["VLLM_API_KEY"];
    const modelName =
      model.model_name ||
      model.modelName ||
      process.env["VLLM_MODEL"] ||
      "default";

    return {
      baseUrl: String(baseUrl).trim(),
      apiKey: apiKey ? String(apiKey) : undefined,
      modelName: String(modelName),
    };
  } catch {
    return null;
  }
}

/**
 * Invoke a vLLM model via direct HTTP instead of LangChain.
 * Supports JSON mode and extended thinking.
 *
 * @param model - vLLM ChatOpenAI model instance
 * @param messages - Messages array (LangChain or OpenAI format)
 * @param options - Request options
 * @returns Raw response content
 */
export async function vllmHttpInvoke(
  model: any,
  messages: any[],
  options: {
    jsonMode?: boolean;
    timeout?: number;
    enableThinking?: boolean;
    maxTokens?: number;
  } = {},
): Promise<string> {
  const config = extractVllmConfig(model);
  if (!config) {
    throw new Error("Cannot extract vLLM config from model");
  }

  const {
    jsonMode = true,
    timeout = 300,
    enableThinking = false,
    maxTokens,
  } = options;

  // Convert LangChain messages to OpenAI format
  const formattedMessages = messages.map((msg: any) => {
    if (msg.type || msg._getType) {
      const msgType = msg.type || msg._getType?.();
      const role =
        msgType === "system"
          ? "system"
          : msgType === "human"
            ? "user"
            : msgType;
      return {
        role,
        content: msg.content || msg.text || String(msg),
      };
    }
    if (msg.role && msg.content) return msg;
    return { role: "user", content: String(msg) };
  });

  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const url = `${baseUrl}/chat/completions`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const payload: Record<string, any> = {
    model: config.modelName,
    messages: formattedMessages,
    temperature: 0,
    top_p: 0.1,
  };

  if (enableThinking) {
    payload["chat_template_kwargs"] = { enable_thinking: true };
  }
  if (maxTokens) {
    payload["max_tokens"] = maxTokens;
  }
  if (jsonMode) {
    payload["response_format"] = { type: "json_object" };
  }

  logger.info("vLLM HTTP invoke", {
    url,
    model: config.modelName,
    jsonMode,
    timeout,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      logger.error(`vLLM HTTP error ${response.status}`, {
        error: errText.slice(0, 500),
      });
      throw new Error(`vLLM HTTP ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = (await response.json()) as any;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("Empty response from vLLM");
    }

    logger.info("vLLM HTTP response received", { length: content.length });
    return content;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Enhanced JSON Parsing ──────────────────────────────────────────────────────

/**
 * Clean JSON response by removing markdown wrappers and thinking tokens.
 */
export function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();

  // Remove thinking tokens (Kimi, Claude, Qwen)
  cleaned = cleaned.replace(/◁think▷[\s\S]*?◁\/think▷/g, "");
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "");

  // Remove markdown code fences
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");

  return cleaned.trim();
}

/**
 * Parse JSON with automatic repair on failure.
 * Handles malformed JSON gracefully.
 */
export function parseJsonWithRepairEnhanced(raw: string): unknown {
  const cleaned = cleanJsonResponse(raw);

  try {
    return JSON.parse(cleaned);
  } catch {
    try {
      return JSON.parse(jsonrepair(cleaned));
    } catch (repairErr) {
      logger.error("JSON repair failed", {
        preview: cleaned.slice(0, 300),
        error:
          repairErr instanceof Error ? repairErr.message : String(repairErr),
      });

      // Fallback to extracting JSON from response
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonrepair(jsonMatch[0]));
        } catch {
          return {
            error: "Failed to parse JSON",
            raw: raw.slice(0, 500),
          };
        }
      }

      return {
        error: "Failed to parse JSON",
        raw: raw.slice(0, 500),
      };
    }
  }
}

// ── Batch Processing ───────────────────────────────────────────────────────────

interface ChunkResult {
  chunkId: number;
  success: boolean;
  result?: unknown;
  error?: string;
}

/**
 * Aggregate results from multiple chunks into a single array.
 * Throws if ALL chunks failed; partial success is allowed.
 */
export function aggregateChunkResults(results: ChunkResult[]): unknown[] {
  const successful = results.filter((r) => r.success);

  if (successful.length === 0) {
    const firstError = results[0]?.error ?? "Unknown error";
    throw new Error(`All PDF chunks failed. First error: ${firstError}`);
  }

  if (successful.length < results.length) {
    logger.warn("Some PDF chunks failed; continuing with partial data", {
      successCount: successful.length,
      totalCount: results.length,
    });
  }

  const allData: unknown[] = [];
  for (const res of successful) {
    if (Array.isArray(res.result)) {
      allData.push(...res.result);
    } else if (res.result !== null && res.result !== undefined) {
      allData.push(res.result);
    }
  }

  return allData;
}

/**
 * Group/aggregate extracted data by a mapping key.
 * Heuristically searches for the key in each item.
 */
export function groupDataByKey(
  data: unknown[],
  mappingKey: string,
): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  for (const item of data) {
    if (typeof item !== "object" || item === null) {
      if (!grouped["_raw"]) grouped["_raw"] = [];
      grouped["_raw"].push(item);
      continue;
    }

    const itemObj = item as Record<string, any>;
    const keyVariations = [
      mappingKey,
      mappingKey.toLowerCase(),
      `${mappingKey.toLowerCase()}_no`,
      "rtv_no",
      "invoice_no",
      "document_no",
      "id",
    ];

    let keyValue: string | undefined;
    for (const keyVar of keyVariations) {
      if (keyVar in itemObj) {
        keyValue = String(itemObj[keyVar]);
        break;
      }
    }

    const groupKey = keyValue ?? "_ungrouped";
    if (!grouped[groupKey]) grouped[groupKey] = [];
    grouped[groupKey].push(itemObj);
  }

  return grouped;
}

// ── Timezone & Time Helpers ────────────────────────────────────────────────────

/**
 * Fix timezone information in extracted data.
 * If `utc` is a number (e.g. 8 for UTC+8), adds the offset (in ms) to all ISO datetime strings.
 * Matches source behavior from ai-service: `new Date(ts + utc * 3600000).toISOString()`.
 */
export function fixTimezone(data: unknown, utc?: number): unknown {
  if (utc === undefined || utc === null || isNaN(utc as number)) {
    return data;
  }

  const offset = (utc as number) * 60 * 60 * 1000;

  // ISO datetime regex: matches "2024-01-01T00:00:00", with optional ms and timezone
  const ISO_DATETIME_RE =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

  function processValue(obj: Record<string, any>): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === "string" && ISO_DATETIME_RE.test(value)) {
        try {
          const d = new Date(value);
          if (!isNaN(d.getTime())) {
            obj[key] = new Date(d.getTime() + offset).toISOString();
          }
        } catch {
          // Leave as-is on parse failure
        }
      } else if (value && typeof value === "object") {
        processValue(value as Record<string, any>);
      }
    }
  }

  if (Array.isArray(data)) {
    return data.map((item) => fixTimezone(item, utc));
  }

  if (data && typeof data === "object") {
    const copy = JSON.parse(JSON.stringify(data));
    processValue(copy as Record<string, any>);
    return copy;
  }

  return data;
}

// ── Image Processing ──────────────────────────────────────────────────────────

/**
 * Resize a base64-encoded image so it fits within maxWidth × maxHeight.
 * Uses sharp with PNG output and maximum compression.
 * Falls back to the original image if sharp fails.
 */
export async function resizeImageIfNeeded(
  base64Img: string,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
): Promise<string> {
  try {
    const sharp = (await import("sharp")).default;
    // Strip data-URL prefix if present
    const base64Data = base64Img.replace(/^data:image\/[a-z]+;base64,/, "");
    const inputBuffer = Buffer.from(base64Data, "base64");

    const outputBuffer = await sharp(inputBuffer)
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 9 })
      .toBuffer();

    return outputBuffer.toString("base64");
  } catch (err) {
    logger.warn("Image resize failed, returning original", {
      error: err instanceof Error ? err.message : String(err),
    });
    return base64Img;
  }
}

// ── Provider-Specific Handlers ────────────────────────────────────────────────

/**
 * Format messages for different AI providers.
 * Handles model-specific quirks and requirements.
 */
export function formatMessagesForProvider(
  messages: any[],
  provider: string,
): any[] {
  if (provider === "kimi") {
    // Kimi may require specific message format
    return messages.map((msg) => ({
      role: msg.role || "user",
      content: Array.isArray(msg.content) ? msg.content : msg.content,
    }));
  } else if (provider === "gemini") {
    // Gemini doesn't support system role in older versions
    return messages.map((msg) => {
      if (msg.role === "system") {
        return {
          role: "user",
          content: `[SYSTEM MESSAGE]\n${msg.content}`,
        };
      }
      return msg;
    });
  }
  // Default: return as-is
  return messages;
}

/**
 * Detect the best mapping key from extracted data using heuristics.
 * Falls back to common names if no obvious key is found.
 */
export function detectMappingKeyHeuristic(data: unknown[]): string {
  if (!Array.isArray(data) || data.length === 0) {
    return "Document ID";
  }

  const firstItem = data[0];
  if (typeof firstItem !== "object" || firstItem === null) {
    return "Document ID";
  }

  const keys = Object.keys(firstItem as Record<string, unknown>);
  const commonKeys = [
    "rtv_no",
    "rtvNo",
    "invoice_no",
    "invoiceNo",
    "document_no",
    "documentNo",
    "reference_no",
    "referenceNo",
    "order_no",
    "orderNo",
    "case_no",
    "caseNo",
    "id",
    "ID",
    "serial_number",
    "serialNumber",
  ];

  for (const commonKey of commonKeys) {
    if (keys.includes(commonKey)) {
      return commonKey;
    }
  }

  // If no common key found, use first non-text field
  for (const key of keys) {
    const val = (firstItem as Record<string, unknown>)[key];
    if (typeof val === "number" || typeof val === "string") {
      return key;
    }
  }

  return keys[0] ?? "Document ID";
}

// ── File Filling Helpers ───────────────────────────────────────────────────────

/**
 * Get file filler function based on file extension.
 * Returns null if filler is not available.
 */
export function getFillerForExtension(
  extension: string,
):
  | ((
      data: any,
      fileUrl: string,
      organizationId: string,
      xAccessToken: string,
    ) => Promise<string>)
  | null {
  const ext = extension.toLowerCase().trim().replace(/^\./, "");

  // PDF filler
  if (ext === "pdf") {
    return pdfFiller;
  }

  // Excel filler
  if (ext === "xlsx" || ext === "xls") {
    return excelFiller;
  }

  return null;
}

/**
 * Upload a file buffer to the Imbrace platform and return the public URL.
 * Mirrors ai-service databoard.upload() — POST /v1/board/_fileupload/:orgId
 */
async function uploadFilledFile(
  fileBuffer: Buffer,
  fileName: string,
  organizationId: string,
  xAccessToken: string,
): Promise<string> {
  const baseUrl = config.webAppApi.url;
  if (!baseUrl) throw new Error("WEB_APP_API_URL is not configured");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(fileBuffer)]), fileName);

  const response = await fetch(
    `${baseUrl}/v1/board/_fileupload/${organizationId}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${xAccessToken}` },
      body: form as any,
    },
  );

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as { url?: string };
  if (!json.url) throw new Error("Upload response missing url field");
  return json.url;
}

/**
 * Fill a PDF form template with extracted data and upload the result.
 * Boolean values → checkboxes; all other values → text fields.
 * Uses pdf-lib for form manipulation.
 */
async function pdfFiller(
  data: Record<string, any>,
  fileUrl: string,
  organizationId: string,
  xAccessToken: string,
): Promise<string> {
  try {
    const { PDFDocument } = await import("pdf-lib");

    const response = await fetch(fileUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch PDF: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();

    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const form = pdfDoc.getForm();

    for (const [key, value] of Object.entries(data)) {
      try {
        if (typeof value === "boolean") {
          const checkbox = form.getCheckBox(key);
          value ? checkbox.check() : checkbox.uncheck();
        } else if (value !== null && value !== undefined) {
          const field = form.getTextField(key);
          field.setText(String(value));
        }
      } catch {
        // Field not found in form — skip silently
      }
    }

    const pdfBytes = await pdfDoc.save();
    return await uploadFilledFile(
      Buffer.from(pdfBytes),
      "filled.pdf",
      organizationId,
      xAccessToken,
    );
  } catch (err) {
    logger.error("PDF filler failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fileUrl;
  }
}

/**
 * Fill an Excel template with extracted data by cell reference ("A1", "B2", …)
 * and upload the result.
 * Uses exceljs for workbook manipulation.
 */
async function excelFiller(
  data: Record<string, any>,
  fileUrl: string,
  organizationId: string,
  xAccessToken: string,
): Promise<string> {
  try {
    const ExcelJS = await import("exceljs");
    const workbook = new ExcelJS.default.Workbook();

    const response = await fetch(fileUrl);
    if (!response.ok)
      throw new Error(`Failed to fetch Excel: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    // Reason: exceljs types expect unparameterized Buffer; cast avoids
    // @types/node generic Buffer<ArrayBufferLike> mismatch.
    await workbook.xlsx.load(arrayBuffer as any);

    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error("No worksheet found in workbook");

    for (const [cellRef, value] of Object.entries(data)) {
      try {
        worksheet.getCell(cellRef).value =
          value === null || value === undefined ? "" : (value as any);
      } catch {
        // Invalid cell reference — skip silently
      }
    }

    const fileBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
    return await uploadFilledFile(
      fileBuffer,
      "filled.xlsx",
      organizationId,
      xAccessToken,
    );
  } catch (err) {
    logger.error("Excel filler failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return fileUrl;
  }
}

// ── Provider Detection ─────────────────────────────────────────────────────────

/**
 * Detect provider type from model name or configuration.
 */
export function detectProviderType(
  modelName: string,
  providerId?: string,
): "kimi" | "gemini" | "openai" | "ollama" | "vllm" | "bedrock" | "default" {
  const lower = modelName.toLowerCase();

  if (lower.includes("kimi") || lower.includes("moonshot")) {
    return "kimi";
  }
  if (lower.includes("gemini")) {
    return "gemini";
  }
  if (lower.includes("claude")) {
    return "bedrock";
  }
  if (lower.includes("gpt") || lower.includes("o1")) {
    return "openai";
  }
  if (lower.includes("ollama") || lower.includes("llama")) {
    return "ollama";
  }
  if (lower.includes("bedrock")) {
    return "bedrock";
  }
  if (providerId?.toLowerCase().includes("vllm")) {
    return "vllm";
  }

  return "default";
}

// ── Response Extraction ────────────────────────────────────────────────────────

/**
 * Extract text content from various response formats.
 */
export function extractTextFromResponse(response: any): string {
  if (typeof response === "string") {
    return response;
  }
  if (response?.content) {
    return String(response.content);
  }
  if (response?.text) {
    return String(response.text);
  }
  if (Array.isArray(response)) {
    const textPart = response.find(
      (p: any) => p.type === "text" || typeof p === "string",
    );
    return textPart
      ? String(textPart.text ?? textPart)
      : JSON.stringify(response);
  }
  return JSON.stringify(response);
}
