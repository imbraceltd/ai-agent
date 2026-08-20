import { experimental_createMCPClient } from "@ai-sdk/mcp";
import logger from "@/lib/logger";

export interface McpToolServerConfig {
    enabled?: boolean;
    url?: string;
    key?: string;
}

export interface McpConnection {
    tools: Record<string, any>;
    client: any | null;
}

/**
 * Load MCP tools based on configuration
 */
export async function loadMcpTools(
    assistantId: string,
    toolServer?: McpToolServerConfig
): Promise<McpConnection> {
    let mcpTools = {};
    let mcpClient: any = null;

    // MCP tool server configuration
    if (toolServer?.enabled && toolServer.url) {
        try {
            logger.info("Loading MCP tools from assistant configuration", {
                assistantId,
                url: toolServer.url,
                hasApiKey: !!toolServer.key,
            });

            // Create MCP client using AI SDK
            const transportConfig: any = {
                type: "http" as const,
                url: toolServer.url,
            };

            if (toolServer.key) {
                transportConfig.headers = {
                    Authorization: `Bearer ${toolServer.key}`,
                };
            }

            mcpClient = await experimental_createMCPClient({
                transport: transportConfig,
            });

            // Get tools from MCP client
            mcpTools = await mcpClient.tools();

            logger.info("MCP tools loaded into agent", {
                count: Object.keys(mcpTools).length,
                tools: Object.keys(mcpTools),
                assistantId,
            });
        } catch (error) {
            logger.error("Failed to load MCP tools", {
                error: error instanceof Error ? error.message : String(error),
                assistantId,
                url: toolServer.url,
            });
            // Continue without MCP tools
        }
    }

    return { tools: mcpTools, client: mcpClient };
}
