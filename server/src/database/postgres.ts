/**
 * PostgreSQL connection using Drizzle ORM
 * Connects to the same PostgreSQL database used by imbrace-chat-bot
 */

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import config from "@/config";
import logger from "@/lib/logger";

let client: ReturnType<typeof postgres> | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize PostgreSQL connection
 */
export function initializePostgres(): ReturnType<typeof drizzle> {
  const connectionUrl = config.database.AISDKChatClientPostgresUrl;

  if (!connectionUrl) {
    throw new Error(
      "AISDK_CHAT_CLIENT_POSTGRES_URL is not set. Configure it in .env.",
    );
  }

  if (db) {
    return db;
  }

  client = postgres(connectionUrl);
  db = drizzle(client);

  logger.info("PostgreSQL connection initialized via Drizzle ORM");

  return db;
}

/**
 * Get the Drizzle database instance (lazy initialization)
 */
export function getDb(): ReturnType<typeof drizzle> {
  if (!db) {
    return initializePostgres();
  }
  return db;
}

/**
 * Close PostgreSQL connection gracefully
 */
export async function closePgConnection(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
    db = null;
    logger.info("PostgreSQL connection closed");
  }
}
