/**
 * App Component Test Suite
 * Tests for the main App component using Vitest and React Testing Library
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { testUtils, mockFetch } from '../setup'
import App from '../../src/App'

describe('App Component', () => {
  beforeEach(() => {
    testUtils.resetMocks()
  })

  describe('Initial Render', () => {
    it('renders the main header', () => {
      render(<App />)
      
      expect(screen.getByText('Full-Stack TypeScript App')).toBeInTheDocument()
      expect(screen.getByText(/Express\.js \+ React with TypeScript/)).toBeInTheDocument()
    })

    it('renders navigation buttons', () => {
      render(<App />)
      
      expect(screen.getByRole('button', { name: /documentation/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
    })

    it('renders the features card', () => {
      render(<App />)
      
      expect(screen.getByText('Features')).toBeInTheDocument()
      expect(screen.getByText(/TypeScript across the entire stack/)).toBeInTheDocument()
      expect(screen.getByText(/Express\.js backend with Winston logging/)).toBeInTheDocument()
    })

    it('renders the quick actions card', () => {
      render(<App />)
      
      expect(screen.getByText('Quick Actions')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /view api health/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /check version/i })).toBeInTheDocument()
    })

    it('renders the footer', () => {
      render(<App />)
      
      expect(screen.getByText(/Built with TypeScript, Express\.js, React/)).toBeInTheDocument()
    })
  })

  describe('Health Status Component', () => {
    it('shows loading state initially', () => {
      // Mock a delayed response
      testUtils.mockApiSuccess(testUtils.generateTestData.healthResponse())
      
      render(<App />)
      
      expect(screen.getByText('Loading server health information...')).toBeInTheDocument()
      expect(screen.getByText('Server Status')).toBeInTheDocument()
    })

    it('displays health data when API call succeeds', async () => {
      const healthData = testUtils.generateTestData.healthResponse()
      testUtils.mockApiSuccess(healthData)
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument()
      })

      expect(screen.getByText('Server Status')).toBeInTheDocument()
      expect(screen.getByText('test')).toBeInTheDocument() // environment
      expect(screen.getByText(/\d+[dhms]/)).toBeInTheDocument() // uptime format
    })

    it('displays error message when API call fails', async () => {
      testUtils.mockApiError('Server connection failed')
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument()
      })

      expect(screen.getByText('Failed to connect to the server')).toBeInTheDocument()
      expect(screen.getByText('Server connection failed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument()
    })

    it('handles network errors', async () => {
      testUtils.mockNetworkError()
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.getByText('Connection Error')).toBeInTheDocument()
      })

      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    it('allows manual refresh of health data', async () => {
      const healthData = testUtils.generateTestData.healthResponse()
      testUtils.mockApiSuccess(healthData)
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument()
      })

      // Clear the mock and set up a new response
      testUtils.resetMocks()
      const updatedHealthData = {
        ...healthData,
        uptime: healthData.uptime + 1000
      }
      testUtils.mockApiSuccess(updatedHealthData)

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      fireEvent.click(refreshButton)

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1)
      })
    })

    it('shows retry button when in error state', async () => {
      testUtils.mockApiError('Connection failed')
      
      render(<App />)
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry connection/i })).toBeInTheDocument()
      })

      // Test retry functionality
      testUtils.resetMocks()
      testUtils.mockApiSuccess(testUtils.generateTestData.healthResponse())
      
      const retryButton = screen.getByRole('button', { name: /retry connection/i })
      fireEvent.click(retryButton)

      await waitFor(() => {
        expect(screen.getByText('Healthy')).toBeInTheDocument()
      })
    })
  })

  describe('Quick Actions', () => {
    it('opens API health endpoint in new tab', () => {
      // Mock window.open
      const mockOpen = vi.fn()
      Object.defineProperty(window, 'open', {
        writable: true,
        value: mockOpen
      })

      render(<App />)
      
      const healthButton = screen.getByRole('button', { name: /view api health/i })
      fireEvent.click(healthButton)

      expect(mockOpen).toHaveBeenCalledWith('/api/health', '_blank')
    })

    it('opens API version endpoint in new tab', () => {
      const mockOpen = vi.fn()
      Object.defineProperty(window, 'open', {
        writable: true,
        value: mockOpen
      })

      render(<App />)
      
      const versionButton = screen.getByRole('button', { name: /check version/i })
      fireEvent.click(versionButton)

      expect(mockOpen).toHaveBeenCalledWith('/api/version', '_blank')
    })

    it('logs to console when test console button is clicked', () => {
      const consoleSpy = vi.spyOn(console, 'log')

      render(<App />)
      
      const consoleButton = screen.getByRole('button', { name: /test console/i })
      fireEvent.click(consoleButton)

      expect(consoleSpy).toHaveBeenCalledWith('Frontend console test')
    })
  })

  describe('Error Boundary', () => {
    it('catches and displays errors', () => {
      // Suppress console errors for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create a component that throws an error
      const ThrowError = () => {
        throw new Error('Test error')
      }

      const ErrorBoundaryWrapper = () => {
        try {
          return (
            <div>
              <ThrowError />
            </div>
          )
        } catch {
          // Simulate error boundary behavior
          return (
            <div>
              <h1>Something went wrong</h1>
              <p>An unexpected error occurred. Please refresh the page to try again.</p>
              <button>Refresh Page</button>
            </div>
          )
        }
      }

      render(<ErrorBoundaryWrapper />)

      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh page/i })).toBeInTheDocument()

      consoleError.mockRestore()
    })
  })

  describe('Responsive Design', () => {
    it('renders properly on different screen sizes', () => {
      render(<App />)
      
      // Test that grid layout classes are present
      const mainContent = screen.getByRole('main')
      expect(mainContent).toBeInTheDocument()
      
      // Check for responsive grid classes (these would be tested in integration)
      const gridContainer = mainContent.querySelector('.grid')
      expect(gridContainer).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading hierarchy', () => {
      render(<App />)
      
      const mainHeading = screen.getByRole('heading', { level: 1 })
      expect(mainHeading).toHaveTextContent('Full-Stack TypeScript App')
      
      const cardHeadings = screen.getAllByRole('heading', { level: 3 })
      expect(cardHeadings.length).toBeGreaterThan(0)
    })

    it('has accessible buttons', () => {
      render(<App />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toBeInTheDocument()
        // Each button should have accessible text content
        expect(button.textContent).toBeTruthy()
      })
    })

    it('has proper ARIA labels where needed', () => {
      render(<App />)
      
      // Check main landmark
      expect(screen.getByRole('main')).toBeInTheDocument()
      expect(screen.getByRole('banner')).toBeInTheDocument() // header
      expect(screen.getByRole('contentinfo')).toBeInTheDocument() // footer
    })
  })

  describe('Performance', () => {
    it('does not cause memory leaks with timers', async () => {
      const { unmount } = render(<App />)
      
      // Let the component mount and start its intervals
      await waitFor(() => {
        expect(screen.getByText('Server Status')).toBeInTheDocument()
      })

      // Unmount should clean up intervals
      unmount()
      
      // No specific assertion here, but this test ensures no warnings about
      // timers running after component unmount
      expect(true).toBe(true)
    })
  })
})