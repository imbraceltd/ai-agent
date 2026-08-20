/**
 * Document AI Utilities
 * Pure stateless helpers for document fetching, PDF rendering, JSON cleaning,
 * and board-schema-to-Zod conversion. No AI SDK calls here.
 */

import { pdf } from "pdf-to-img";
import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import logger from "@/lib/logger";

// MIME → extension mapping
const MIME_TYPE_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/webp": "webp",
  "image/gif": "gif",
};

// ── Document fetching ──────────────────────────────────────────────────────────

/**
 * Fetch a document from a URL and return its extension + base64 string.
 * @param url - Document URL
 * @returns {extension, base64}
 */
export async function fetchUrlAsBase64(
  url: string,
): Promise<{ extension: string; base64: string }> {
  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to fetch document: HTTP ${response.status} ${url}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  const mimeBase = contentType.split(";")[0]?.trim().toLowerCase() ?? "";
  let extension: string | undefined = MIME_TYPE_MAP[mimeBase];

  if (!extension) {
    // Fallback: detect from URL path
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      if (pathname.endsWith(".pdf")) extension = "pdf";
      else if (pathname.endsWith(".png")) extension = "png";
      else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg"))
        extension = "jpeg";
      else if (pathname.endsWith(".webp")) extension = "webp";
      else if (pathname.endsWith(".gif")) extension = "gif";
    } catch {
      // URL parsing failed, continue
    }
  }

  if (!extension) {
    throw new Error(`Unsupported file format: ${contentType || "unknown"}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return { extension, base64 };
}

// ── PDF rendering ──────────────────────────────────────────────────────────────

/**
 * Convert a base64-encoded PDF into an array of base64 PNG strings (one per page).
 * Rendered at 150 DPI via pdf-to-img.
 *
 * @param base64String - Base64-encoded PDF content
 * @param options - Optional configuration for pdf-to-img
 * @param scale - Scale factor for image quality (default: 2.0)
 * @returns Array of base64 PNG strings (one per page)
 */
export async function pdfBase64ToPngPages(
  base64String: string,
  options = {},
  scale = 2.0,
): Promise<string[]> {
  // Prepare options with scale
  const defaultOptions = {
    scale,
    ...options,
  };

  // Convert base64 string to Buffer
  const pdfBuffer = Buffer.from(base64String, "base64");

  // Use pdf-to-img to convert PDF to images
  const document = await pdf(pdfBuffer, defaultOptions);

  // Convert PDF pages to base64 strings
  const images: string[] = [];
  let pageNumber = 1;

  for await (const image of document) {
    // Convert image buffer to base64
    const imageBase64 = image.toString("base64");
    images.push(imageBase64);

    logger.debug(`Page ${pageNumber} converted successfully using pdf-to-img`);
    pageNumber++;
  }

  return images;
}

// ── PDF chunking ───────────────────────────────────────────────────────────────

export interface PdfChunk {
  /** 0-based chunk index */
  chunkId: number;
  /** 1-based start page number */
  startPage: number;
  /** 1-based end page number */
  endPage: number;
  /** Base64 PNG strings for pages in this chunk */
  pages: string[];
  /** Total number of chunks */
  totalChunks: number;
}

/**
 * Split an array of page PNG strings into chunks of N pages each.
 * @param pages - Array of base64 PNG strings (one per page)
 * @param chunkSize - Max pages per chunk
 * @returns Array of PdfChunk descriptors
 */
export function splitPagesIntoChunks(
  pages: string[],
  chunkSize: number,
): PdfChunk[] {
  const totalChunks = Math.ceil(pages.length / chunkSize);
  return Array.from({ length: totalChunks }, (_, i) => ({
    chunkId: i,
    startPage: i * chunkSize + 1,
    endPage: Math.min((i + 1) * chunkSize, pages.length),
    pages: pages.slice(i * chunkSize, (i + 1) * chunkSize),
    totalChunks,
  }));
}

// ── URL extraction from messages ───────────────────────────────────────────────

/**
 * Extract a document URL from the last user message.
 * Priority: file attachment parts → URL pattern in text content.
 * @param messages - Messages array (UIMessage or ModelMessage format)
 * @returns Document URL or null if not found
 */
export function extractDocumentUrl(messages: unknown[]): string | null {
  const userMessages = (messages as any[]).filter(
    (m: any) => m.role === "user",
  );
  const lastUser = userMessages[userMessages.length - 1];
  if (!lastUser) return null;

  // Collect all content parts from different message formats
  const parts: any[] = Array.isArray(lastUser.content)
    ? lastUser.content
    : Array.isArray(lastUser.parts)
      ? lastUser.parts
      : [];

  // Priority 1: file attachment parts
  for (const part of parts) {
    if (part?.type === "file") {
      const url =
        // data is a string URL (legacy format)
        (typeof part.data === "string" &&
          part.data.startsWith("http") &&
          part.data) ||
        // data is an object with a url field (AI SDK UIMessage format: { url: "..." })
        (typeof part.data === "object" &&
          part.data !== null &&
          typeof (part.data as any).url === "string" &&
          (part.data as any).url) ||
        // top-level url field
        (typeof part.url === "string" && part.url) ||
        null;
      if (url) return url;
    }
  }

  // Priority 2: URL in text parts
  for (const part of parts) {
    if (part?.type === "text" && typeof part.text === "string") {
      const match = part.text.match(/https?:\/\/[^\s"'<>]+/);
      if (match) return match[0];
    }
  }

  // Priority 3: top-level string content
  if (typeof lastUser.content === "string") {
    const match = lastUser.content.match(/https?:\/\/[^\s"'<>]+/);
    if (match) return match[0];
  }

  return null;
}

// ── JSON utilities ─────────────────────────────────────────────────────────────

/**
 * Strip markdown code fences and thinking tokens from an LLM response.
 * @param raw - Raw model output string
 * @returns Cleaned string ready for JSON.parse
 */
export function cleanJsonResponse(raw: string): string {
  let cleaned = raw.trim();
  // Strip thinking tokens from various models
  cleaned = cleaned.replace(/◁think▷[\s\S]*?◁\/think▷/g, "");
  cleaned = cleaned.replace(/<thinking>[\s\S]*?<\/thinking>/g, "");
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "");
  // Strip markdown code fences
  cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/i, "");
  cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  return cleaned.trim();
}

/**
 * Parse a JSON string with automatic repair on failure.
 * @param raw - Raw string from model (may include markdown, thinking tokens)
 * @returns Parsed JavaScript value
 */
export function parseJsonWithRepair(raw: string): unknown {
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
      return {
        error: "Failed to parse model response as JSON",
        raw_content: raw.slice(0, 500),
      };
    }
  }
}

// ── Board schema → Zod conversion ─────────────────────────────────────────────

/** Single field definition as returned by getBoardSchema() */
export interface BoardField {
  /** MongoDB ObjectID — used as board_field_id when creating board items */
  _id?: string;
  name: string;
  type: string;
  description?: string;
  /** Enum values for selection fields */
  data?: Array<{ value: string }>;
  is_identifier?: boolean;
  /** TableInTable: nested column definitions for child rows */
  child_board_fields?: BoardField[];
  /** TableInTable: child board ID (used when posting items) */
  child_board_id?: string;
}

/** Field types to skip entirely (no usable Zod equivalent) */
const SKIPPED_TYPES = new Set(["Assignee"]);

/** Known field types → JSON Schema "type" (for prompt embedding) */
const JSON_TYPE_MAP: Record<string, string> = {
  ShortText: "string",
  LongText: "string",
  RichText: "string",
  Notes: "string",
  Email: "string",
  Link: "string",
  SingleSelection: "string",
  Origin: "string",
  MultipleSelection: "array",
  Number: "number",
  Checkbox: "boolean",
  Priority: "string",
  Date: "string",
  Time: "string",
  Datetime: "string",
  Currency: "object",
  Phone: "object",
  Country: "object",
  Attachment: "array",
  TableInTable: "array",
};

/**
 * Field-type → JSON Schema property template (mirrors chat-ai backend's
 * `output_schema_properties` in databoard.py). Used to embed exact nested
 * shapes (e.g. Currency requires `amounts`+`currency_code`, not arbitrary
 * `amount`+`currency`) in the prompt so the LLM emits values the board API
 * accepts.
 */
const RAW_SCHEMA_TEMPLATES: Record<string, Record<string, unknown>> = {
  Currency: {
    type: "object",
    description: "Format: Currency code; ",
    properties: {
      amounts: {
        type: "number",
        default: 0,
        description:
          "The numerical value of the amount (e.g., 100.50 for $100.50).",
      },
      currency_code: {
        type: "string",
        default: "HKD",
        enum: [
          "HKD", "VND", "MYR", "USD", "CNY", "TWD", "AUD",
          "CAD", "CHF", "EUR", "GBP", "JPY", "NZD", "SGD",
          "THB", "ZAR",
        ],
        description:
          "The ISO 4217 three-letter currency code (e.g., 'USD' for US Dollar, 'HKD' for Hong Kong Dollar).",
      },
    },
    required: ["amounts", "currency_code"],
  },
  Phone: {
    type: "object",
    description: "",
    properties: {
      country_code: {
        type: "string",
        default: "HK",
        description:
          "The ISO 3166-1 alpha-2 country code (e.g., 'US', 'HK').",
      },
      country_calling_code: {
        type: "string",
        default: "852",
        description:
          "International calling code without '+' (e.g., '1', '852').",
      },
      phone: {
        type: "string",
        description: "Local phone number without country code.",
      },
      calling_code_with_number: {
        type: "string",
        description:
          "Full international phone number with '+' (e.g., '+85298765432').",
      },
      national_number: {
        type: "string",
        description: "Formatted local phone number (e.g., '98765432').",
      },
    },
    required: [
      "country_code",
      "country_calling_code",
      "phone",
      "calling_code_with_number",
      "national_number",
    ],
  },
  Country: {
    type: "object",
    description: "",
    properties: {
      country_code: {
        type: "string",
        default: "HK",
        description: "ISO 3166-1 alpha-2 country code.",
      },
      country_name: {
        type: "string",
        default: "Hong Kong",
        description: "Full country/region name.",
      },
    },
    required: ["country_code", "country_name"],
  },
  Attachment: {
    type: "array",
    description: "",
    items: {
      type: "object",
      properties: {
        type: { type: "string", default: "url" },
        data: {
          type: "object",
          properties: {
            name: { type: "string", description: "Same as file url." },
            url: { type: "string", format: "uri", description: "File url." },
          },
          required: ["name", "url"],
        },
      },
      required: ["type", "data"],
    },
  },
  Date: {
    type: "string",
    description:
      "Format: datetime in ISO 8601 format, like yyyy-MM-ddTHH:mm:ssZ; ",
  },
  Time: {
    type: "string",
    description:
      "Format: datetime in ISO 8601 format, like yyyy-MM-ddTHH:mm:ssZ; ",
  },
  Datetime: {
    type: "string",
    description:
      "Format: datetime in ISO 8601 format, like yyyy-MM-ddTHH:mm:ssZ; ",
  },
  Email: { type: "string", description: "Format: valid email; " },
  Link: { type: "string", description: "Format: valid url; " },
};

function getEnumValues(field: BoardField): string[] {
  return (field.data ?? [])
    .map((d) => d.value)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
}

/** Convert a single BoardField to a Zod schema, or null if skipped. */
function boardFieldToZod(field: BoardField): z.ZodTypeAny | null {
  if (SKIPPED_TYPES.has(field.type)) return null;
  if (!field.name) return null;

  const desc = field.description ?? "";
  const enumVals = getEnumValues(field);

  switch (field.type) {
    case "ShortText":
      return enumVals.length >= 1
        ? z
            .enum([enumVals[0], ...enumVals.slice(1)] as [string, ...string[]])
            .optional()
            .describe(`${desc} (max 150 chars)`)
        : z.string().max(150).optional().describe(desc);

    case "LongText":
    case "RichText":
    case "Notes":
    case "Email":
    case "Link":
      return z.string().optional().describe(desc);

    case "SingleSelection":
    case "Origin":
      return enumVals.length >= 1
        ? z
            .enum([enumVals[0], ...enumVals.slice(1)] as [string, ...string[]])
            .optional()
            .describe(desc)
        : z.string().optional().describe(desc);

    case "MultipleSelection":
      return enumVals.length >= 1
        ? z
            .array(
              z.enum([enumVals[0], ...enumVals.slice(1)] as [
                string,
                ...string[],
              ]),
            )
            .optional()
            .describe(desc)
        : z.array(z.string()).optional().describe(desc);

    case "Number":
      return z.number().optional().describe(desc);

    case "Checkbox":
      return z.boolean().optional().describe(desc);

    case "Priority":
      return z
        .enum(["Low", "Medium", "High", "Very High"])
        .optional()
        .describe(desc);

    case "Date":
    case "Time":
    case "Datetime":
      return z
        .string()
        .optional()
        .describe(`${desc} — ISO 8601 format yyyy-MM-ddTHH:mm:ssZ`);

    case "Currency":
      return z
        .object({
          amounts: z.number().default(0),
          currency_code: z
            .enum([
              "HKD",
              "VND",
              "MYR",
              "USD",
              "CNY",
              "TWD",
              "AUD",
              "CAD",
              "CHF",
              "EUR",
              "GBP",
              "JPY",
              "NZD",
              "SGD",
              "THB",
              "ZAR",
            ])
            .default("HKD"),
        })
        .optional()
        .describe(desc);

    case "Phone":
      return z
        .object({
          country_code: z.string().default("HK"),
          country_calling_code: z.string().default("852"),
          phone: z.string(),
          calling_code_with_number: z.string(),
          national_number: z.string(),
        })
        .optional()
        .describe(desc);

    case "Country":
      return z
        .object({
          country_code: z.string().default("HK"),
          country_name: z.string().default("Hong Kong"),
        })
        .optional()
        .describe(desc);

    case "Attachment":
      return z
        .array(
          z.object({
            type: z.string().default("url"),
            data: z.object({ name: z.string(), url: z.string() }),
          }),
        )
        .optional()
        .describe(desc);

    case "TableInTable":
      // Reason: each row is a free-form object keyed by child column names.
      // Lenient typing — strict child schema enforcement happens via the
      // prompt's nested JSON Schema, not Zod.
      return z.array(z.record(z.unknown())).optional().describe(desc);

    default:
      return z.unknown().optional().describe(desc);
  }
}

/**
 * Convert an array of board fields from getBoardSchema() into a Zod object schema
 * suitable for generateObject(). Always appends the ReQuEsT_HuMaN and SaY_To_HuMaN
 * sentinel fields used by the Imbrace platform.
 *
 * @param fields - Board field array from getBoardSchema()
 * @returns Zod object schema, or null if fields is empty
 */
export function boardFieldsToZodSchema(
  fields: BoardField[],
): z.ZodObject<any> | null {
  if (!fields || fields.length === 0) return null;

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    const zodField = boardFieldToZod(field);
    if (zodField !== null) {
      shape[field.name] = zodField;
    }
  }

  // Standard sentinel fields always present
  shape["ReQuEsT_HuMaN"] = z
    .boolean()
    .default(false)
    .describe(
      "Return true if you are not confident about filling in all required values",
    );
  shape["SaY_To_HuMaN"] = z
    .string()
    .optional()
    .describe("Comments describing how you performed the extraction");

  return z.object(shape);
}

/**
 * Build a plain JSON Schema object from board fields.
 * Used for embedding schema information into prompt strings.
 * @param fields - Board field array from getBoardSchema()
 * @returns JSON Schema as a plain object
 */
export function buildRawJsonSchema(
  fields: BoardField[],
): Record<string, unknown> {
  const properties: Record<string, unknown> = {};

  for (const field of fields) {
    if (!field.name || !JSON_TYPE_MAP[field.type]) continue;
    const enumVals = getEnumValues(field);

    // TableInTable: build nested array-of-object schema dynamically from
    // child_board_fields so the model knows exact column names per row.
    if (field.type === "TableInTable") {
      const childFields = field.child_board_fields ?? [];
      const itemProps: Record<string, unknown> = {};
      for (const child of childFields) {
        if (!child.name || !JSON_TYPE_MAP[child.type]) continue;
        const childTemplate = RAW_SCHEMA_TEMPLATES[child.type];
        const childEnumVals = getEnumValues(child);
        const childEntry: Record<string, unknown> = childTemplate
          ? JSON.parse(JSON.stringify(childTemplate))
          : { type: JSON_TYPE_MAP[child.type], description: "" };
        const cDesc = child.description ?? "";
        if (cDesc) {
          const base = (childEntry["description"] as string | undefined) ?? "";
          childEntry["description"] = base + cDesc;
        }
        if (
          childEnumVals.length > 0 &&
          JSON_TYPE_MAP[child.type] === "string"
        ) {
          childEntry["enum"] = childEnumVals;
        }
        // Use trimmed name as the schema key the model emits (some boards
        // store names with leading/trailing spaces). createBoardItems
        // normalizes for matching either way.
        itemProps[child.name.trim()] = childEntry;
      }
      properties[field.name] = {
        type: "array",
        description: field.description ?? "",
        items: {
          type: "object",
          properties: itemProps,
        },
      };
      continue;
    }

    // Reason: prefer the typed template (Currency, Phone, Country, etc.) so
    // the model sees the exact required nested shape. Fall back to a generic
    // `{type, description}` only when no template exists (basic scalars).
    const template = RAW_SCHEMA_TEMPLATES[field.type];
    const entry: Record<string, unknown> = template
      ? // shallow clone so per-field description merge doesn't mutate template
        JSON.parse(JSON.stringify(template))
      : {
          type: JSON_TYPE_MAP[field.type],
          description: "",
        };

    // Merge field-level description with template description
    const fieldDesc = field.description ?? "";
    if (fieldDesc) {
      const baseDesc = (entry["description"] as string | undefined) ?? "";
      entry["description"] = baseDesc + fieldDesc;
    }

    if (enumVals.length > 0 && JSON_TYPE_MAP[field.type] === "string") {
      entry["enum"] = enumVals;
    }
    properties[field.name] = entry;
  }

  // Sentinel fields
  properties["ReQuEsT_HuMaN"] = {
    type: "boolean",
    description: "Return true if not confident about filling required values",
    default: false,
  };
  properties["SaY_To_HuMaN"] = {
    type: "string",
    description: "Comments on how you performed",
  };

  return { title: "output_schema", type: "object", properties };
}
