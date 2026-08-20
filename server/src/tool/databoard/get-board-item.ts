import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

export const getBoardItem = tool({
  description:
    "Get the RAW record for a SINGLE board_item by ID (includes full field metadata, not just values). ⛔ DO NOT call this in a loop to read many rows — use get_board_items instead, which already returns every row's values. Only use this tool when: (1) the user gave you a specific board_item_id and asks to inspect that one row, OR (2) you need raw field metadata (`field._id`, `field.contact_field`, etc.) that get_board_items strips out.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board"),
    board_item_id: z.string().describe("The ID of the board item (row)"),
  }),
  execute: async ({ board_id, board_item_id }) => {
    try {
      const data: any = await privateApiRequest(
        "GET",
        `/api/boards/${board_id}/items/${board_item_id}`,
      );

      const fieldCount =
        data?.fields && typeof data.fields === "object"
          ? Object.keys(data.fields).length
          : 0;

      return buildResponse(
        "get_board_item",
        data,
        `Retrieved board item ${board_item_id} (${fieldCount} field(s)) from board ${board_id}.`,
        [
          'Use "create_board_item" to add another row',
          'Use "get_board_items" to list rows in this board',
        ],
      );
    } catch (error) {
      logger.error("get_board_item failed", {
        error,
        board_id,
        board_item_id,
      });
      return buildErrorResponse("get_board_item", error);
    }
  },
});
