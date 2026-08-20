import winston from "winston";

/**
 * Logger configuration with Winston
 * Always logs to console at debug level for visibility
 */

/**
 * Safely stringify objects that may contain circular references.
 * @param obj - The object to stringify
 * @returns JSON string with circular references replaced by "[Circular]"
 */
function safeStringify(obj: unknown): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (_key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  });
}

const logger = winston.createLogger({
  level: "debug",
  format: winston.format.combine(
    winston.format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    }),
    winston.format.errors({ stack: true }),
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
          const metaStr = Object.keys(meta).length
            ? " " + safeStringify(meta)
            : "";
          return `${timestamp} [${level}]: ${message}${metaStr}`;
        })
      ),
    }),
  ],
});

export default logger;
