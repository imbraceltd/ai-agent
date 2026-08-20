import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const fieldEntrySchema = z
  .object({
    board_field_id: z.string(),
    value: z.any(),
    type: z.string().optional(),
    "child-board": z.string().optional(),
  })
  .passthrough();

const itemSchema = z
  .object({
    fields: z.array(fieldEntrySchema).min(1),
    logo_url: z.string().nullable().optional(),
    conversation_id: z.string().nullable().optional(),
    app_name: z.string().nullable().optional(),
    related_board_item_id: z.string().nullable().optional(),
  })
  .passthrough();

export const createBoardItems = tool({
  description:
    "Bulk create rows (board_items) in a board. Pass up to 1000 items in a single call. Each item's field values must reference field IDs from get_board_details. Use this when seeding data or importing many records — for one-off inserts use create_board_item.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board to insert into"),
    items: z
      .array(itemSchema)
      .min(1)
      .max(1000)
      .describe(
        "Array of items, each shaped like the create_board_item body. Min 1, max 1000.",
      ),
    strict_mode: z
      .boolean()
      .optional()
      .describe(
        "If true (default), the API rejects the whole batch on any item error. If false, valid items are inserted and errors are reported.",
      ),
  }),
  execute: async ({ board_id, items, strict_mode }) => {
    try {
      const body: Record<string, unknown> = { items };
      if (strict_mode !== undefined) body["strict_mode"] = strict_mode;

      const data: any = await privateApiRequest(
        "POST",
        `/api/boards/${board_id}/items/bulk`,
        body,
      );

      const insertedCount =
        (Array.isArray(data?.items) && data.items.length) ||
        data?.inserted ||
        data?.count ||
        items.length;

      return buildResponse(
        "create_board_items",
        data,
        `Bulk-created ${insertedCount} item(s) in board ${board_id}.`,
        [
          'Use "get_board_items" to verify the inserted rows',
          'Use "create_board_item" for single-row inserts',
        ],
      );
    } catch (error) {
      logger.error("create_board_items failed", {
        error,
        board_id,
        item_count: items?.length,
      });
      return buildErrorResponse("create_board_items", error);
    }
  },
});
