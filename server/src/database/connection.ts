import logger from "@/lib/logger";
import mongoose from "mongoose";
import config from "@/config";

// Reason: mongoose.connection.readyState is the source of truth (0=disconnected,
// 1=connected, 2=connecting, 3=disconnecting). We don't keep our own boolean
// flags — they drift out of sync with mongoose's internal state on reconnect.

const isConnected = (): boolean => mongoose.connection.readyState === 1;

/**
 * Main MongoDB connection for application data
 */
export const connectToDatabase = async (): Promise<void> => {
  if (isConnected()) {
    logger.info("Main MongoDB already connected");
    return;
  }

  const mongoUri = config.database.mongoUri;
  if (!mongoUri) {
    throw new Error("MONGODB_URI is not defined in configuration");
  }

  try {
    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      dbName: config.database.db_name,
    });

    logger.info("Main MongoDB connection established successfully", {
      uri: mongoUri.replace(/\/\/[^:]+:[^@]+@/, "//***:***@"),
      database: mongoose.connection.db?.databaseName,
    });

    // Connection events: log only — readyState already reflects state.
    mongoose.connection.on("error", (error) => {
      logger.error("MongoDB connection error:", error);
    });
    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });
    mongoose.connection.on("reconnected", () => {
      logger.info("MongoDB reconnected");
    });
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    throw error;
  }
};

/**
 * Secondary MongoDB connection for OpenAI/embeddings data.
 * Same physical connection as the main one (shared pool).
 */
export const connectToOpenAIDatabase = async (): Promise<mongoose.Connection> => {
  logger.info("Using main MongoDB connection for OpenAI data");
  await connectToDatabase();
  if (mongoose.connection.db?.databaseName !== config.database.db_name) {
    logger.warn(
      `Main connection database (${mongoose.connection.db?.databaseName}) differs from configured db_name (${config.database.db_name})`,
    );
  }
  return mongoose.connection;
};

/**
 * Initialize all database connections
 */
export const initializeDatabaseConnections = async (): Promise<{
  mainConnection: mongoose.Connection;
  openaiConnection: mongoose.Connection;
}> => {
  logger.info("Initializing database connections...");
  await connectToDatabase();
  const connection = mongoose.connection;
  logger.info("All database connections initialized successfully");
  return { mainConnection: connection, openaiConnection: connection };
};

/**
 * Gracefully close all database connections
 */
export const closeDatabaseConnections = async (): Promise<void> => {
  try {
    logger.info("Closing database connections...");
    const closePromises = mongoose.connections.map((c) =>
      c.readyState !== 0 ? c.close() : Promise.resolve(),
    );
    await Promise.all(closePromises);
    logger.info("All database connections closed successfully");
  } catch (error) {
    logger.error("Error closing database connections:", error);
    throw error;
  }
};

/**
 * Get connection status (derived from mongoose state, no separate flags).
 */
export const getConnectionStatus = () => {
  const connected = isConnected();
  return {
    mainConnected: connected,
    openaiConnected: connected,
    mainState: mongoose.connection.readyState,
    connections: mongoose.connections.length,
  };
};

// Legacy export for backward compatibility
export const openaiMongoDbClient = connectToOpenAIDatabase;
