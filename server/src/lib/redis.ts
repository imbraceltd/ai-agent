import Redis from "ioredis";
import config from "@/config";
import logger from "@/lib/logger";

/**
 * Singleton Redis client used for sharing state across instances
 * (token cache, todo store). Keys are namespaced under `nba:` to
 * avoid collision with other services sharing the same Redis.
 */
export const redis = new Redis(config.redis.url, {
  keyPrefix: config.redis.keyPrefix,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
});

redis.on("connect", () => {
  logger.info("Redis connecting", { url: config.redis.url });
});

redis.on("ready", () => {
  logger.info("Redis ready", { keyPrefix: config.redis.keyPrefix });
});

redis.on("error", (err) => {
  logger.error("Redis error", {
    message: err instanceof Error ? err.message : String(err),
  });
});

redis.on("end", () => {
  logger.warn("Redis connection closed");
});

/**
 * Gracefully close the Redis connection. Call during app shutdown.
 */
export async function closeRedis(): Promise<void> {
  try {
    await redis.quit();
    logger.info("Redis connection closed successfully");
  } catch (err) {
    logger.error("Error closing Redis connection", {
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
