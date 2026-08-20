/**
 * Frontend TypeScript type definitions
 * Shared types for the React application
 */

import React from 'react';

// Re-export API types from utils for convenience
export type {
  ApiResponse,
  HealthCheckResponse
} from '@/lib/utils'

// Component props types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

// Error types
export interface ErrorInfo {
  message: string
  stack?: string
  timestamp: Date
}

// Environment variables (Vite)
export interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_APP_TITLE: string
  readonly VITE_APP_VERSION: string
}

export interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Application state types
export interface AppState {
  isLoading: boolean
  error: string | null
  theme: 'light' | 'dark' | 'system'
}

// Form types
export interface FormState<T = any> {
  data: T
  errors: Record<string, string>
  isSubmitting: boolean
  isValid: boolean
}

// Toast/notification types
export interface ToastConfig {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  duration?: number
}