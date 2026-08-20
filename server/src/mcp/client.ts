/**
 * Simple MCP Client using @modelcontextprotocol/sdk
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import logger from "@/lib/logger";
import { MCPServerConfig } from "./types";

export class MCPClient {
  private client: Client;
  private transport: StdioClientTransport | SSEClientTransport | null = null;
  private config: MCPServerConfig;
  private isConnected: boolean = false;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.client = new Client(
      {
        name: `mcp-client-${config.name}`,
        version: "1.0.0",
      },
      {
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
        },
      }
    );
  }

  /**
   * Connect to MCP server
   */
  async connect(): Promise<void> {
    try {
      logger.info("Connecting to MCP server", {
        name: this.config.name,
        transport: this.config.transport,
      });

      if (this.config.transport === "stdio") {
        this.transport = new StdioClientTransport({
          command: this.config.command!,
          args: this.config.args || [],
          env: { ...process.env, ...this.config.env } as Record<string, string>,
        });
      } else {
        this.transport = new SSEClientTransport(new URL(this.config.url!));
      }

      await this.client.connect(this.transport);
      this.isConnected = true;
      logger.info("Connected to MCP server", { name: this.config.name });
    } catch (error) {
      logger.error("Failed to connect to MCP server", {
        name: this.config.name,
        error,
      });
      throw error;
    }
  }

  /**
   * Get AI SDK compatible tools
   * Converts MCP tools to AI SDK format
   */
  async getTools(): Promise<Record<string, any>> {
    if (!this.isConnected) throw new Error("Client not connected");
    
    const response = await this.client.listTools();
    const tools: Record<string, any> = {};

    for (const mcpTool of response.tools) {
      tools[mcpTool.name] = {
        description: mcpTool.description,
        parameters: mcpTool.inputSchema,
        execute: async (args: any) => {
          const result = await this.client.callTool({
            name: mcpTool.name,
            arguments: args,
          });
          // Return raw MCP result with content array and metadata
          // This allows wrapper functions to access full MCP response
          return result;
        },
      };
    }

    return tools;
  }

  /**
   * Disconnect
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.isConnected = false;
      logger.info("Disconnected from MCP server", { name: this.config.name });
    }
  }

  isServerConnected(): boolean {
    return this.isConnected;
  }

  getName(): string {
    return this.config.name;
  }
}
