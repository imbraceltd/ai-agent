import { stepCountIs, tool } from "ai";
import { generateText } from "ai";
import z from "zod/v4";
import { MotherDuckMCPClient } from "../mcp";
import logger from "@/lib/logger";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import config from "@/config";
import {
  getCategorizedBoardData,
  DataSource,
} from "../services/getBoardDetails";
import { getAccessToken, getStructuredBoardId } from "./toolContext";
import fs from "fs";
import path from "path";

const DESCRIPTION_TOOL = fs.readFileSync(
  path.join(__dirname, "productDataMotherDuck.txt"),
  "utf-8",
);

// Simple interfaces
export interface QueryResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
  citations?: DataSource[]; // Add citation information
}

// Configuration
const MODEL_ID = "openai.gpt-oss-120b-1:0";
const bedrock = createAmazonBedrock({
  region: config.aws.region_ai,
  accessKeyId: config.aws.accessKeyId,
  secretAccessKey: config.aws.secretAccessKey,
});

// Data Analyst DuckDB tool for product analysis
const productDuckDBTool = {
  description: DESCRIPTION_TOOL,
  inputSchema: z.object({
    query: z
      .string()
      .describe(
        "SQL query to execute - can be exploratory (DESCRIBE, SHOW) or analytical (SELECT, etc.)",
      ),
  }),
  execute: async ({ query }: { query: string }) => {
    const client = MotherDuckMCPClient.getInstance();
    const res = await client.executeQuery({
      query,
      description: "Product data analyst query for exploration or analysis",
    });

    if (res.data) {
      return {
        success: true,
        data: res.data,
      };
    } else {
      return {
        success: false,
        error: res.error || "Unknown error from DuckDB query",
      };
    }
  },
};

// Function to generate product-focused dynamic prompts
function generateProductDynamicPrompt(dataSources: DataSource[]): string {
  // Limit to top 2 sources and truncate summaries
  const sourcesList = dataSources
    .map(
      (source) => `
      ${source.category}: ${source.name}
      URL: '${source.embeddingUrl}'
      Summary: ${source.summary}
      ${source.schema ? `Schema: ${source.schema}` : ""}`,
    )
    .join("\n");

  return `Financial Product Analyst. Find suitable products using DuckDB queries.

DATA SOURCES:
${sourcesList}

## ANALYSIS FOCUS:
- **Use Provided Customer Context**: Extract and use customer data passed
- **Product Suitability**: Match products to the customer profile information provided
- **Personalized Recommendations**: Tailored product suggestions with clear reasoning

## QUERY GUIDELINES:
1. Always use provided parquet URL above when generating duckdb command.
   Example: 
     - DESCRIBE '[example.parquet]'
     - SELECT * FROM '[example.parquet]' order by [column_name] 
2. Use DESCRIBE command only once for optimization. If user provides filter, choose the best column to match.
3. Always use DESCRIBE to understand the data schema before generating the query.
4. You can read the statistics from the above DATA SOURCES Schema to understand the data columns.
5. Ensure the query is focused on the user request and syntactically correct.
6. When customer context is provided, filter products based on risk tolerance and preferences.

## OUTPUT REQUIREMENTS:
- Explain WHY each product is suitable for the specific customer based on the provided context
- Reference the customer profile data and transcript insights provided in the request
- Show how products align with customer's stated preferences or needs from the provided context`;
}

// Product Data MotherDuck execution function
async function executeProductQuery(userRequest: string): Promise<QueryResult> {
  const timestamp = new Date().toISOString();

  try {
    // Use provided boardId or get from context (structured board for product data)
    const effectiveBoardId = getStructuredBoardId();
    const accessToken = getAccessToken();

    logger.info(
      `Processing product analysis request: ${userRequest}${
        effectiveBoardId ? ` for board: ${effectiveBoardId}` : ""
      }`,
    );

    // Get categorized board data with optional board_id and access token
    const boardData = await getCategorizedBoardData(
      effectiveBoardId,
      accessToken,
    );

    const productSources = boardData.products;

    if (productSources.length === 0) {
      throw new Error("No product data sources available");
    }

    logger.info(`Found ${productSources.length} product data sources`);

    // Generate dynamic prompt with product data sources only
    const systemPrompt = generateProductDynamicPrompt(productSources);

    const result = await generateText({
      model: bedrock(MODEL_ID),
      system: systemPrompt,
      messages: [{ role: "user", content: userRequest }],
      tools: {
        execute_duckdb_query: productDuckDBTool,
      },
      stopWhen: stepCountIs(5),
      temperature: 0.1,
    });

    return {
      success: true,
      data: result.text,
      timestamp,
      // citations: productSources,
    };
  } catch (error) {
    logger.error("Product query error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp,
    };
  }
}

// Product Data MotherDuck Tool - Analyzes and recommends financial products
export const ProductDataMotherDuck = tool({
  description:
    "Analyze financial products and provide product recommendations using dynamic data sources from getBoardDetails(). Focuses specifically on product analysis, product recommendations, and suitability matching.",
  inputSchema: z.object({
    request: z
      .string()
      .describe(
        "Product analysis request - can include customer and conversation summary context for personalized recommendations",
      ),
  }),
  execute: async ({ request }) => {
    try {
      logger.info(
        `ProductData MotherDuck tool called: ${request.substring(0, 100)}...`,
      );

      const result = await executeProductQuery(request);

      if (result.success) {
        logger.info(`ProductData MotherDuck analysis completed successfully`);
        return {
          status: "success",
          result: result.data,
          analysisType: "product_recommendations",
          timestamp: result.timestamp,
          citations: result.citations,
        };
      } else {
        logger.error(`ProductData MotherDuck analysis failed: ${result.error}`);
        return {
          status: "error",
          error: result.error,
          timestamp: result.timestamp,
        };
      }
    } catch (error) {
      logger.error("ProductData MotherDuck tool execution error:", error);
      return {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Unknown error in ProductData MotherDuck tool",
        timestamp: new Date().toISOString(),
      };
    }
  },
});

// Export for use in other modules
export { executeProductQuery };

// Cleanup function
export const cleanup = () => MotherDuckMCPClient.cleanup();
