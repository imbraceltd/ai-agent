/**
 * Server entry point
 * Starts the Express server with proper error handling and graceful shutdown
 */

import app from "./app";
import logger from "@/lib/logger";
import config from "@/config";
import dotenv from "dotenv";
import { closeDatabaseConnections } from "@/database/connection";
import { initializePostgres, closePgConnection } from "@/database/postgres";
import { closeRedis } from "@/lib/redis";
import { Bus } from "@/bus";
import "./lib/instrumentation";

// Load environment variables
dotenv.config();

// Server configuration
const PORT = config.server.port;
const NODE_ENV = config.server.nodeEnv;

/**
 * Start the Express server with database initialization
 */
const startServer = async (): Promise<void> => {
  try {
    // Initialize PostgreSQL connection for chat-client data
    if (config.database.AISDKChatClientPostgresUrl) {
      logger.info("🔌 Initializing PostgreSQL connection...");
      initializePostgres();
      logger.info("✅ PostgreSQL connection initialized");
    } else {
      logger.warn(
        "⚠️ AISDK_CHAT_CLIENT_POSTGRES_URL not set, chat-client routes will not work",
      );
    }

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server started successfully`, {
        port: PORT,
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
        processId: process.pid,
      });

      logger.info(
        `📊 Server health check available at: http://localhost:${PORT}/health`,
      );

      if (NODE_ENV === "development") {
        logger.info(
          `🔗 API endpoints available at: http://localhost:${PORT}/api`,
        );
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string): Promise<void> => {
      logger.info(`🛑 ${signal} received, starting graceful shutdown...`);

      try {
        server.close(async (error) => {
          if (error) {
            logger.error("Error during server shutdown:", error);
          } else {
            logger.info("✅ HTTP server closed successfully");
          }

          try {
            // Close the bus before Redis so its pub/sub connections quit cleanly.
            await Bus.dispose();
            // Close database connections
            await closeDatabaseConnections();
            await closePgConnection();
            await closeRedis();
            logger.info("✅ Bus, database and Redis connections closed successfully");
            process.exit(error ? 1 : 0);
          } catch (dbError) {
            logger.error("Error closing bus/database/Redis connections:", dbError);
            process.exit(1);
          }
        });

        // Force shutdown after 10 seconds
        setTimeout(() => {
          logger.error("⏰ Forced shutdown after timeout");
          process.exit(1);
        }, 10000);
      } catch (error) {
        logger.error("Error during graceful shutdown:", error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle uncaught exceptions
    process.on("uncaughtException", (error: Error) => {
      logger.error("Uncaught Exception:", {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      });

      gracefulShutdown("UNCAUGHT_EXCEPTION");
    });

    // Handle unhandled promise rejections
    process.on("unhandledRejection", (reason: any, promise: Promise<any>) => {
      logger.error("Unhandled Rejection:", {
        reason: reason?.message || reason,
        stack: reason?.stack,
        promise: promise.toString(),
        timestamp: new Date().toISOString(),
      });

      gracefulShutdown("UNHANDLED_REJECTION");
    });
  } catch (error) {
    logger.error("Failed to start server:", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      port: PORT,
      environment: NODE_ENV,
    });

    // Close any open bus/database/Redis connections before exiting
    try {
      await Bus.dispose();
      await closeDatabaseConnections();
      await closeRedis();
    } catch (dbError) {
      logger.error(
        "Error closing bus/database/Redis connections during startup failure:",
        dbError,
      );
    }

    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer().catch((error) => {
    logger.error("Unhandled error during server startup:", error);
    process.exit(1);
  });
}

export default app;
