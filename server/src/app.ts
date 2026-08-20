import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import dotenv from "dotenv";
import { createProxyMiddleware } from "http-proxy-middleware";

// Import logging middleware
import { morganMiddleware, errorLogger } from "@/middleware/logging";
import logger from "@/lib/logger";
import config from "@/config";

// Import types
import { ErrorResponse } from "@/types/api";

// Import routes
import apiRoutes from "@/routes";
import { parseUserContext } from "./middleware/authorize";

// Load environment variables from root .env file
dotenv.config({ path: path.join(__dirname, "../../.env") });

/**
 * Express application setup with middleware configuration
 */

const app: Application = express();

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1);

// Security middleware - Allow iframe embedding from any domain
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP to allow iframe embedding
    crossOriginEmbedderPolicy: true, // Required: parent page (aisdk) has COEP enabled, iframe must match
    crossOriginResourcePolicy: { policy: "cross-origin" }, // Explicitly allow cross-origin resource loading
    frameguard: false, // Disable X-Frame-Options to allow iframe embedding
  }),
);

// CORS configuration - Allow all origins
const corsOptions = {
  origin: true, // Allow all origins
  credentials: true, // Allow credentials
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-access-token",
    "x-api-key",
    "x-organization-id",
  ],
};

app.use(cors(corsOptions));

// Global user context parsing middleware
app.use(parseUserContext);

// HTTP request logging
app.use(morganMiddleware);

// Health check endpoint (before other routes)
app.get("/health", (req: Request, res: Response) => {
  const healthCheck = {
    uptime: process.uptime(),
    message: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env["NODE_ENV"] || "development",
    version: process.env["npm_package_version"] || "1.0.0",
  };

  logger.info("Health check requested", { ip: req.ip });
  res.status(200).json(healthCheck);
});

// Proxy middleware for Imbrace API - only enable if target URL is configured
if (config.webAppApi.url && config.webAppApi.url.trim() !== "") {
  app.use(
    "/imbrace",
    createProxyMiddleware({
      target: config.webAppApi.url,
      changeOrigin: true,
      pathRewrite: {
        "^/imbrace": "", // Remove /imbrace prefix when forwarding
      },
      secure: true,
      logger: console,
    }),
  );
  logger.info("Imbrace proxy enabled", { target: config.webAppApi.url });
} else {
  logger.warn("Imbrace proxy disabled - WEB_APP_API_URL not configured");
}

// Proxy middleware for App Gateway API - only enable if target URL is configured
if (config.appGateway.url && config.appGateway.url.trim() !== "") {
  app.use(
    "/appgateway",
    createProxyMiddleware({
      target: config.appGateway.url,
      changeOrigin: true,
      pathRewrite: {
        "^/appgateway": "", // Remove /appgateway prefix when forwarding
      },
      secure: true,
      logger: console,
    }),
  );
  logger.info("App Gateway proxy enabled", { target: config.appGateway.url });
} else {
  logger.warn("App Gateway proxy disabled - APP_GATEWAY_URL not configured");
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// API routes
app.use("/api", apiRoutes);

// Serve static files in production
if (process.env["NODE_ENV"] === "production") {
  logger.info("Starting in production mode - setting up static file serving");

  // Log current working directory and __dirname for debugging
  logger.info("Path debugging info", {
    cwd: process.cwd(),
    __dirname: __dirname,
  });

  // Try multiple possible paths for client dist
  const possiblePaths = [
    path.join(__dirname, "../../client/dist"), // Development/local build
    path.join(process.cwd(), "server/client/dist"), // Docker container structure (correct path)
    path.join(process.cwd(), "client/dist"), // Alternative Docker structure
    path.join(__dirname, "../client/dist"), // Alternative structure
  ];

  let clientDistPath: string = possiblePaths[0]!; // Default fallback

  // Find the first path that exists
  for (const testPath of possiblePaths) {
    logger.info(`Checking path: ${testPath}`);
    try {
      if (require("fs").existsSync(testPath)) {
        clientDistPath = testPath;
        logger.info(`✅ Using client dist path: ${clientDistPath}`);
        break;
      } else {
        logger.info(`❌ Path does not exist: ${testPath}`);
      }
    } catch (error) {
      logger.error(`Error checking path ${testPath}:`, error);
    }
  }

  if (!require("fs").existsSync(clientDistPath)) {
    logger.error(
      "❌ Client dist directory not found at any expected location",
      {
        attemptedPaths: possiblePaths,
      },
    );
  }

  // Serve static files only if path exists
  if (require("fs").existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));

    // Handle React Router - send all non-API requests to index.html
    app.get("*", (req: Request, res: Response): void => {
      // Don't serve index.html for API routes
      if (req.path.startsWith("/api/")) {
        res.status(404).json({
          success: false,
          error: "API endpoint not found",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  } else {
    // Fallback route when client dist is not available
    app.get("*", (req: Request, res: Response): void => {
      if (req.path.startsWith("/api/")) {
        res.status(404).json({
          success: false,
          error: "API endpoint not found",
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(503).json({
        success: false,
        error: "Frontend not available - client build not found",
        timestamp: new Date().toISOString(),
      });
    });
  }
}

// 404 handler for API routes (both prefixes)
const apiNotFound = (req: Request, res: Response): void => {
  const errorResponse: ErrorResponse = {
    success: false,
    error: `API endpoint not found: ${req.method} ${req.path}`,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  logger.warn("404 - API endpoint not found", {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(404).json(errorResponse);
};
app.use("/api/*", apiNotFound);
app.use("/ai-agent/*", apiNotFound);

// Error logging middleware
app.use(errorLogger);

// Global error handling middleware
app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
  const statusCode = (error as any).statusCode || 500;

  const errorResponse: ErrorResponse = {
    success: false,
    error:
      process.env["NODE_ENV"] === "production"
        ? "Internal server error"
        : error.message,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  };

  logger.error("Express Error Handler:", {
    error: error.message,
    stack: error.stack,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  res.status(statusCode).json(errorResponse);
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  process.exit(0);
});

export default app;
