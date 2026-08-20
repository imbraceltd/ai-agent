import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import { getToolContext } from "@/core/agents/tool/toolContext";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const selectBoardSummary = (board: any) => ({
  _id: board._id,
  doc_name: board.doc_name,
  organization_id: board.organization_id,
  name: board.name,
  description: board.description,
  type: board.type,
});

const normalizeBoardList = (data: any) => {
  const boards = Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
      ? data
      : [];
  return boards.map(selectBoardSummary);
};

export const getBoard = tool({
  description:
    'List all boards with optional filters. Filters: hidden, is_default, types (General, System, KnowledgeHub). Use "get_board_details" to retrieve a single board\'s full schema including fields.',
  inputSchema: z.object({
    hidden: z
      .enum(["true", "false"])
      .optional()
      .describe("Filter boards by hidden status"),
    is_default: z
      .enum(["true", "false"])
      .optional()
      .describe("Filter by default board status"),
    types: z
      .array(z.enum(["General", "System", "KnowledgeHub"]))
      .optional()
      .describe("Filter by board types"),
  }),
  execute: async ({ hidden, is_default, types }) => {
    try {
      const ctx = getToolContext();
      const headers: Record<string, string> = {};
      if (ctx.organization_id) {
        headers["x-organization-id"] = ctx.organization_id;
      }

      const queryParams: Record<string, string> = {};
      if (hidden !== undefined) queryParams["hidden"] = hidden;
      if (is_default !== undefined) queryParams["is_default"] = is_default;

      // Reason: data-board service's boardFiltersSchema accepts `types` as
      // a comma-separated list (coerceToArray) — different from the legacy
      // `types[]=...` array-bracket convention.
      if (Array.isArray(types) && types.length > 0) {
        queryParams["types"] = types.join(",");
      }

      const data: any = await privateApiRequest(
        "GET",
        "/api/boards",
        undefined,
        queryParams,
        headers,
      );
      const boardList = normalizeBoardList(data);

      return buildResponse(
        "get_board",
        boardList,
        `Retrieved ${boardList.length} boards.`,
        [
          'Use "get_board_details" with a board_id to see full field schema',
          'Use "create_board" to create a new board',
        ],
      );
    } catch (error) {
      logger.error("get_board failed", { error });
      return buildErrorResponse("get_board", error);
    }
  },
});
