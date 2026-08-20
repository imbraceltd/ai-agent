import { experimental_createMCPClient } from "@ai-sdk/mcp";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";

export interface MCPToolSpec {
  name: string;
  description: string;
  parameters: any;
}

export interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export class MCPClient {
  private mcp: Client;
  private transport: StreamableHTTPClientTransport | null = null;

  constructor() {
    this.mcp = new Client({ name: "mcp-client-cli", version: "1.0.0" });
  }

  /**
   * Connect and initialize the MCP session
   */
  async connect(url: string, headers: Record<string, string>): Promise<void> {
    this.transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: {
        headers: headers,
      },
    });

    await this.mcp.connect(this.transport as Transport);
  }

  async listToolSpecs(): Promise<MCPToolSpec[]> {
    const result = await this.mcp.listTools();
    const tools = result.tools || [];
    const toolSpecs: MCPToolSpec[] = tools.map((tool: any) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
    return toolSpecs;
  }

  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, args: any): Promise<any> {
    const result = await this.mcp.callTool({
      name: toolName,
      arguments: args,
    });
    return result.content;
  }

  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
    }
  }
}
