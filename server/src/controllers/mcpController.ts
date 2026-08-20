/**
 * MCP Configuration Controller
 * Handles HTTP streamable MCP verification and tool listing
 */

import { Request, Response } from "express";
import { z } from "zod";
import logger from "@/lib/logger";
import { ApiResponse } from "@/types/api";
import { getAssistantSettings } from "@/utils/agent";
import { MCPClient } from "@/lib/mcpClient";

/**
 * Validation schema for MCP verification request
 */
const verifyMCPSchema = z.object({
  assistant_id: z.string().min(1, { message: "Assistant ID is required" }),
});

/**
 * Validation schema for MCP list tools request
 */
const listToolsSchema = z.object({
  assistant_id: z.string().min(1, { message: "Assistant ID is required" }),
});

/**
 * POST /api/mcp/verify
 * Verify HTTP/SSE MCP server connection and capabilities
 */
export async function verifyMCPServer(
  req: Request,
  res: Response
): Promise<void> {
  try {
    // Get assistant settings to retrieve MCP configuration
    const userContext = (req as any).userContext;
    const assistant = await getAssistantSettings(req.body.assistant_id, userContext?.x_access_token, req.body.organization_id ?? userContext?.organization_id);

    if (!assistant) {
      res.status(404).json({
        success: false,
        error: `Assistant not found: ${req.body.assistant_id}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Extract tool server configuration from metadata
    const toolServer = assistant.metadata?.tool_server;

    if (!toolServer || !toolServer.enabled) {
      res.status(400).json({
        success: false,
        error:
          "MCP tool server is not configured or enabled for this assistant",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const url = toolServer.url;
    const apiKey = toolServer.key;

    if (!url) {
      res.status(400).json({
        success: false,
        error: "MCP server URL is not configured",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const mcpClient = new MCPClient();
    try {
      // Prepare headers
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers["Authorization"] = `Bearer ${apiKey}`;
      }

      // Create and connect MCP client
      await mcpClient.connect(url, headers);

      // List available tools
      const toolSpecs = await mcpClient.listToolSpecs();

      // Try to list resources (optional capability)

      res.status(200).json({
        success: true,
        data: {
          message: "MCP server verification successful",
          toolSpecs: toolSpecs,
          url,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      res.status(400).json({
        success: false,
        error: `MCP server verification failed: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      // Clean up connection
      if (mcpClient) {
        await mcpClient.disconnect();
      }
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Internal server error",
      timestamp: new Date().toISOString(),
    });
  }
}

