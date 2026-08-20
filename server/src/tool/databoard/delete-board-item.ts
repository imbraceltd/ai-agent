import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

export const deleteBoardItem = tool({
  description:
    "Delete a single board_item (row) by ID. This is irreversible — confirm with the user before calling unless they have already explicitly asked to delete this specific row. For bulk deletion use a different tool (not yet exposed).",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board"),
    board_item_id: z.string().describe("The ID of the board item to delete"),
  }),
  execute: async ({ board_id, board_item_id }) => {
    try {
      const result: any = await privateApiRequest(
        "DELETE",
        `/api/boards/${board_id}/items/${board_item_id}`,
      );

      return buildResponse(
        "delete_board_item",
        result,
        `Deleted board item ${board_item_id} from board ${board_id}.`,
        ['Use "get_board_items" to confirm the row is gone'],
      );
    } catch (error) {
      logger.error("delete_board_item failed", {
        error,
        board_id,
        board_item_id,
      });
      return buildErrorResponse("delete_board_item", error);
    }
  },
});
