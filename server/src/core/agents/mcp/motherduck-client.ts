import logger from "@/lib/logger";
import config from "@/config";
import { BaseMCPClient } from "./base-client";
import { MCPClientConfig } from "./types";

interface DatabaseQueryParams {
  query: string;
  description?: string;
}

interface DatabaseQueryResult {
  success: boolean;
  data?: any;
  error?: string;
  executedAt: string;
  toolName?: string;
}

const MOTHERDUCK_CONFIG: MCPClientConfig = {
  command: "uvx",
  args: ["mcp-server-motherduck", "--db-path", ":memory:"],
  name: "motherduck-mcp-client",
  version: "1.0.0",
};

export class MotherDuckMCPClient extends BaseMCPClient {
  private static instance: MotherDuckMCPClient | null = null;

  private constructor() {
    super(MOTHERDUCK_CONFIG);
  }

  static getInstance(): MotherDuckMCPClient {
    if (!MotherDuckMCPClient.instance) {
      MotherDuckMCPClient.instance = new MotherDuckMCPClient();
    }
    return MotherDuckMCPClient.instance;
  }

  async executeQuery(
    params: DatabaseQueryParams
  ): Promise<DatabaseQueryResult> {
    const { query, description } = params;
    const executedAt = new Date().toISOString();

    try {
      logger.info(`Executing MotherDuck query: ${query}`);
      const client = await this.ensureConnected();
      // Get available tools from the MCP server
      const tools = await client.listTools();

        // Find the SQL execution tool (usually named something like "sql" or "query")
      const sqlTool = tools.tools.find(
        (tool: any) =>
          tool.name.toLowerCase().includes("sql") ||
          tool.name.toLowerCase().includes("query") ||
          tool.name.toLowerCase().includes("execute")
      );

        // Execute the SQL query
      const queryResult = await client.callTool({
        name: sqlTool.name,
        arguments: {
          query: query,
        },
      });

      return queryResult;
    } catch (error) {
      logger.error("Error executing MotherDuck query:", error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        executedAt,
      };
    }
  }

  async listAvailableTools(): Promise<any[]> {
    try {
      const client = await this.ensureConnected();
      const tools = await client.listTools();
      return tools.tools || [];
    } catch (error) {
      logger.error("Error listing MotherDuck MCP tools:", error);
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const tools = await this.listAvailableTools();
      logger.info(
        `MotherDuck MCP Health Check - Found ${tools.length} tools:`,
        tools.map((t) => t.name)
      );
      return tools.length > 0;
    } catch (error) {
      logger.error("MotherDuck MCP Health Check failed:", error);
      return false;
    }
  }

  static async cleanup(): Promise<void> {
    if (MotherDuckMCPClient.instance) {
      await MotherDuckMCPClient.instance.disconnect();
      MotherDuckMCPClient.instance = null;
    }
  }
}
