/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  test: {
    // Environment configuration
    environment: 'jsdom',
    
    // Setup files
    setupFiles: ['./tests/setup.ts'],
    
    // Global test configuration
    globals: true,
    
    // Include/exclude patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', 'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', '.git', '.cache'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/vite.config.*',
        '**/vitest.config.*'
      ]
    },
    
    // Test timeout
    testTimeout: 10000,
    
    // Watch mode configuration
    watch: false,
    
    // Reporter configuration
    reporter: ['verbose'],
    
    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true
  }
})