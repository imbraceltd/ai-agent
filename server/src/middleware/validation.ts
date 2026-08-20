import { Request, Response, NextFunction } from "express";
import { z, ZodSchema, ZodError } from "zod";
import logger from "@/lib/logger";
import { ValidationErrorResponse, ValidationError } from "@/types/api";

/**
 * Generic Zod validation middleware for Express
 * Validates request body, params, or query parameters
 */

type ValidationSource = "body" | "params" | "query";

/**
 * Creates a validation middleware for the specified request source
 * @param schema - Zod schema to validate against
 * @param source - Part of the request to validate ('body', 'params', 'query')
 */
export const validate = (
  schema: ZodSchema,
  source: ValidationSource = "body"
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Use parseAsync for better error handling as per PRP guidelines
      const validatedData = await schema.parseAsync(req[source]);

      // Replace the request data with validated data
      req[source] = validatedData;

      logger.debug("Validation successful", {
        source,
        path: req.path,
        method: req.method,
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Transform Zod errors into our custom validation error format
        const validationErrors: ValidationError[] = error.issues.map((err) => ({
          field: err.path.join("."),
          message: err.message,
          value: undefined, // ZodError doesn't expose input value
        }));

        const errorResponse: ValidationErrorResponse = {
          success: false,
          error: `Invalid ${source} data`,
          validationErrors,
          timestamp: new Date().toISOString(),
          path: req.path,
          method: req.method,
        };

        logger.warn("Validation failed", {
          source,
          path: req.path,
          method: req.method,
          errors: validationErrors,
          ip: req.ip,
        });

        res.status(400).json(errorResponse);
        return;
      }

      // Handle unexpected validation errors
      logger.error("Unexpected validation error", {
        error: error instanceof Error ? error.message : String(error),
        source,
        path: req.path,
        method: req.method,
      });

      res.status(500).json({
        success: false,
        error: "Internal validation error",
        timestamp: new Date().toISOString(),
        path: req.path,
        method: req.method,
      });
    }
  };
};

/**
 * Validates request body
 */
export const validateBody = (schema: ZodSchema) => validate(schema, "body");

/**
 * Validates request parameters
 */
export const validateParams = (schema: ZodSchema) => validate(schema, "params");

/**
 * Validates query parameters
 */
export const validateQuery = (schema: ZodSchema) => validate(schema, "query");

/**
 * Common validation schemas
 */

// ID parameter validation
export const idParamSchema = z.object({
  id: z.string().uuid("Invalid ID format"),
});

// Pagination query validation
export const paginationQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a number")
    .transform(Number)
    .optional(),
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .transform(Number)
    .optional(),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).optional(),
});

// Health check query validation
export const healthCheckQuerySchema = z
  .object({
    detailed: z
      .string()
      .transform((val) => val === "true")
      .optional(),
  })
  .optional();
