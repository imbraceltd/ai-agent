/**
 * Database package exports
 * Central export point for database functionality
 */

export {
  connectToDatabase,
  connectToOpenAIDatabase,
  initializeDatabaseConnections,
  closeDatabaseConnections,
  getConnectionStatus,
} from "./connection";

// PostgreSQL (Drizzle ORM) exports for chat-client data
export { getDb, initializePostgres, closePgConnection } from "./postgres";
export * from "./pgSchema";
export * as pgQueries from "./pgQueries";
