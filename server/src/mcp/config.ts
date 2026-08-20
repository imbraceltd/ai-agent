/**
 * MCP Client Configuration Loader
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import logger from "@/lib/logger";
import { MCPServerConfig } from "./types";

/**
 * Load MCP server configurations from a JSON file
 */
export function loadMCPConfigFromFile(filePath: string): MCPServerConfig[] {
  try {
    const absolutePath = resolve(filePath);

    if (!existsSync(absolutePath)) {
      logger.warn("MCP config file not found", { path: absolutePath });
      return [];
    }

    const fileContent = readFileSync(absolutePath, "utf-8");
    const config = JSON.parse(fileContent);

    // Support both direct array and mcpServers object format
    let servers: Record<string, any>;

    if (Array.isArray(config)) {
      // Direct array format
      return config as MCPServerConfig[];
    } else if (config.mcpServers) {
      // Claude Desktop format
      servers = config.mcpServers;
    } else {
      servers = config;
    }

    // Convert object format to array
    const serverConfigs: MCPServerConfig[] = [];

    for (const [name, serverConfig] of Object.entries(servers)) {
      // Determine transport type
      let transport: "stdio" | "http" | "sse" = "stdio";

      if (serverConfig.url) {
        transport = serverConfig.transport || "http";
      } else if (serverConfig.command) {
        transport = "stdio";
      }

      serverConfigs.push({
        name,
        transport,
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env,
        url: serverConfig.url,
        headers: serverConfig.headers,
        apiKey: serverConfig.apiKey || serverConfig.api_key,
      });
    }

    logger.info("Loaded MCP configurations", {
      file: absolutePath,
      count: serverConfigs.length,
    });

    return serverConfigs;
  } catch (error) {
    logger.error("Failed to load MCP config file", { path: filePath, error });
    return [];
  }
}

/**
 * Load MCP configurations from environment variables
 */
export function loadMCPConfigFromEnv(): MCPServerConfig[] {
  const configs: MCPServerConfig[] = [];

  // Example format: MCP_SERVER_1_NAME, MCP_SERVER_1_TRANSPORT, etc.
  const serverCount = parseInt(process.env["MCP_SERVER_COUNT"] || "0");

  for (let i = 1; i <= serverCount; i++) {
    const prefix = `MCP_SERVER_${i}_`;
    const name = process.env[`${prefix}NAME`];
    const transport = process.env[`${prefix}TRANSPORT`] as
      | "stdio"
      | "http"
      | "sse"
      | undefined;

    if (!name || !transport) {
      continue;
    }

    const config: MCPServerConfig = {
      name,
      transport,
    };

    if (transport === "stdio") {
      const command = process.env[`${prefix}COMMAND`];
      const argsStr = process.env[`${prefix}ARGS`];
      if (command) {
        config.command = command;
      }
      if (argsStr) {
        config.args = argsStr.split(",");
      }
    } else {
      const url = process.env[`${prefix}URL`];
      const apiKey = process.env[`${prefix}API_KEY`];
      if (url) {
        config.url = url;
      }
      if (apiKey) {
        config.apiKey = apiKey;
      }
    }

    configs.push(config);
  }

  if (configs.length > 0) {
    logger.info("Loaded MCP configurations from environment", {
      count: configs.length,
    });
  }

  return configs;
}

/**
 * Default MCP configuration examples
 */
export const defaultMCPConfigs: MCPServerConfig[] = [
  // Example stdio server
  {
    name: "example-stdio-server",
    transport: "stdio",
    command: "node",
    args: ["path/to/mcp-server.js"],
  },
  // Example HTTP server
  {
    name: "example-http-server",
    transport: "http",
    url: "http://localhost:3000/mcp",
  },
  // Example SSE server
  {
    name: "example-sse-server",
    transport: "sse",
    url: "http://localhost:3000/sse",
    apiKey: "your-api-key",
  },
];

