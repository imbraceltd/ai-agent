/**
 * Standalone migration runner.
 *
 * Applies all pending SQL migrations in ./migrations to the PostgreSQL
 * database, then exits. Drizzle tracks applied migrations in the
 * `drizzle.__drizzle_migrations` table, so re-running is safe (idempotent).
 *
 * Usage:
 *   npm run db:migrate:run           # via ts-node (uses source ./migrations)
 *   node dist/database/migrate.js    # in the built image (see Dockerfile note)
 *
 * Unlike `drizzle-kit migrate`, this does NOT require drizzle-kit to be
 * installed, so it can run inside the production image.
 */

import fs from "fs";
import path from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import config from "@/config";
import logger from "@/lib/logger";

/**
 * Resolve the migrations folder whether running from source (ts-node) or
 * from the compiled dist directory.
 */
function resolveMigrationsFolder(): string {
  const candidates = [
    path.join(__dirname, "migrations"),
    path.join(process.cwd(), "src", "database", "migrations"),
    path.join(process.cwd(), "dist", "database", "migrations"),
  ];
  const found = candidates.find((dir) => fs.existsSync(dir));
  if (!found) {
    throw new Error(
      `Could not locate the migrations folder. Looked in: ${candidates.join(", ")}`
    );
  }
  return found;
}

/**
 * Run all pending migrations against the configured database.
 */
export async function runMigrations(): Promise<void> {
  const connectionUrl = config.database.AISDKChatClientPostgresUrl;

  if (!connectionUrl) {
    throw new Error("AISDK_CHAT_CLIENT_POSTGRES_URL is not set. Configure it in .env.");
  }

  const migrationsFolder = resolveMigrationsFolder();
  logger.info(`🗃️ Running migrations from ${migrationsFolder}...`);

  // Reason: drizzle's migrator requires max: 1 (single connection).
  const client = postgres(connectionUrl, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder });
    logger.info("✅ Migrations applied successfully");
  } finally {
    await client.end();
  }
}

// Run directly when invoked as a script (not when imported).
if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error("❌ Migration failed", { error });
      process.exit(1);
    });
}
