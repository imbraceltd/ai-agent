import { Response } from "express";
import { ApiResponse } from "../types/api";

/**
 * Creates a standard error ApiResponse object.
 * @param message - Human-readable error description
 * @returns ApiResponse with success: false and current timestamp
 */
export function createErrorResponse(message: string): ApiResponse {
  return {
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  };
}
