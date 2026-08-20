import { tool } from "ai";
import z from "zod/v4";
import logger from "@/lib/logger";
import { getToolContext } from "../core/agents/tool/toolContext";
import {
  callHybridSearchAPI,
  formatSearchResultsForAI,
} from "@/services/hybridSearchAPI";
import { fetchSubfolders } from "@/services/folderService";

/**
 * RAG Tool - Advanced RAG tool using external API
 *
 * This tool performs RAG search combining vector (semantic) and full-text search
 * through an external API endpoint. It's different from retrieverTool as it uses
 * an external service rather than direct database access.
 */
export const ragTool = tool({
  description: `Advanced knowledge retrieval tool that performs RAG search (vector + full-text) via external API.
                Use this tool when you need to:
                - Search through documents with high precision using both semantic and keyword matching
                - Find information from specific files or knowledge hubs
                - Retrieve or summarize context from the documents uploaded in the knowledge hub

                Required parameters:
                - tool_title: A user-friendly title for the search query, explaining what you are asking in a concise way
                - vector_search_query: A natural, conversational question that captures the semantic intent
                - full_text_search_query: A concise, keyword-focused query with the most important terms

                Optional parameters:
                - assistant_id: ONLY provide this if user explicitly mentions an assistant ID in their query (e.g., "get document from assistant id abc123"). Do NOT provide if not mentioned.
                - board_id: ONLY provide this if user explicitly mentions a board ID in their query (e.g., "from board id xyz789"). Do NOT provide if not mentioned.
                - file_ids: Limit search to specific file IDs
                - knowledge_hubs: Search within specific knowledge hub collections
                - folder_ids: Restrict search to specific folders that are closely related to the user's query.

                IMPORTANT:
                - Do NOT call this tool multiple times with the same or very similar queries. If you already searched for something, use the results you received.
                - If the first search did not return the data you need, try a DIFFERENT query with different keywords, or conclude that the information is not available in the knowledge base.
                - If the tool returns a deduplication warning, you MUST stop repeating this search and either try a completely different approach or work with what you have.
                - Notes: Please always use this tool for any document search queries, even if the user doesn't explicitly ask for it. The tool will determine the best way to search based on the input queries and available context.
                - To return the most relevant results, please set the folder_ids parameter when you have a strong indication of which folders are relevant to the user's query. This helps the tool focus the search and improve result quality.

                BEST PRACTICE FOR FOLDER SEARCH:
                1. Call folderContentsTool first to see available folders and their contents
                2. Identify which folder(s) are most relevant to the user's query
                3. Pass those specific folder_ids to this tool for precise results
                4. Only omit folder_ids if you're unsure which folder is relevant
                `,

  inputSchema: z.object({
    tool_title: z
      .string()
      .describe("User-facing title explaining what you are asking"),
    vector_search_query: z
      .string()
      .describe("Natural language query for semantic (vector-based) search"),
    full_text_search_query: z
      .string()
      .describe("Short, keyword-focused query for full-text search"),
    folder_ids: z
      .array(z.string())
      .optional()
      .describe(
        "Optional: Specific folder IDs to restrict the search. Use folderContentsTool first to discover folders, then pass only the relevant folder IDs here. Omit to search all configured folders.",
      ),
    file_ids: z
      .array(z.string())
      .optional()
      .describe(
        "Optional: Specific file IDs to restrict search to particular documents. Get these from folderContentsTool's document_file_ids or individual file.file_id values.",
      ),
  }),

  execute: async ({
    vector_search_query,
    full_text_search_query,
    tool_title,
    folder_ids: inputFolderIds,
    file_ids: inputFileIds,
  }) => {
    try {
      logger.info(
        `Hybrid search tool called with queries: vector="${vector_search_query.substring(0, 50)}...", fulltext="${full_text_search_query}", tool_title="${tool_title}"`,
      );

      // Get tool context
      const toolContext = getToolContext();
      const finalAssistantId = toolContext.assistant_id || "";
      const organizationId = toolContext.organization_id || "org_imbrace";

      // Build search params object, only including defined optional properties
      // This is required for exactOptionalPropertyTypes: true
      const searchParams: Parameters<typeof callHybridSearchAPI>[0] = {
        vector_search_query,
        full_text_search_query,
        assistant_id: finalAssistantId,
        x_organization_id: organizationId,
      };
      if (inputFileIds && inputFileIds.length > 0) {
        // Reason: Agent explicitly selected files from folderContentsTool — use those
        searchParams.file_ids = inputFileIds;
      } else if (toolContext.assistantData?.file_ids !== undefined) {
        searchParams.file_ids = toolContext.assistantData?.file_ids;
      }

      if (toolContext.assistantData?.knowledge_hubs !== undefined) {
        searchParams.knowledge_hubs = toolContext.assistantData.knowledge_hubs;
      }
      if (toolContext.assistantData?.board_ids !== undefined) {
        searchParams.board_ids = toolContext.assistantData.board_ids;
      }
      // Determine folder_ids: prefer agent-selected, fallback to assistant config
      const assistantFolderIds = toolContext.assistantData?.folder_ids as
        | string[]
        | undefined;

      if (inputFolderIds && inputFolderIds.length > 0) {
        // Reason: Agent explicitly chose folders — validate they're in assistant's config
        if (assistantFolderIds && assistantFolderIds.length > 0) {
          const validIds = inputFolderIds.filter((id) =>
            assistantFolderIds.includes(id),
          );
          searchParams.folder_ids =
            validIds.length > 0 ? validIds : assistantFolderIds;
        } else {
          searchParams.folder_ids = inputFolderIds;
        }
        logger.info(
          `RAG: agent-selected ${searchParams.folder_ids.length} folder(s)`,
        );
      } else if (assistantFolderIds !== undefined) {
        searchParams.folder_ids = assistantFolderIds;
      }

      if (searchParams.folder_ids?.length) {
        try {
          const { files, allFolderIds } = await fetchSubfolders(
            searchParams.folder_ids,
          );
          // Reason: RAG chunks are tagged with leaf folder_id only; expand so
          // parent folder selections match chunks stored under nested subfolders.
          if (allFolderIds.length) {
            searchParams.folder_ids = Array.from(new Set(allFolderIds));
          }
          if (
            (!searchParams.file_ids || searchParams.file_ids.length === 0) &&
            files.length
          ) {
            searchParams.file_ids = files
              .map((f) => f.file_id)
              .filter(Boolean);
          }
          logger.info(
            `RAG: expanded to ${searchParams.folder_ids.length} folder(s), ${searchParams.file_ids?.length ?? 0} file(s)`,
          );
        } catch (err) {
          logger.warn("RAG: folder expansion failed, using original folder_ids", {
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const topKResults = toolContext.assistantData?.metadata
        ?.top_k_relevant_results as number | undefined;
      if (topKResults !== undefined && topKResults > 0) {
        // Reason: top_k_relevant_results is passed through to the API but
        // not part of the typed HybridSearchInput interface
        (searchParams as any).top_k_relevant_results = topKResults;
      }

      // Call the hybrid search API
      const searchResponse = await callHybridSearchAPI(searchParams);

      if (!searchResponse.success) {
        logger.error(`Hybrid search failed: ${searchResponse.error}`);
        return {
          status: "error",
          error: searchResponse.error || "Failed to retrieve search results",
          timestamp: searchResponse.timestamp,
          _guidance:
            "The search failed. Do NOT retry with the same query. Try a different approach: use different keywords, broaden or narrow the search scope, or inform the user that this information could not be retrieved.",
        };
      }

      // Format results for AI
      const formattedResults = formatSearchResultsForAI(
        searchResponse.data || [],
      );

      const resultCount = searchResponse.data?.length || 0;
      logger.info(
        `Hybrid search completed successfully. Found ${resultCount} results.`,
      );

      return {
        status: "success" as const,
        result: formattedResults,
        folder_info: searchResponse?.folder_info
          ? JSON.stringify(searchResponse.folder_info)
          : undefined,
        metadata: {
          result_count: resultCount,
          timestamp: searchResponse.timestamp,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      logger.error("Hybrid search tool execution error:", error);

      return {
        status: "error",
        error: errorMessage,
        timestamp: new Date().toISOString(),
        _guidance:
          "The search encountered an error. Do NOT retry with the same query. Try a different approach or inform the user.",
      };
    }
  },
});

// Export for use in other modules
export default ragTool;
