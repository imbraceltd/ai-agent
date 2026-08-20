import config from "@/config";
import logger from "@/lib/logger";

/**
 * Response interface for hybrid search API
 */
export interface HybridSearchResponse {
  success: boolean;
  data?: HybridSearchResult[];
  error?: string;
  folder_info?: any;
  timestamp: string;
}

/**
 * Individual search result from the hybrid search API
 */
export interface HybridSearchResult {
  content: string;
  score?: number;
  metadata?: {
    file_id?: string;
    file_name?: string;
    source?: string;
    [key: string]: any;
  };
}

/**
 * Input parameters for hybrid search
 */
export interface HybridSearchInput {
  vector_search_query: string;
  full_text_search_query: string;
  assistant_id: string;
  file_ids?: string[];
  knowledge_hubs?: string[];
  board_ids?: string[];
  folder_ids?: string[];
  x_api_key?: string;
  x_organization_id: string;
}

/**
 * Call the hybrid search API endpoint
 * @param params - Search parameters
 * @returns Promise<HybridSearchResponse>
 */
export async function callHybridSearchAPI(
  params: HybridSearchInput,
): Promise<HybridSearchResponse> {
  const timestamp = new Date().toISOString();

  try {
    // Construct the API URL from config or use default
    const apiUrl = config.aiv2Internal.url;
    const url = `${apiUrl}/api/v1/rag/hybrid_search`;

    logger.info(`Calling hybrid search API: ${url}`);

    // Prepare request body
    const requestBody = {
      vector_search_query: params.vector_search_query,
      full_text_search_query: params.full_text_search_query,
      assistant_id: params.assistant_id,
      file_ids: params.file_ids || [],
      knowledge_hubs: params.knowledge_hubs || [],
      board_ids: params.board_ids || [],
      folder_ids: params.folder_ids || [],
    };

    // Prepare headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-organization-id": params.x_organization_id,
    };

    logger.debug("Hybrid search request:", {
      url,
      body: requestBody,
      headers,
    });

    // Make the API call
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const errorMessage = `Hybrid search API failed: ${response.status} - ${response.statusText}. ${errorText}`;
      logger.error(errorMessage);
      return {
        success: false,
        error: errorMessage,
        timestamp,
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();
    logger.info("Hybrid search API returned successfully", {
      data,
    });

    // Parse and format the response
    // The API returns { data: { context: string, sources: array } }
    let results: HybridSearchResult[] = [];

    if (Array.isArray(data?.results)) {
      // Handle results array format
      results = data.results.map((item: any) => ({
        content: item.content || item.text || item.pageContent || "",
        score: item.score || item.combined_score,
        metadata: item.metadata || {},
      }));
    } else if (data?.data?.context && data?.data?.sources) {
      // Handle context + sources format
      results = [
        {
          content: data.data.context,
          metadata: {
            sources: data.data.sources,
          },
        },
      ];
    } else if (data?.context) {
      // Handle direct context format
      const metadata: HybridSearchResult["metadata"] = {};
      if (data.sources) {
        metadata["sources"] = data.sources;
      }
      results = [
        {
          content: data.context,
          metadata,
        },
      ];
    }

    return {
      success: true,
      data: results,
      folder_info: data?.folder_info
        ? data.folder_info
        : data?.data?.folder_info,
      timestamp,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Error calling hybrid search API:", error);

    return {
      success: false,
      error: errorMessage,
      timestamp,
    };
  }
}

/**
 * Format search results for AI consumption
 * @param results - Array of search results
 * @returns Formatted string for AI
 */
export function formatSearchResultsForAI(
  results: HybridSearchResult[],
): string {
  if (!results || results.length === 0) {
    return "No relevant documents found in the knowledge base.";
  }

  // Format both sources and context
  let output = "";

  results.forEach((result, index) => {
    // Add sources information
    if (
      result.metadata?.["sources"] &&
      Array.isArray(result.metadata["sources"])
    ) {
      const sources = result.metadata["sources"] as any[];
      if (sources.length > 0) {
        output += `\n📁 Sources:\n`;
        sources.forEach((source: any) => {
          const fileName =
            source.fileName || source.file_name || "Unknown file";
          output += `- ${fileName}`;
          if (source._id) output += ` (ID: ${source._id})`;
          if (source.url) output += `\n  URL: ${source.url}`;
          output += `\n`;
        });
      }
    } else if (result.metadata?.file_name || result.metadata?.source) {
      output += `\n📁 Source: ${result.metadata.file_name || result.metadata.source}\n`;
    }

    // Add context content
    if (result.content && result.content.trim().length > 0) {
      output += `\n📄 Context:\n${result.content}\n`;
    }

    // Add separator between results if multiple
    if (results.length > 1 && index < results.length - 1) {
      output += `\n${"=".repeat(80)}\n`;
    }
  });

  return output.trim();
}
