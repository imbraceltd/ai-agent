import { getGenericModel } from "@/database/genericModel";

// Define interfaces for session data structure
export interface SessionMessage {
  role: string;
  content: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  cache?: {
    read: number;
    write: number;
  };
}

export interface ReasoningData {
  stepId?: string | number;
  reasoning: string;
  timestamp: string;
  type: "general" | "tool-call";
  finishReason?: string;
  usage?: TokenUsage;
  // Tool-specific fields (only for tool-call type)
  toolCallId?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
}

export interface UsedDataSource {
  name: string;
  embeddingUrl: string;
  category: string;
  summary: string;
  schema?: string;
  attachmentUrl?: string;
  productType?: string;
  lastUsed: Date;
  usageCount: number;
}

export interface SessionDocument {
  sessionId: string;
  messages?: SessionMessage[];
  tokens?: TokenUsage;
  summary?: string;
  lastTokenUpdate?: Date;
  lastSummarization?: Date;
  reasoning?: ReasoningData[]; // Array to store reasoning data
  usedDataSources?: UsedDataSource[]; // Array to track parquet files used for recommendations
}

// Create a session model using the generic model function
const sessionModel = getGenericModel("sessions");

export default sessionModel;
