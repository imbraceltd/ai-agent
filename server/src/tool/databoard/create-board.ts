import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import {
  privateApiRequest,
  buildResponse,
  buildErrorResponse,
} from "@/services/databoardPrivateApiService";

const BOARD_FIELD_TYPES = [
  "ShortText",
  "LongText",
  "SingleSelection",
  "MultipleSelection",
  "Number",
  "Time",
  "Date",
  "Datetime",
  "Link",
  "Priority",
  "Assignee",
  "MultipleAssignee",
  "Email",
  "Phone",
  "RichText",
  "Country",
  "Notes",
  "Origin",
  "Attachment",
  "Currency",
  "Checkbox",
  "MapToBoard",
  "TableInTable",
] as const;

const boardFieldSchema = z
  .object({
    name: z
      .string()
      .describe(
        "Field name. MUST be lowercase_with_underscores (e.g. full_name, not 'Full Name').",
      ),
    type: z
      .enum(BOARD_FIELD_TYPES)
      .describe("Type of the field"),
    data: z
      .array(z.object({ value: z.string() }))
      .optional()
      .describe(
        "Options for selection-type fields (SingleSelection, MultipleSelection)",
      ),
    settings: z
      .object({
        time_zone: z.string().optional(),
        enable_timezone: z.boolean().optional(),
        default_country_code: z.string().optional(),
      })
      .passthrough()
      .optional()
      .describe("Additional settings depending on field type"),
    is_default: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether this is a default field"),
    is_identifier: z
      .boolean()
      .optional()
      .default(false)
      .describe("Whether this field is the identifier"),
  })
  .passthrough();

export const createBoard = tool({
  description:
    "Create a new databoard with fields. Field names MUST be lowercase_with_underscores. Board name must be unique (retry with a different name on conflict).",
  inputSchema: z.object({
    board_name: z
      .string()
      .describe("Board name. Must be unique within the organization."),
    board_type: z
      .enum(["KnowledgeHub", "General", "DocumentAI"])
      .describe(
        "Board type: 'General' (regular databoard), 'KnowledgeHub' (RAG-ingested knowledge), or 'DocumentAI' (board backing a Document AI flow).",
      ),
    description: z.string().optional().describe("Board description"),
    board_fields: z
      .array(boardFieldSchema)
      .optional()
      .describe("List of fields associated with the board"),
  }),
  execute: async ({ board_name, board_type, description, board_fields }) => {
    try {
      // Reason: data-board service's createBoardFieldSchema uses camelCase
      // (`isDefault`, `isUniqueIdentifier`) and expects field options under
      // `data: [{ id, value }]`. Translate the agent's snake_case input so
      // boolean flags survive validation (otherwise they default to false).
      const fields = (board_fields ?? []).map((f) => {
        const optionData = Array.isArray(f.data)
          ? f.data.map((opt) => ({
              id: typeof opt.value === "string" ? opt.value : String(opt.value),
              value: typeof opt.value === "string" ? opt.value : String(opt.value),
            }))
          : undefined;
        return {
          name: f.name,
          type: f.type,
          isDefault: f.is_default ?? false,
          isUniqueIdentifier: f.is_identifier ?? false,
          ...(f.settings ? { settings: f.settings } : {}),
          ...(optionData ? { data: optionData } : {}),
        };
      });

      const body = {
        name: board_name,
        description: description || undefined,
        type: board_type || "General",
        hidden: false,
        fields,
      };

      const data: any = await privateApiRequest("POST", "/api/boards", body);

      const boardId = data?._id || data?.id || "unknown";
      const fieldCount = Array.isArray(board_fields) ? board_fields.length : 0;

      return buildResponse(
        "create_board",
        data,
        `Created board "${board_name}" (${boardId}) with ${fieldCount} fields.`,
        [
          'Use "get_board_details" to verify the board was created correctly',
          'Use "update_board_schema" to add or modify fields',
        ],
      );
    } catch (error) {
      logger.error("create_board failed", { error });
      return buildErrorResponse("create_board", error);
    }
  },
});
