/**
 * API Types and Interfaces
 * Shared types for API communication
 */

import { Request } from "express";

// Generic API response format
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Health check response
export interface HealthCheckResponse {
  status: "ok" | "error";
  uptime: number;
  timestamp: string;
  version: string;
  environment: string;
  memory?: {
    used: number;
    total: number;
  };
  database?: {
    connected: boolean;
    openaiConnected?: boolean;
    initialized?: boolean;
    connectionState?: number;
    totalConnections?: number;
  };
  redis?: {
    connected: boolean;
  };
  bus?: {
    connected: boolean;
  };
}

// Error response
export interface ErrorResponse {
  success: false;
  error: string;
  timestamp: string;
  path?: string;
  method?: string;
}

// Request validation error
export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationErrorResponse extends ErrorResponse {
  validationErrors: ValidationError[];
}

// Express request with user context (for future authentication)
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}
