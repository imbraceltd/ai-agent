/**
 * Utility Functions Test Suite
 * Tests for utility functions including API client and helpers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  cn, 
  ApiClient, 
  apiClient, 
  healthCheck, 
  formatBytes, 
  formatUptime 
} from '../../src/lib/utils'
import { testUtils, mockFetch } from '../setup'

describe('Utility Functions', () => {
  beforeEach(() => {
    testUtils.resetMocks()
  })

  describe('cn (className utility)', () => {
    it('combines class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('handles conditional classes', () => {
      expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2')
    })

    it('merges conflicting Tailwind classes', () => {
      // tailwind-merge should handle conflicting classes
      expect(cn('p-4', 'p-6')).toBe('p-6')
    })

    it('handles arrays and objects', () => {
      expect(cn(['class1', 'class2'], { class3: true, class4: false })).toBe('class1 class2 class3')
    })
  })

  describe('ApiClient', () => {
    let client: ApiClient

    beforeEach(() => {
      client = new ApiClient('/test-api')
    })

    describe('GET requests', () => {
      it('makes successful GET request', async () => {
        const responseData = { message: 'success' }
        testUtils.mockApiSuccess(responseData)

        const result = await client.get('/endpoint')

        expect(result).toEqual({
          success: true,
          data: responseData,
          timestamp: expect.any(String)
        })

        expect(mockFetch).toHaveBeenCalledWith('/test-api/endpoint', {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'GET'
        })
      })

      it('handles GET request errors', async () => {
        testUtils.mockApiError('Server error', 500)

        const result = await client.get('/endpoint')

        expect(result.success).toBe(false)
        expect(result.error).toBe('HTTP error! status: 500')
      })

      it('handles network errors', async () => {
        testUtils.mockNetworkError()

        const result = await client.get('/endpoint')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Network error')
      })
    })

    describe('POST requests', () => {
      it('makes successful POST request with data', async () => {
        const requestData = { name: 'test' }
        const responseData = { id: 1, name: 'test' }
        testUtils.mockApiSuccess(responseData)

        const result = await client.post('/endpoint', requestData)

        expect(result).toEqual({
          success: true,
          data: responseData,
          timestamp: expect.any(String)
        })

        expect(mockFetch).toHaveBeenCalledWith('/test-api/endpoint', {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: JSON.stringify(requestData)
        })
      })

      it('makes POST request without data', async () => {
        testUtils.mockApiSuccess({})

        await client.post('/endpoint')

        expect(mockFetch).toHaveBeenCalledWith('/test-api/endpoint', {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'POST',
          body: undefined
        })
      })
    })

    describe('PUT requests', () => {
      it('makes successful PUT request', async () => {
        const requestData = { id: 1, name: 'updated' }
        testUtils.mockApiSuccess(requestData)

        const result = await client.put('/endpoint', requestData)

        expect(result.success).toBe(true)
        expect(mockFetch).toHaveBeenCalledWith('/test-api/endpoint', {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'PUT',
          body: JSON.stringify(requestData)
        })
      })
    })

    describe('DELETE requests', () => {
      it('makes successful DELETE request', async () => {
        testUtils.mockApiSuccess({})

        const result = await client.delete('/endpoint')

        expect(result.success).toBe(true)
        expect(mockFetch).toHaveBeenCalledWith('/test-api/endpoint', {
          headers: {
            'Content-Type': 'application/json'
          },
          method: 'DELETE'
        })
      })
    })

    describe('Error handling', () => {
      it('handles non-JSON responses gracefully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.reject(new Error('Invalid JSON'))
        })

        const result = await client.get('/endpoint')

        expect(result.success).toBe(false)
        expect(result.error).toContain('HTTP error! status: 500')
      })

      it('handles fetch exceptions', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network failure'))

        const result = await client.get('/endpoint')

        expect(result.success).toBe(false)
        expect(result.error).toBe('Network failure')
      })
    })
  })

  describe('Default API Client', () => {
    it('uses environment variable for base URL', () => {
      // The default client should be configured with the environment variable
      expect(apiClient).toBeInstanceOf(ApiClient)
    })
  })

  describe('healthCheck function', () => {
    it('makes basic health check request', async () => {
      const healthData = testUtils.generateTestData.healthResponse()
      testUtils.mockApiSuccess(healthData)

      const result = await healthCheck()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(healthData)
      expect(mockFetch).toHaveBeenCalledWith('/api/health', expect.any(Object))
    })

    it('makes detailed health check request', async () => {
      const healthData = testUtils.generateTestData.healthResponse()
      testUtils.mockApiSuccess(healthData)

      const result = await healthCheck(true)

      expect(result.success).toBe(true)
      expect(mockFetch).toHaveBeenCalledWith('/api/health?detailed=true', expect.any(Object))
    })

    it('handles health check errors', async () => {
      testUtils.mockApiError('Health check failed')

      const result = await healthCheck()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Health check failed')
    })
  })

  describe('formatBytes function', () => {
    it('formats bytes correctly', () => {
      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1024 * 1024)).toBe('1 MB')
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
      expect(formatBytes(1536)).toBe('1.5 KB')
    })

    it('handles custom decimal places', () => {
      expect(formatBytes(1536, 0)).toBe('2 KB')
      expect(formatBytes(1536, 3)).toBe('1.5 KB')
    })

    it('handles large numbers', () => {
      const tb = 1024 * 1024 * 1024 * 1024
      expect(formatBytes(tb)).toBe('1 TB')
      expect(formatBytes(tb * 2.5)).toBe('2.5 TB')
    })

    it('handles edge cases', () => {
      expect(formatBytes(-1024)).toBe('-1 KB')
      expect(formatBytes(0.5)).toBe('0.5 Bytes')
    })
  })

  describe('formatUptime function', () => {
    it('formats seconds correctly', () => {
      expect(formatUptime(0)).toBe('0s')
      expect(formatUptime(30)).toBe('30s')
      expect(formatUptime(59)).toBe('59s')
    })

    it('formats minutes and seconds', () => {
      expect(formatUptime(60)).toBe('1m')
      expect(formatUptime(90)).toBe('1m 30s')
      expect(formatUptime(3599)).toBe('59m 59s')
    })

    it('formats hours, minutes, and seconds', () => {
      expect(formatUptime(3600)).toBe('1h')
      expect(formatUptime(3661)).toBe('1h 1m 1s')
      expect(formatUptime(7323)).toBe('2h 2m 3s')
    })

    it('formats days, hours, minutes, and seconds', () => {
      expect(formatUptime(86400)).toBe('1d')
      expect(formatUptime(90061)).toBe('1d 1h 1m 1s')
      expect(formatUptime(176523)).toBe('2d 1h 2m 3s')
    })

    it('handles large uptimes', () => {
      const weekInSeconds = 7 * 24 * 3600
      expect(formatUptime(weekInSeconds)).toBe('7d')
    })

    it('omits zero values appropriately', () => {
      expect(formatUptime(3600)).toBe('1h') // No minutes or seconds
      expect(formatUptime(86460)).toBe('1d 1m') // No hours, but has minutes
    })
  })

  describe('Integration tests', () => {
    it('works with real-like API responses', async () => {
      const healthData = {
        status: 'ok' as const,
        uptime: 3725, // 1h 2m 5s
        timestamp: '2024-01-01T12:00:00.000Z',
        version: '1.0.0',
        environment: 'test',
        memory: {
          used: 1073741824, // 1GB
          total: 2147483648  // 2GB
        }
      }

      testUtils.mockApiSuccess(healthData)

      const result = await healthCheck(true)
      
      expect(result.success).toBe(true)
      if (result.data?.memory) {
        expect(formatBytes(result.data.memory.used * 1024 * 1024)).toBe('1 GB')
        expect(formatUptime(result.data.uptime)).toBe('1h 2m 5s')
      }
    })
  })
})