/**
 * Simple MCP Integration for AI SDK
 * 
 * Usage:
 * 1. Call initializeMCPClients() on startup
 * 2. Call getMCPTools() to get all MCP tools for AI SDK
 * 3. Pass tools to streamText({ tools: { ...yourTools, ...mcpTools } })
 */

export { MCPClient } from "./client";
export { loadMCPConfigFromFile, loadMCPConfigFromEnv } from "./config";
export * from "./types";

import { MCPClient } from "./client";
import { MCPServerConfig } from "./types";
import logger from "@/lib/logger";

// Simple registry for connected clients
const mcpClients = new Map<string, MCPClient>();

/**
 * Create and connect to an MCP server
 */
export async function createMCPClient(config: MCPServerConfig): Promise<MCPClient> {
  const client = new MCPClient(config);
  await client.connect();
  mcpClients.set(config.name, client);
  return client;
}

/**
 * Get all MCP tools from all connected servers
 * Returns a single object with all tools that can be passed to AI SDK
 */
export async function getMCPTools(): Promise<Record<string, any>> {
  const allTools: Record<string, any> = {};

  for (const [name, client] of mcpClients.entries()) {
    try {
      const tools = await client.getTools();
      Object.assign(allTools, tools);
      logger.debug(`Loaded ${Object.keys(tools).length} tools from ${name}`);
    } catch (error) {
      logger.error(`Failed to get tools from ${name}`, { error });
    }
  }

  return allTools;
}

/**
 * Get a specific MCP client by name (for advanced usage)
 */
export function getMCPClient(name: string): MCPClient | undefined {
  return mcpClients.get(name);
}

/**
 * Get all connected clients
 */
export function getAllMCPClients(): Map<string, MCPClient> {
  return mcpClients;
}

/**
 * Disconnect all MCP clients
 */
export async function disconnectAllMCPClients(): Promise<void> {
  for (const [name, client] of mcpClients.entries()) {
    try {
      await client.disconnect();
      mcpClients.delete(name);
    } catch (error) {
      logger.error(`Failed to disconnect ${name}`, { error });
    }
  }
  logger.info("All MCP clients disconnected");
}
