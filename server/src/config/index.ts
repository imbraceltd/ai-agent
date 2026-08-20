import logger from "@/lib/logger";
import * as dotenv from "dotenv";
import path from "path";

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, "../../../.env") });

const config = {
  // Server Configuration
  server: {
    port: process.env["PORT"] || 3000,
    nodeEnv: process.env["NODE_ENV"] || "development",
  },

  // Database Configuration
  database: {
    AISDKChatClientPostgresUrl:
      process.env["AISDK_CHAT_CLIENT_POSTGRES_URL"] || "",
  },

  // Redis Configuration (shared state across instances)
  redis: {
    url: process.env["REDIS_URL"] || "redis://common-redis:6379",
    keyPrefix: process.env["REDIS_KEY_PREFIX"] || "ai-agent:",
  },

  // Cross-instance event bus (Redis Pub/Sub).
  bus: {
    channelPrefix: process.env["BUS_CHANNEL_PREFIX"] || "ai-agent:event:",
  },

  // AWS Configuration
  aws: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] || "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] || "",
    region_ai: process.env["AWS_REGION_AI"] || "us-west-2",
    region_s3: process.env["AWS_REGION_S3"] || "ap-east-1",
    s3Bucket: process.env["AWS_S3_BUCKET"] || "imbrace-uat",
    modelId: process.env["MODEL_ID"] || "openai.gpt-oss-120b-1:0",
  },

  // AI provider selection used by the system-default model path.
  // Set AI_PROVIDER=vllm to route the system "Default" model through vLLM;
  // otherwise Bedrock with aws.modelId.
  ai: {
    provider: process.env["AI_PROVIDER"] || "bedrock",
    vllm: {
      baseURL: process.env["VLLM_BASE_URL"] || "",
      apiKey: process.env["VLLM_API_KEY"] || "",
      modelId: process.env["VLLM_MODEL_ID"] || "",
    },
  },

  // DuckDB Configuration
  duckdb: {
    threads: process.env["DUCKDB_THREADS"] || "4",
    binaryPath: process.env["DUCKDB_BINARY_PATH"] || "duckdb",
    tempDir: process.env["DUCKDB_TEMP_DIR"] || "/tmp/duckdb",
  },

  // Storage Configuration (S3 or On-Premise)
  storage: {
    // 's3' for cloud storage, 'local' for on-premise
    type: (process.env["STORAGE_TYPE"] || "s3") as "s3" | "local",
    // Local storage configuration
    local: {
      basePath: process.env["FILE_PATH"] || "/mnt/data/files/aiToolLoopAgent/",
    },
    // S3 storage configuration (uses aws config above)
    s3: {
      bucket: process.env["STORAGE_S3_BUCKET"] || "imbrace",
      prefix: process.env["STORAGE_S3_PREFIX"] || "embedding",
    },
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env["OPENAI_API_KEY"] || "",
    embeddingModel: process.env["EMBEDDING_MODEL"] || "text-embedding-3-small",
    embeddingBaseUrl: process.env["EMBEDDING_BASE_URL"] || "",
    openAIProxyURL: process.env["OPENAI_PROXY_URL"] || "",
  },
  google: {
    apiKey: process.env["GOOGLE_API_KEY"] || "",
    googleProxyURL: process.env["GOOGLE_PROXY_URL"] || "",
  },
  ollama: {
    url: process.env["OLLAMA_URL"] || "http://localhost:11434",
  },
  guardrail: {
    enabled: process.env["GUARDRAIL_ENABLED"] === "true",
    model: process.env["GUARDRAIL_MODEL"] || "qwen3guard-8b-war",
    baseurl: process.env["GUARDRAIL_BASE_URL"] || "http://localhost:11434",
  },
  vllm: {
    url: process.env["VLLM_URL"] || "http://localhost:8000",
  },
  suggestion: {
    modelId: process.env["SUGGESTION_MODEL_ID"] || "",
    providerUrl: process.env["SUGGESTION_MODEL_PROVIDER_URL"] || "",
    providerType: (process.env["SUGGESTION_MODEL_PROVIDER_TYPE"] ||
      "openai") as "openai" | "ollama" | "vllm",
  },
  workflow: {
    host: process.env["WORKFLOW_URL"] || "localhost:5678",
    newHost: process.env["IPS_URL"] || "",
  },

  webApp: {
    url: process.env["WEB_APP_URL"] || "http://localhost:5173",
    appgateway: process.env["APPGATEWAY"] || "api/v1",
  },
  appGateway: {
    url: process.env["APP_GATEWAY_URL"] || "http://localhost:9001",
  },
  webAppApi: {
    url: process.env["WEB_APP_API_URL"] || "",
  },
  aichat: {
    url: process.env["AI_CHAT_URL"] || "",
  },
  isUsingN8N: process.env["IS_USING_N8N"] || false,
  activepieceURL: process.env["ACTIVEPIECE_URL"] || "",
  imbracePrivateApi: {
    url: process.env["IMBRACE_PRIVATE_API"] || "http://localhost:9981",
  },
  embedding_type: process.env["EMBEDDING_TYPE"] || "openai",
  aiv2Internal: {
    url: process.env["AI_SERVICE_V2_INTERNAL_URL"] || "",
    apiKey: process.env["AI_SERVICE_V2_API_KEY"] || "",
  },
  dataBoard: {
    url: process.env["DATA_BOARD_URL"] || "",
  },
  tempo: {
    url: process.env["TEMPO_URL"] || "",
  },
  grafana: {
    url: process.env["GRAFANA_URL"] || "",
  },
  traceEnv: process.env["TRACE_ENV"] || "ai-trace-dev",

  // CORS Configuration
  cors: {
    origins:
      process.env["NODE_ENV"] === "production"
        ? (process.env["PRODUCTION_CORS_ORIGINS"] || "")
            .split(",")
            .filter(Boolean)
        : ["*"], // Allow all origins in development
    credentials: true,
  },
};

logger.debug(JSON.stringify(config));

export default config;
