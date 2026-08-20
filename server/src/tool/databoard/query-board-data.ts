/**
 * query_board_data native tool.
 *
 * Proxies `POST /api/boards/:boardId/sparql` on the data-board service —
 * read-only SPARQL 1.1 over the in-memory RDF graph that materializes the
 * board plus its TableInTable closure. `hydrate=true` inlines an `_items`
 * map per SELECT row so a bare `SELECT ?item WHERE { ... }` already returns
 * meaningful data without chaining `imb:fieldValue` projections.
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
  "Run a read-only SPARQL 1.1 SELECT/ASK/CONSTRUCT query against the user's board RDF view. Call `get_board_rdf` FIRST — you need its `vocabulary` block to construct correct literals. (1) Resolve nouns to a board by `boards[].name`. (2) Emit `?item imb:fieldValue [ imb:field <field-IRI> ; imb:value <literal> ]` per filter, building <literal> from `vocabulary.field_types[<field.type>].literal`. (3) For SingleSelection / MultipleSelection filters use the option label from `options[].label`. (4) Always scope: `?item imb:belongsToBoard <board-IRI>`. Field values are auto-resolved into an `_items` map on each SELECT row when `hydrate: true` — so a bare `SELECT ?item WHERE { ... }` returns full item data, you don't need to chain `imb:fieldValue` projections unless you specifically want certain columns.";

export function buildQueryBoardData(allowedBoardIds: string[]) {
  const allowed = new Set(allowedBoardIds);

  return tool({
    description: DESCRIPTION,
    inputSchema: z.object({
      board_id: z
        .string()
        .describe(
          "UUID of the root board. The SPARQL graph includes this board plus every child board reachable via TableInTable — the same closure as `get_board_rdf`.",
        ),
      query: z
        .string()
        .min(1)
        .max(16384)
        .describe(
          'SPARQL 1.1. Example for "list pending orders":\nPREFIX imb: <urn:imbrace:vocab#>\nSELECT ?item WHERE {\n  ?item imb:belongsToBoard <urn:imbrace:board:ORDERS_ID> ;\n        imb:fieldValue [ imb:field <urn:imbrace:field:ORDERS_ID/STATUS_ID> ; imb:value "Pending" ] .\n}',
        ),
      hydrate: z
        .boolean()
        .optional()
        .describe(
          "When true, each SELECT row gains an `_items` map: for every binding whose value is an `urn:imbrace:item:…` IRI, the server attaches { id, board_id, board_name, fields: {<fieldId>: {name, type, value}} }. Use this when the user wants item details — it lets you write a simple `SELECT ?item WHERE { ... }` and still return meaningful data.",
        ),
    }),
    execute: async ({ board_id, query, hydrate }) => {
      if (!allowed.has(board_id)) {
        return buildErrorResponse(
          "query_board_data",
          new Error(
            `board_id "${board_id}" is not in the assistant's allowed boards (${allowedBoardIds.join(", ") || "<none>"}).`,
          ),
        );
      }

      try {
        const data: unknown = await privateApiRequest(
          "POST",
          `/api/boards/${board_id}/sparql`,
          { query },
          { hydrate: hydrate ? "true" : undefined },
        );

        return buildResponse(
          "query_board_data",
          data,
          `SPARQL query executed against board ${board_id}.`,
          [
            "If bindings are empty but the schema shows items exist, re-check the field IRIs and option labels from `get_board_rdf`",
            "Pass `hydrate: true` to get full item objects in each row instead of opaque IRIs",
          ],
        );
      } catch (error) {
        logger.error("query_board_data failed", { error, board_id });
        return buildErrorResponse("query_board_data", error);
      }
    },
  });
}
