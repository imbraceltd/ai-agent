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
    board_field_id: z
      .string()
      .describe(
        "The field's _id (NOT the field name). Look it up via get_board_details.",
      ),
    value: z
      .any()
      .describe(
        "Field value. Type depends on the field: string for ShortText/LongText/Email/etc.; number for Number; ISO string for Date/Datetime; { currency_code, amounts } for Currency; array of row objects keyed by nested field _id for TableInTable.",
      ),
    type: z
      .string()
      .optional()
      .describe(
        "Optional type hint. Required when value is a TableInTable payload (set type='TableInTable').",
      ),
    "child-board": z
      .string()
      .optional()
      .describe(
        "For TableInTable values: the child board id whose row schema the nested rows follow.",
      ),
  })
  .passthrough();

export const createBoardItem = tool({
  description:
    "Create a single row (board_item) in a board. Field values must reference existing field IDs from get_board_details — using field NAMES will fail. Returns the created item.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board to insert into"),
    fields: z
      .array(fieldEntrySchema)
      .min(1)
      .describe(
        "Array of { board_field_id, value, [type, child-board] } entries.",
      ),
    logo_url: z
      .string()
      .nullable()
      .optional()
      .describe("Logo URL (mainly for Company-style boards)"),
    conversation_id: z.string().nullable().optional(),
    app_name: z.string().nullable().optional(),
    related_board_item_id: z
      .string()
      .nullable()
      .optional()
      .describe("Link this new item to an existing item in another board"),
  }),
  execute: async ({
    board_id,
    fields,
    logo_url,
    conversation_id,
    app_name,
    related_board_item_id,
  }) => {
    try {
      const body: Record<string, unknown> = { fields };
      if (logo_url !== undefined) body["logo_url"] = logo_url;
      if (conversation_id !== undefined)
        body["conversation_id"] = conversation_id;
      if (app_name !== undefined) body["app_name"] = app_name;
      if (related_board_item_id !== undefined)
        body["related_board_item_id"] = related_board_item_id;

      const data: any = await privateApiRequest(
        "POST",
        `/api/boards/${board_id}/items`,
        body,
      );

      const itemId = data?._id || data?.id || "unknown";
      return buildResponse(
        "create_board_item",
        data,
        `Created board item ${itemId} in board ${board_id} with ${fields.length} field value(s).`,
        [
          'Use "get_board_item" to verify the inserted row',
          'Use "create_board_items" for bulk inserts (up to 1000 rows)',
        ],
      );
    } catch (error) {
      logger.error("create_board_item failed", { error, board_id });
      return buildErrorResponse("create_board_item", error);
    }
  },
});
