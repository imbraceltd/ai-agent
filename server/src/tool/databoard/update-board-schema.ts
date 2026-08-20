import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const boardFieldSchema = z
  .object({
    name: z.string().describe("Field name (lowercase_with_underscores)"),
    type: z
      .string()
      .describe(
        "Field type (e.g., ShortText, Number, SingleSelection, TableInTable)",
      ),
    data: z
      .array(z.object({ value: z.string().optional() }).passthrough())
      .optional()
      .describe("Options for selection fields"),
    fields: z
      .array(
        z
          .object({
            name: z.string(),
            type: z.string(),
            is_identifier: z.boolean().optional(),
          })
          .passthrough(),
      )
      .optional()
      .describe("Nested fields (for TableInTable)"),
    field_id: z
      .string()
      .optional()
      .describe("Existing field ID (required for updates)"),
    description: z.string().optional().describe("Field description"),
    is_identifier: z
      .boolean()
      .optional()
      .describe("Whether this field is an identifier"),
  })
  .passthrough();

export const updateBoardSchema = tool({
  description:
    "Update board schema. Add new fields or update existing fields on a board (PATCH /api/boards/:id/fields/bulk). Entries with no field_id are new fields; entries with field_id update the named field.",
  inputSchema: z.object({
    board_id: z.string().describe("ID of the board"),
    board_fields: z
      .array(boardFieldSchema)
      .describe(
        "JSON array of field definitions to add or update (see tool description for schema)",
      ),
  }),
  execute: async ({ board_id, board_fields }) => {
    try {
      // Reason: data-board service's bulkFieldSchema uses `is_unique_identifier`,
      // not `is_identifier`. Map so the boolean survives Zod parsing.
      const fields = board_fields.map((f: any) => {
        const { is_identifier, ...rest } = f;
        return is_identifier !== undefined
          ? { ...rest, is_unique_identifier: is_identifier }
          : rest;
      });

      const data = await privateApiRequest(
        "PATCH",
        `/api/boards/${board_id}/fields/bulk`,
        { fields },
      );

      const newCount = board_fields.filter((f: any) => !f.field_id).length;
      const updateCount = board_fields.filter((f: any) => f.field_id).length;
      const parts: string[] = [];
      if (newCount > 0) parts.push(`${newCount} new`);
      if (updateCount > 0) parts.push(`${updateCount} updated`);

      return buildResponse(
        "update_board_schema",
        data,
        `Updated board ${board_id} fields (${parts.join(", ") || "no changes"}).`,
        ['Use "get_board_details" to verify the changes'],
      );
    } catch (error) {
      logger.error("update_board_schema failed", { error, board_id });
      return buildErrorResponse("update_board_schema", error);
    }
  },
});
