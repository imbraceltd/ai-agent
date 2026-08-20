export interface MCPClientConfig {
  command: string;
  args: string[];
  name: string;
  version: string;
  env?: Record<string, string>;
}

export interface MCPClientManager {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getClient(): any;
}
