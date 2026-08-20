import logger from "@/lib/logger";
import { MCPClientConfig, MCPClientManager } from "./types";

// Dynamic import types
type Client = any;

export abstract class BaseMCPClient implements MCPClientManager {
  protected client: Client | null = null;
  protected config: MCPClientConfig;
  protected connectionPromise: Promise<void> | null = null;
  protected isConnecting = false;

  constructor(config: MCPClientConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    // Handle concurrent connection attempts
    if (this.isConnecting && this.connectionPromise) {
      return this.connectionPromise;
    }

    if (this.client && (await this.validateConnection())) {
      return; // Already connected and validated
    }

    this.isConnecting = true;
    this.connectionPromise = this.performConnection();

    try {
      await this.connectionPromise;
    } finally {
      this.isConnecting = false;
      this.connectionPromise = null;
    }
  }

  private async performConnection(): Promise<void> {
    try {
      // Clean up existing client if any
      if (this.client) {
        try {
          await this.client.close();
        } catch (error) {
          logger.warn(`Error closing existing client: ${error}`);
        }
        this.client = null;
      }

      // Dynamic imports for ES modules
      const { Client } = await import(
        "@modelcontextprotocol/sdk/client/index.js"
      );
      const { StdioClientTransport } = await import(
        "@modelcontextprotocol/sdk/client/stdio.js"
      );

      const transportConfig: any = {
        command: this.config.command,
        args: this.config.args,
      };

      if (this.config.env) {
        transportConfig.env = { ...process.env, ...this.config.env } as Record<
          string,
          string
        >;
      }

      const transport = new StdioClientTransport(transportConfig);
      const tempClient = new Client(
        {
          name: this.config.name,
          version: this.config.version,
        },
        {
          capabilities: {},
        }
      );

      logger.info(
        `Spawning MCP server: ${this.config.command} ${this.config.args.join(
          " "
        )}`
      );

      // Connect with timeout
      const connectPromise = tempClient.connect(transport);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Connection timeout")), 30000); // 30 second timeout
      });

      await Promise.race([connectPromise, timeoutPromise]);

      // Validate connection by listing tools
      await tempClient.listTools();

      this.client = tempClient;
      logger.info(`MCP client ${this.config.name} connected successfully`);
    } catch (error) {
      logger.error(`MCP transport failed. ENV:`, this.config.env);
      logger.error(
        `Failed to initialize MCP client ${this.config.name}:`,
        error
      );
      this.client = null;
      throw new Error(
        `Failed to connect to MCP server: ${this.config.name} - ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        this.client = null;
        logger.info(`MCP client ${this.config.name} disconnected successfully`);
      } catch (error) {
        logger.error(
          `Error disconnecting MCP client ${this.config.name}:`,
          error
        );
        throw error;
      }
    }
  }

  isConnected(): boolean {
    return this.client !== null;
  }

  async validateConnection(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      // Try to list tools as a health check
      await this.client.listTools();
      return true;
    } catch (error) {
      logger.warn(`Connection validation failed: ${error}`);
      return false;
    }
  }

  getClient(): Client {
    if (!this.client) {
      throw new Error("MCP client is not connected. Call connect() first.");
    }
    return this.client;
  }

  protected async ensureConnected(): Promise<Client> {
    if (!this.client || !(await this.validateConnection())) {
      await this.connect();
    }
    return this.getClient();
  }

  protected async executeWithRetry<T>(
    operation: (client: Client) => Promise<T>,
    maxRetries: number = 3
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const client = await this.ensureConnected();
        return await operation(client);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Attempt ${attempt} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          // Reset client to force reconnection on next attempt
          this.client = null;

          // Exponential backoff with jitter
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          const jitter = Math.random() * 1000;
          await new Promise((resolve) =>
            setTimeout(resolve, backoffMs + jitter)
          );
        }
      }
    }

    throw lastError!;
  }
}
