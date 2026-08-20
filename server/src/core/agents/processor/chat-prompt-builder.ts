/**
 * Chat Prompt Builder
 * Builds the system prompt for the chat agent, including delegation rules
 * and sub-agent context injection.
 * Extracted from chat-processor.ts for modularity.
 */

import { generateAiAsistantsPrompt } from "@/utils/agent";
import { artifactsPrompt } from "@/artifacts/lib/prompts";
import { getModelPrompt } from "@/core/prompts/model-prompt-selector";
import type { ModelFamily } from "@/providers/imbraceModels";
import config from "@/config";
import axios from "axios";
import logger from "@/lib/logger";

/** Lightweight folder info for system prompt injection */
export interface FolderSummary {
  id: string;
  name: string;
  path: string;
}

/**
 * Fetch a lightweight summary of folders (id, name, path) from the data-board API.
 * Used to inject folder context into the system prompt so the AI agent knows
 * which folders are available without needing to call folderContentsTool first.
 * @param folderIds - Root folder IDs from assistant config
 * @returns Array of folder summaries, or empty array on failure
 */
export async function fetchFolderSummary(
  folderIds: string[],
): Promise<FolderSummary[]> {
  function walk(
    entry: { id: string; name: string; path: string; subfolders?: any[] },
    summaries: FolderSummary[],
  ) {
    summaries.push({ id: entry.id, name: entry.name, path: entry.path });
    if (entry.subfolders) {
      for (const sub of entry.subfolders) walk(sub, summaries);
    }
  }

  const baseUrl = config.dataBoard.url;
  if (!baseUrl || folderIds.length === 0) return [];

  try {
    const url = `${baseUrl}/api/folders/subfolders`;
    const response = await axios.post(
      url,
      { ids: folderIds, recursive: true, ignore_assistant: true },
      { headers: { "Content-Type": "application/json" }, timeout: 5000 },
    );

    if (!response.data?.success) return [];

    const folders = response.data.data?.folders || [];
    const summaries: FolderSummary[] = [];

    for (const folder of folders) walk(folder, summaries);
    return summaries;
  } catch (err) {
    logger.warn("Failed to fetch folder summary for prompt injection", {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Build the Board Data Querying section appended to the system prompt when
 * the assistant has one or more `board_ids`. Documents the
 * `get_board_rdf` → `query_board_data` workflow so the agent knows to call
 * the schema endpoint first and how to interpret its `vocabulary` block.
 */
export function buildBoardRdfPromptSection(boardIds: string[]): string {
  const boardList = boardIds.map((id) => `- ${id}`).join("\n");
  return `
# Board Data Querying
You have access to two tools for querying business board data: \`get_board_rdf\` and \`query_board_data\`. Both target a single board id provided in context.

Available board ids:
${boardList}

ALWAYS call \`get_board_rdf\` first whenever the user asks a question about board data (and at least once per session). The schema response is self-describing: it lists every reachable board, every field with its type and options, and a \`vocabulary\` block that documents:
  - \`field_types[<type>].literal\` — the SPARQL literal template to emit when filtering on a value of that type
  - \`query_construction_steps\` — a numbered playbook for turning a user request into SPARQL
  - \`examples\` — pattern templates (filter by value, project multiple fields, traverse parent→child, etc.)

Do NOT invent field names, IDs, or option labels — always pull them from the schema response. Match the user's words against \`boards[].name\`, \`fields[].name\`, and \`options[].label\` (case-insensitive).

When you call \`query_board_data\`, the bare query \`SELECT ?item WHERE { ... }\` returns opaque item IRIs. To get meaningful data either:
  (a) project each field via multiple \`imb:fieldValue\` patterns (see the "several field values" example in the schema), OR
  (b) pass \`hydrate: true\` — the server inlines an \`_items\` map per row with id, board_id, board_name, and labeled field values. Prefer (b) for "show me items matching X" intents.

When the user names a status, category, country, etc., that's almost always a SingleSelection / MultipleSelection filter or a Country field. Read \`options[].label\` for the exact spelling and emit the literal per \`field_types[<type>].literal\`.

Tool-call protocol:
1. First user turn about a board → call \`get_board_rdf(board_id)\`.
2. Read the response. Pin the board ids, field ids, and option labels you'll need.
3. Compose a SPARQL query. Apply \`vocabulary.query_construction_steps\`.
4. If listing items where the user wants field values, prefer \`hydrate: true\` to avoid multi-pattern projection mistakes.
5. If the SPARQL returns \`bindings: []\` but the schema confirmed items exist on the target board, the URL's \`board_id\` likely doesn't reach the target. Re-check the schema and pick the root board.

## Tool routing — what to use when

Use \`get_board_rdf\` + \`query_board_data\` (NOT \`RAGknowledge\`) for any question about board CONTENTS:
  - listing, filtering, counting, or projecting rows / items
  - lookups against structured fields (status, country, category, dates, numbers)
  - traversing TableInTable relationships (parent → child boards)
  - aggregations (totals, averages, group-by)
  - any query phrased in terms of a board's columns or option labels

Use \`RAGknowledge\` ONLY for unstructured document retrieval:
  - searching uploaded PDFs / text in knowledge hubs
  - finding passages from documents the user has attached
  - questions that name a file, document, or knowledge-base topic
  - free-text semantic search across written content (NOT structured board data)

\`RAGknowledge\` accepts an optional \`board_id\` for legacy reasons. When \`board_ids\` is configured on this assistant, DO NOT pass \`board_id\` / \`board_ids\` to \`RAGknowledge\` — route the query to \`query_board_data\` instead.
`;
}

/**
 * Vibe-code skill-discovery rules.
 * Injected when vibe_code is enabled so the agent learns about databoard and
 */
export const VIBE_CODE_SKILL_RULES = `

# Skill Knowledge — Required Before Using Databoard
You have access to two knowledge-guide tools: \`list_skills\` and \`read_skill\`.

**You MUST call these tools at the start of any session that involves databoard operations:**

1. Call \`list_skills\` first to discover all available skill guides.
2. Identify the guides relevant to the task (e.g. \`databoard\`, \`workflow\`).
3. Call \`read_skill\` for each relevant guide to obtain detailed instructions, schemas, and examples.
4. Use the knowledge from those guides when constructing tool calls for \`create_board\`, \`update_board_schema\`, \`apply_flow_operation\`, etc.

**Never skip this step.** The skill guides contain authoritative schemas and constraints that are not repeated in the tool descriptions. Calling the tools without reading the relevant guide first will result in incorrect parameters and failed operations.
`;

/**
 * Data analysis tool orchestration rules.
 * Injected to reinforce tool-driven workflow — each tool's own description
 * carries the detailed instructions; this provides high-level sequencing.
 */
export const DATA_ANALYSIS_WORKFLOW_RULES = `

# Data Analysis Tool Orchestration
Each tool is self-describing — always read its description carefully before calling.
General sequencing for data queries:
1. Discover available files first (if a file discovery tool is present)
2. Query the data using the SQL tool with paths from step 1
3. Visualize with the chart tool only if the user expects a chart — pass rows_json directly
Never skip discovery. Never invent file paths. Never pass SQL to the chart tool.
`;

/**
 * Sub-agent delegation rules appended when the "task" tool is available.
 * Shared between processChatStream and processChat.
 */
export const SUB_AGENT_DELEGATION_RULES = `\n\n# Sub-Agent Delegation Rules
You have specialized sub-agents available via the "task" tool. You MUST use the task tool to delegate work to the appropriate sub-agent when the user's request matches a sub-agent's capability.

## When to Delegate
- The user's request requires specialized knowledge or tools that a sub-agent has
- The task involves multi-step data gathering or processing that a sub-agent is designed for
- The request explicitly mentions a domain covered by a sub-agent

## When NOT to Delegate
- Simple greetings, clarifications, or conversational replies
- Tasks that no sub-agent covers — handle these yourself
- Tasks already fully completed by a previous sub-agent result in this conversation
- Follow-up questions about results you already have from a prior delegation

## Delegation Examples

<example>
User: "Analyze sales data and also check customer feedback"
CORRECT: Call the task tool for the sales analysis agent, wait for the result, then call for the customer feedback agent.
WRONG: Call both agents simultaneously in one step.
WRONG: Answer from your own knowledge without delegating.
</example>

<example>
User: "Thanks, that's helpful!"
CORRECT: Respond directly with acknowledgment. No delegation needed.
WRONG: Delegate to a sub-agent for a simple conversational reply.
</example>

<example>
User: "Can you give me more details on the third item from the previous analysis?"
CORRECT: If you already have the sub-agent's analysis result, answer directly using that context.
CORRECT (alternative): If the previous result lacks detail, re-delegate with task_id to continue the session and ask for elaboration.
WRONG: Re-delegate without task_id, losing the previous conversation context.
</example>

## Execution Rules
- Use the task tool with the correct subagent_type, a short description, and a detailed prompt.
- Always call sub-agents one at a time. Call the task tool once, wait for the result, then call it again if needed. Never call the task tool multiple times in a single step.
- Each task result includes a task_id. Pass this task_id in future task calls to explicitly resume that exact sub-agent session with full conversation history.
- After receiving the sub-agent's result, summarize and present it to the user clearly.

## Interpreting Sub-Agent Results
- If the sub-agent reports status "completed" with high confidence, trust and present the results.
- If the sub-agent reports status "partial" or "needs_retry", consider re-delegating with more specific instructions using the task_id.
- If the sub-agent reports status "failed", acknowledge the issue and try an alternative approach.
- Follow the sub-agent's recommendations when deciding your next action.`;

/**
 * Build the base system prompt for the chat agent.
 * Prepends a model-specific prompt based on the detected model family.
 * @param assistant - Assistant configuration
 * @param modelFamily - The detected model family for provider-specific prompt injection
 * @param folderSummaries - Optional pre-fetched folder summaries for prompt injection
 * @returns Base system prompt with model-specific, file-hint, and final-response rules
 */
export function buildChatAgentPrompt(
  assistant: Record<string, unknown>,
  modelFamily: ModelFamily = "generic",
  folderSummaries?: FolderSummary[],
): string {
  const modelPrompt = getModelPrompt(modelFamily);
  const basePrompt = generateAiAsistantsPrompt(assistant);

  const fileHintRule = `
If a message contains a block between "__ATTACHED_FILES_V1__" and "__END_ATTACHED_FILES_V1__":
- Treat it as the ONLY source of truth for file URLs.
- Never invent any URL.
- When calling workflow tools that expect a URL parameter (e.g. file_url, image_url, url, pdf_url, or any parameter ending in _url):
  - ALWAYS use the "url" value from the attached files block.
  - If the tool expects image_url or file_url, use a file where kind=="image".
  - If the tool expects pdf/file input, use a file where kind=="pdf" or kind=="file".
  - For any other URL parameter, match by the most appropriate file kind.
- If the required kind does not exist, DO NOT call the tool; ask the user to attach the correct file type.
`;

  const finalResponseRule = `
CRITICAL: After completing tool executions, you MUST provide a final text response summarizing the results.
Never end without explaining what was accomplished and presenting findings to the user in a clear format.`;

  // Reason: Inject folder context so the AI agent knows upfront which folders
  // are available and can pass specific folder_ids to RAGknowledge for precise results.
  let folderContext = "";
  if (folderSummaries && folderSummaries.length > 0) {
    const folderList = folderSummaries
      .map((f) => `- "${f.name}" (folder_id: ${f.id}, path: ${f.path})`)
      .join("\n");
    folderContext = `
# Available Knowledge Folders
The following folders contain documents you can search. When using the RAGknowledge tool, pass the relevant folder_ids to get more precise results.
${folderList}

When the user's query clearly relates to a specific folder's topic, pass ONLY that folder's ID to RAGknowledge via the folder_ids parameter. This significantly improves search accuracy.
`;
  }

  // Reason: When the assistant is bound to one or more boards, expose the
  // playbook for `get_board_rdf` + `query_board_data`. The same condition
  // gates tool registration in chat-agent-tools.ts.
  const promptBoardIds = assistant["board_ids"];
  const boardRdfContext =
    Array.isArray(promptBoardIds) && promptBoardIds.length > 0
      ? buildBoardRdfPromptSection(promptBoardIds as string[])
      : "";

  // Inject skill-discovery rules when vibe_code is enabled.
  // Override is read from top-level first, then `metadata` as fallback —
  // the chat-ai backend's PUT /api/assistants/{id} validator strips unknown
  // top-level fields but deep-merges `metadata`, so FE persists overrides
  // through that path. `?? ` so an explicit top-level `null` falls through
  // to metadata (lets a user clear the top-level without orphaning metadata).
  // String value (incl. empty "") wins; null/undefined ⇒ hardcoded default.
  const promptMetadata = assistant["metadata"] as
    | Record<string, unknown>
    | undefined;
  const vibeCodingMeta = promptMetadata?.["vibe_coding"] as
    | Record<string, unknown>
    | undefined;
  // New nested shape (`metadata.vibe_coding.*`) wins over legacy fields.
  // Falls through to top-level then `metadata.vibe_code*` for back-compat.
  const vibeCoding =
    vibeCodingMeta?.["enabled"] === true ||
    assistant["vibe_code"] === true ||
    promptMetadata?.["vibe_code"] === true;
  const skillRulesOverride =
    vibeCodingMeta?.["skill_rules_override"] ??
    assistant["vibe_code_skill_rules"] ??
    promptMetadata?.["vibe_code_skill_rules"];
  const vibeCodeRules = vibeCoding
    ? typeof skillRulesOverride === "string"
      ? skillRulesOverride
      : VIBE_CODE_SKILL_RULES
    : "";

  return `${modelPrompt}\n\n${basePrompt}\n${artifactsPrompt}\n${fileHintRule}\n${finalResponseRule}\n${DATA_ANALYSIS_WORKFLOW_RULES}${folderContext}${boardRdfContext}${vibeCodeRules}`;
}

/**
 * Build the final prompt by appending delegation rules and sub-agent context
 * to the base agent prompt. Eliminates duplication between stream and non-stream paths.
 * @param agentPrompt - Base agent prompt from buildChatAgentPrompt
 * @param hasTaskTool - Whether the "task" tool is available
 * @param subAgentSummary - Optional summary of prior sub-agent work
 * @returns Final system prompt ready for the agent
 */
export function buildFinalPrompt(
  agentPrompt: string,
  hasTaskTool: boolean,
  subAgentSummary?: string,
  scopedBoardId?: string,
): string {
  let prompt = agentPrompt;

  if (hasTaskTool) {
    prompt += SUB_AGENT_DELEGATION_RULES;
  }

  if (scopedBoardId) {
    // Reason: Hard scope is enforced in tool wrappers (board_id is hardcoded
    // server-side). This note is just so the model knows which board it's
    // working on and avoids generic "which board?" prompts back to the user.
    prompt += `\n\n# Databoard Scope
You are operating exclusively on databoard \`${scopedBoardId}\`.
- Every databoard tool already targets this board automatically — do not ask the user for a board id.
- You cannot create new boards in this session; \`create_board\` is intentionally unavailable.
- Reference this board with phrases like "the current board" / "this board"; surface the id only when the user asks for it explicitly.`;
  }

  if (subAgentSummary) {
    prompt += `\n\n# Prior Sub-Agent Context
The following summaries describe work previously completed by sub-agents in this conversation.
Each summary includes a status, confidence score, key findings, and recommendations.
- If status is "completed" with high confidence, you can trust and present the results.
- If status is "partial" or "needs_retry", consider re-delegating or asking for more information.
- If status is "failed", acknowledge the failure and try an alternative approach.
- Follow the recommendations when deciding your next action.

${subAgentSummary}`;
  }

  return prompt;
}
