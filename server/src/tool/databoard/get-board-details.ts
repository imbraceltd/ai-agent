import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

export const getBoardDetails = tool({
  description:
    "Get a single board's full schema by ID, including all field definitions (name, type, data, settings, is_default, is_identifier, etc.). Use this to inspect the board schema before creating or updating records.",
  inputSchema: z.object({
    board_id: z.string().describe("The ID of the board to retrieve"),
  }),
  execute: async ({ board_id }) => {
    try {
      const data: any = await privateApiRequest(
        "GET",
        `/api/boards/${board_id}`,
      );

      const fieldCount = Array.isArray(data?.fields) ? data.fields.length : 0;

      return buildResponse(
        "get_board_details",
        data,
        `Retrieved board "${data?.name || board_id}" with ${fieldCount} fields.`,
        [
          'Use "update_board_schema" to modify this board',
          'Use "create_board" to create a new board',
        ],
      );
    } catch (error) {
      logger.error("get_board_details failed", { error, board_id });
      return buildErrorResponse("get_board_details", error);
    }
  },
});
