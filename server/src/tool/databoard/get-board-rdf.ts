/**
 * get_board_rdf native tool.
 *
 * Proxies `GET /api/boards/:boardId/rdf-schema` on the data-board service —
 * a self-describing schema with a `vocabulary` block that documents how to
 * build SPARQL literals per field type and includes pattern examples. The
 * assistant must call this BEFORE composing any SPARQL via `query_board_data`.
 */

import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const DESCRIPTION =
  "Discover the structure of a board and every board reachable from it via TableInTable. ALWAYS call this BEFORE writing a SPARQL query — without it you'll be guessing at field ids and option labels. Returns: { rootBoardId, boards: [{ id, name, itemCount, fields: [{ id, name, type, options?, is_default?, is_unique_identifier?, childBoard? }] }], vocabulary: { prefix, iri_shapes, predicates, field_types, query_construction_steps, examples }, meta }. The `vocabulary.query_construction_steps` and `vocabulary.examples` are the playbook for the next call to `query_board_data`.";

/**
 * Build the `get_board_rdf` tool with an allow-list closure of board ids.
 *
 * @param allowedBoardIds - Boards bound to the current assistant; any
 *   `board_id` outside this list is rejected at execute-time to prevent
 *   the model from probing schemas it shouldn't see.
 */
export function buildGetBoardRdf(allowedBoardIds: string[]) {
  const allowed = new Set(allowedBoardIds);

  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      board_id: z.string().describe("uuid-format board id"),
    }),
    execute: async ({ board_id }) => {
      if (!allowed.has(board_id)) {
        return buildErrorResponse(
          "get_board_rdf",
          new Error(
            `board_id "${board_id}" is not in the assistant's allowed boards (${allowedBoardIds.join(", ") || "<none>"}).`,
          ),
        );
      }

      try {
        const data: unknown = await privateApiRequest(
          "GET",
          `/api/boards/${board_id}/rdf-schema`,
        );

        return buildResponse(
          "get_board_rdf",
          data,
          `Retrieved RDF schema for board ${board_id}.`,
          [
            'Compose SPARQL using `vocabulary.field_types[<type>].literal` and call "query_board_data"',
            "For listing items, prefer `hydrate: true` so each binding is enriched with full field values",
          ],
        );
      } catch (error) {
        logger.error("get_board_rdf failed", { error, board_id });
        return buildErrorResponse("get_board_rdf", error);
      }
    },
  });
}
