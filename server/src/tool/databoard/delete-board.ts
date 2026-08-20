import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

export const deleteBoard = tool({
  description: "Delete a board by ID. This action is irreversible.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board to delete"),
  }),
  execute: async ({ board_id }) => {
    try {
      const data = await privateApiRequest(
        "DELETE",
        `/api/boards/${board_id}`,
      );
      return buildResponse(
        "delete_board",
        data,
        `Deleted board ${board_id}.`,
        [],
      );
    } catch (error) {
      logger.error("delete_board failed", { error, board_id });
      return buildErrorResponse("delete_board", error);
    }
  },
});
