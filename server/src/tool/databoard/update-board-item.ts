import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const updateEntrySchema = z.object({
  key: z
    .string()
    .describe(
      "The field's `_id` (NOT the field name). Look it up via get_board_details.",
    ),
  value: z
    .any()
    .describe(
      "New field value. Same shape as create_board_item: string for text/email/etc., number for Number, { currency_code, amounts } for Currency, ISO string for Date/Datetime, etc.",
    ),
});

export const updateBoardItem = tool({
  description:
    "Update a single board_item (row) by ID. Only the fields included in `data` are changed; omitted fields are left as-is. ⚠️ Note the API quirk: this tool uses `data: [{key, value}]` (key = board_field_id), NOT the `fields: [{board_field_id, value}]` shape used by create_board_item.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board"),
    board_item_id: z.string().describe("The ID of the board item to update"),
    data: z
      .array(updateEntrySchema)
      .min(1)
      .describe(
        "Array of field updates. Each entry: { key: <board_field_id>, value: <new_value> }. Only listed fields are modified.",
      ),
    logo_url: z.string().nullable().optional(),
    conversation_id: z.string().nullable().optional(),
    app_name: z.string().nullable().optional(),
    parent_board_item_id: z
      .string()
      .nullable()
      .optional()
      .describe("Re-link this row to a different parent item if applicable"),
  }),
  execute: async ({
    board_id,
    board_item_id,
    data,
    logo_url,
    conversation_id,
    app_name,
    parent_board_item_id,
  }) => {
    try {
      const body: Record<string, unknown> = { data };
      if (logo_url !== undefined) body["logo_url"] = logo_url;
      if (conversation_id !== undefined)
        body["conversation_id"] = conversation_id;
      if (app_name !== undefined) body["app_name"] = app_name;
      if (parent_board_item_id !== undefined)
        body["parent_board_item_id"] = parent_board_item_id;

      const result: any = await privateApiRequest(
        "PATCH",
        `/api/boards/${board_id}/items/${board_item_id}`,
        body,
      );

      return buildResponse(
        "update_board_item",
        result,
        `Updated ${data.length} field(s) on board item ${board_item_id}.`,
        ['Use "get_board_item" to verify the updated values'],
      );
    } catch (error) {
      logger.error("update_board_item failed", {
        error,
        board_id,
        board_item_id,
      });
      return buildErrorResponse("update_board_item", error);
    }
  },
});
