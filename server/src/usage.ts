/**
 * Minimal placeholder for chat "usage/context" persisted in Postgres.
 *
 * This project currently doesn't define a concrete schema for this payload,
 * so we store it as JSONB and type it as a generic record.
 */
export type AppUsage = Record<string, unknown>;




