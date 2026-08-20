import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const summarizeFieldEntry = (entry: unknown): unknown => {
  // List endpoint returns the value directly (string | number | null | array | ...).
  // Single-item endpoint returns a richer object: { value, type, field: { name, ... } }.
  // Normalize both shapes so the LLM always sees a value.
  if (entry === null || entry === undefined) return entry;
  if (typeof entry !== "object") return entry;
  if (Array.isArray(entry)) return entry;
  const e = entry as Record<string, any>;
  if (
    "value" in e ||
    "field" in e ||
    "board_field_id" in e ||
    "type" in e
  ) {
    return {
      name: e["field"]?.name,
      type: e["type"] ?? e["field"]?.type,
      value: e["value"],
    };
  }
  return entry;
};

const summarizeItem = (item: any) => {
  if (!item || typeof item !== "object") return item;
  const fields = item.fields;
  let fieldSummary: Record<string, unknown> | undefined;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    fieldSummary = {};
    for (const [fieldId, entry] of Object.entries(fields)) {
      fieldSummary[fieldId] = summarizeFieldEntry(entry);
    }
  }
  return {
    _id: item._id,
    board_id: item.board_id,
    organization_id: item.organization_id,
    contact_id: item.contact_id,
    created_by: item.created_by,
    created_type: item.created_type,
    created_at: item.created_at,
    updated_at: item.updated_at,
    related_board_item_list: item.related_board_item_list,
    conversation_ids: item.conversation_ids,
    contacts: item.contacts,
    fields: fieldSummary ?? fields,
  };
};

export const getBoardItems = tool({
  description:
    "List rows (board_items) inside a board AND return their field values. THIS IS THE ONLY TOOL YOU NEED TO READ ALL ROWS OF A BOARD. The response already contains every row's full field values — DO NOT loop and call get_board_item per row afterwards. Use limit (max 100) + skip to paginate large boards. Supports filter (object keyed by board_field_id), sort (e.g. '-created_at'), and convenience filters (phone, email). Call get_board_details first only if you need field IDs for filtering.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board to list items from"),
    limit: z
      .number()
      .int()
      .min(0)
      .max(100)
      .optional()
      .describe("Page size (default 10, max 100)"),
    skip: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Offset for pagination (default 0)"),
    sort: z
      .string()
      .optional()
      .describe(
        "Sort key (default '-created_at'). Prefix with '-' for descending.",
      ),
    filter: z
      .record(z.string(), z.any())
      .optional()
      .describe(
        "Filter object keyed by board_field_id (e.g. { '<field_id>': 'value' }).",
      ),
    phone: z.string().optional().describe("Convenience filter by phone"),
    email: z.string().optional().describe("Convenience filter by email"),
    include_parent: z
      .boolean()
      .optional()
      .describe("Include parent board items (default false)"),
  }),
  execute: async ({
    board_id,
    limit,
    skip,
    sort,
    filter,
    phone,
    email,
    include_parent,
  }) => {
    try {
      const queryParams: Record<string, string | undefined> = {
        limit: limit !== undefined ? String(limit) : undefined,
        skip: skip !== undefined ? String(skip) : undefined,
        sort,
        phone,
        email,
        include_parent:
          include_parent !== undefined ? String(include_parent) : undefined,
        filter:
          filter && Object.keys(filter).length > 0
            ? JSON.stringify(filter)
            : undefined,
      };

      const data: any = await privateApiRequest(
        "GET",
        `/api/boards/${board_id}/items`,
        undefined,
        queryParams,
      );

      const rawItems = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data)
            ? data
            : [];
      const items = rawItems.map(summarizeItem);
      const total = data?.total ?? data?.count ?? items.length;

      return buildResponse(
        "get_board_items",
        { items, count: items.length, total, has_more: data?.has_more },
        `Retrieved ${items.length} item(s) from board ${board_id} (total ${total}).`,
        [
          'Use "get_board_item" with board_item_id to inspect a single row',
          'Use "create_board_item" to add a new row',
        ],
      );
    } catch (error) {
      logger.error("get_board_items failed", { error, board_id });
      return buildErrorResponse("get_board_items", error);
    }
  },
});
