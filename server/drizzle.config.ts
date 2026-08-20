/**
 * Drizzle Kit configuration.
 *
 * Drives `drizzle-kit generate` (create SQL migrations from the schema) and
 * `drizzle-kit migrate` (apply pending migrations to the target database).
 *
 * NOTE: This database is shared with `imbrace-chat-bot`. Before running
 * migrations against a database that already contains these tables, baseline
 * it first (see server/src/database/migrations/README.md), otherwise the
 * initial CREATE TABLE migration will fail with "already exists".
 */

import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
import path from "path";

// Load the root .env (same file the app reads via src/config).
dotenv.config({ path: path.join(__dirname, "../.env") });

const connectionUrl = process.env["AISDK_CHAT_CLIENT_POSTGRES_URL"];

if (!connectionUrl) {
  throw new Error(
    "AISDK_CHAT_CLIENT_POSTGRES_URL is not set. Configure it in the root .env before running drizzle-kit."
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/pgSchema.ts",
  out: "./src/database/migrations",
  dbCredentials: {
    url: connectionUrl,
  },
  // Reason: tables created by imbrace-chat-bot use exact PascalCase names
  // ("Chat", "Message_v2", ...). Keep identifiers verbatim, never snake_case them.
  casing: "preserve",
  verbose: true,
  strict: true,
});
