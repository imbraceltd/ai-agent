/**
 * Vitest test setup configuration
 * Configures the test environment for React frontend testing
 */

import { expect, afterEach, beforeAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'

// Extend Vitest's expect with Testing Library's DOM matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})

// Global test setup
beforeAll(() => {
  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock window.scrollTo
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: vi.fn(),
  })

  // Mock console methods to reduce noise in test output
  global.console = {
    ...console,
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }
})

// Mock fetch for API calls
const mockFetch = vi.fn()
global.fetch = mockFetch

// Test utilities
export const testUtils = {
  /**
   * Mock successful API response
   */
  mockApiSuccess: <T>(data: T) => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        success: true,
        data,
        timestamp: new Date().toISOString()
      })
    })
  },

  /**
   * Mock API error response
   */
  mockApiError: (error: string, status = 500) => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status,
      json: () => Promise.resolve({
        success: false,
        error,
        timestamp: new Date().toISOString()
      })
    })
  },

  /**
   * Mock network error
   */
  mockNetworkError: () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
  },

  /**
   * Reset all fetch mocks
   */
  resetMocks: () => {
    mockFetch.mockReset()
  },

  /**
   * Helper to wait for async operations
   */
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Generate test data
   */
  generateTestData: {
    healthResponse: () => ({
      status: 'ok' as const,
      uptime: 12345,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: 'test',
      memory: {
        used: 50,
        total: 100
      }
    })
  }
}

// Export fetch mock for individual test use
export { mockFetch }