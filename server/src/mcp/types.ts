/**
 * MCP Client Configuration Types
 */

export type MCPTransportType = "stdio" | "http" | "sse";

export interface MCPServerConfig {
  name: string;
  transport: MCPTransportType;
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // For HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface MCPClientOptions {
  timeout?: number; // Request timeout in ms
  retries?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in ms
}

export interface MCPTool {
  name: string;
  description?: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Array<{
    name: string;
    description?: string;
    required?: boolean;
  }>;
}

export interface MCPServerCapabilities {
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: object;
}

