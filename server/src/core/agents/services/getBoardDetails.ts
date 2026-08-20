import config from "@/config";
import logger from "@/lib/logger";
import { credentialHeader } from "@/utils/credential";

export async function getBoardDetails(
  board_id?: string,
  x_access_token?: string,
) {
  if (!board_id) {
    throw new Error("productData");
  }

  const url = `${config.webApp.url}/${config.webApp.appgateway}/board/${board_id}/board_item_details`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  Object.assign(headers, credentialHeader(x_access_token));

  try {
    const response = await fetch(url, {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch board details: ${response.status}`);
    }

    const data = await response.json();
    return data.data;
  } catch (error) {
    logger.error("Error fetching board details:", error);
    throw new Error("Failed to fetch board details");
  }
}

export interface DataReturn {
  name: string;
  embeddingUrl: string;
  category: string;
  attachmentUrl?: string;
}

export interface DataSource {
  name: string;
  embeddingUrl: string;
  category: string;
  summary: string;
  schema?: string;
  attachmentUrl?: string;
}

export interface CategorizedBoardData {
  customerProfile: DataSource[];
  transcripts: DataSource[];
  products: DataSource[];
}

export async function getCategorizedBoardData(
  board_id?: string,
  x_access_token?: string,
): Promise<CategorizedBoardData> {
  const boardData = await getBoardDetails(board_id, x_access_token);
  return categorizeBoardData(boardData);
}

export function categorizeBoardData(boardData: any[]): CategorizedBoardData {
  const categorized: CategorizedBoardData = {
    customerProfile: [],
    transcripts: [],
    products: [],
  };

  boardData.forEach((item: any) => {
    const dataSource: DataSource = {
      name: item.Name || item.name || "Unknown",
      embeddingUrl: item["Embedding URL"] || item.embeddingUrl || "",
      category: item.Category || item.category || "Unknown",
      summary: item.Summary || item.summary || "",
      schema: item.Schema || item.schema,
      attachmentUrl: item.Attachments?.[0]?.data?.url || undefined,
    };

    const category = dataSource.category.toLowerCase();

    if (category.includes("customer") || category.includes("profile")) {
      categorized.customerProfile.push(dataSource);
    } else if (
      category.includes("transcript") ||
      category.includes("conversation")
    ) {
      categorized.transcripts.push(dataSource);
    } else if (category.includes("product") || category.includes("bond")) {
      categorized.products.push(dataSource);
    }
  });

  return categorized;
}

export async function getBoardSchema(
  board_id?: string,
  x_access_token?: string,
) {
  if (!board_id) {
    throw new Error("productData");
  }

  const url = `${config.webApp.url}/${config.webApp.appgateway}/backend/board/${board_id}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  Object.assign(headers, credentialHeader(x_access_token));

  try {
    const response = await fetch(url, {
      headers,
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch board details: ${response.status}`);
    }

    const data = (await response.json()) as { fields?: unknown };
    return data.fields;
  } catch (error) {
    logger.error("Error fetching board details:", error);
    throw new Error("Failed to fetch board details");
  }
}

/**
 * Create one or more board items from extracted document data.
 * Maps extracted field names to board_field_ids and POSTs to the Imbrace DataBoard API.
 *
 * @param boardId - Target board ID
 * @param boardFields - Field definitions returned by getBoardSchema (must include _id)
 * @param data - Extracted data: a single object or an array of objects
 * @param xAccessToken - Auth token for the Imbrace platform
 * @returns Array of created board item IDs (may be empty if API returns no IDs)
 */
/** Normalize a field key for case-insensitive, separator-agnostic matching. */
function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_\-.]+/g, "");
}

export async function createBoardItems(
  boardId: string,
  boardFields: Array<{
    _id?: string;
    name: string;
    type?: string;
    child_board_id?: string;
    child_board_fields?: Array<{ _id?: string; name: string; type?: string }>;
  }>,
  data: unknown,
  xAccessToken: string,
): Promise<string[]> {
  const url = `${config.webApp.url}/${config.webApp.appgateway}/backend/board/${boardId}/board_items`;

  // Build name → _id map for quick lookup (exact match)
  const fieldIdByName = new Map<string, string>();
  // Normalized key → _id map for case-insensitive / separator-agnostic fallback
  const fieldIdByNormalized = new Map<string, string>();
  // name → full field def (needed to detect TableInTable + child schema)
  const fieldByName = new Map<string, (typeof boardFields)[number]>();
  const fieldByNormalized = new Map<string, (typeof boardFields)[number]>();

  for (const f of boardFields) {
    if (f._id && f.name) {
      fieldIdByName.set(f.name, f._id);
      fieldIdByNormalized.set(normalizeKey(f.name), f._id);
      fieldByName.set(f.name, f);
      fieldByNormalized.set(normalizeKey(f.name), f);
    }
  }

  // Sentinel keys injected by boardFieldsToZodSchema — never map to board fields
  const SENTINEL_KEYS = new Set(["ReQuEsT_HuMaN", "SaY_To_HuMaN"]);

  /**
   * For a TableInTable parent field, translate model output rows
   *   [{ "Item Code": "9131659", "Description": "...", ... }]
   * into the API-expected shape
   *   [{ "<Item Code _id>": "9131659", "<Description _id>": "...", ... }]
   * using the parent field's child_board_fields name → _id map.
   */
  function transformTableInTableRows(
    parent: (typeof boardFields)[number],
    rows: unknown,
  ): Array<Record<string, unknown>> {
    if (!Array.isArray(rows)) return [];
    const childById = new Map<string, string>();
    const childByNormalized = new Map<string, string>();
    for (const c of parent.child_board_fields ?? []) {
      if (c._id && c.name) {
        childById.set(c.name, c._id);
        childByNormalized.set(normalizeKey(c.name), c._id);
      }
    }
    const out: Array<Record<string, unknown>> = [];
    for (const row of rows) {
      if (!row || typeof row !== "object") continue;
      const translated: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(row as Record<string, unknown>)) {
        const cid =
          childById.get(k) ?? childByNormalized.get(normalizeKey(k));
        if (cid) translated[cid] = v;
      }
      if (Object.keys(translated).length > 0) out.push(translated);
    }
    return out;
  }

  // Normalize single object to array so we can loop uniformly
  const records: unknown[] = Array.isArray(data) ? data : [data];
  const createdIds: string[] = [];

  for (const record of records) {
    if (!record || typeof record !== "object") continue;

    const fields = Object.entries(record as Record<string, unknown>)
      .filter(([key]) => !SENTINEL_KEYS.has(key))
      .flatMap(([key, value]) => {
        // Reason: try exact match first; fall back to normalized match so that
        // keys like "invoice_number" still map to a board field named
        // "Invoice Number" when the model uses different casing or separators.
        const fieldId =
          fieldIdByName.get(key) ??
          fieldIdByNormalized.get(normalizeKey(key));
        if (!fieldId) return [];
        const fieldDef =
          fieldByName.get(key) ?? fieldByNormalized.get(normalizeKey(key));

        // TableInTable: translate model-emitted readable rows to the
        // child-field-id shape the board API expects.
        if (fieldDef?.type === "TableInTable") {
          const transformed = transformTableInTableRows(fieldDef, value);
          const entry: Record<string, unknown> = {
            board_field_id: fieldId,
            type: "TableInTable",
            value: transformed,
          };
          if (fieldDef.child_board_id) {
            entry["child-board"] = fieldDef.child_board_id;
          }
          return [entry];
        }

        return [{ board_field_id: fieldId, value }];
      });

    if (fields.length === 0) continue;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...credentialHeader(xAccessToken),
        },
        body: JSON.stringify({ fields }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn("Board item creation failed", {
          boardId,
          status: response.status,
          error: errText.slice(0, 200),
        });
        continue;
      }

      const json = (await response.json()) as { board_id?: string };
      if (json.board_id) createdIds.push(json.board_id);
    } catch (err) {
      logger.error("Board item creation error", {
        boardId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return createdIds;
}
