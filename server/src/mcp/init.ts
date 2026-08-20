/**
 * Simple MCP Initialization
 */

import { createMCPClient, disconnectAllMCPClients, getMCPTools } from "./index";
import { loadMCPConfigFromFile, loadMCPConfigFromEnv } from "./config";
import logger from "@/lib/logger";
import { resolve } from "path";

/**
 * Initialize MCP clients on startup
 */
export async function initializeMCPClients(): Promise<void> {
  try {
    // Load config
    const configPath = resolve(process.cwd(), "mcp-config.json");
    let configs = loadMCPConfigFromFile(configPath);

    if (configs.length === 0) {
      configs = loadMCPConfigFromEnv();
    }

    if (configs.length === 0) {
      logger.info("No MCP servers configured");
      return;
    }

    // Connect to all servers
    await Promise.allSettled(
      configs.map((config) => createMCPClient(config))
    );

    // Get all tools
    const tools = await getMCPTools();
    const toolCount = Object.keys(tools).length;

    logger.info("MCP initialization complete", {
      servers: configs.length,
      tools: toolCount,
    });
  } catch (error) {
    logger.error("Failed to initialize MCP clients", { error });
  }
}

/**
 * Shutdown MCP clients
 */
export async function shutdownMCPClients(): Promise<void> {
  try {
    await disconnectAllMCPClients();
    logger.info("MCP clients shut down");
  } catch (error) {
    logger.error("Error shutting down MCP clients", { error });
  }
}
