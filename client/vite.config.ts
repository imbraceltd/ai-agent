import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },

  server: {
    port: 6789, // Development server port as specified in PRP
    host: true, // Allow external connections

    // CRITICAL: Proxy configuration for API requests
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const url = (req as any)?.url || '';
            const target = (options as any)?.target || '';
            console.log('🚀 Proxying API request:', req.method, url, '→', target + url);
          });
        }
      },
      '/appgateway': {
        target: process.env.VITE_APP_GATEWAY_URL || 'http://localhost:9001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const url = (req as any)?.url || '';
            const target = (options as any)?.target || '';
            console.log('🚀 Proxying AppGateway request:', req.method, url, '→', target + url);
          });
        },
        rewrite: (path) => {
          const newPath = path.replace(/^\/appgateway/, '');
          console.log('🔄 AppGateway rewrite:', path, '→', newPath);
          return newPath;
        }
      },
      '/imbrace': {
        target: process.env.VITE_APP_API_URL || 'http://localhost:9001',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const url = (req as any)?.url || '';
            const target = (options as any)?.target || '';
            console.log('🚀 Proxying request:', req.method, url, '→', target + url.replace(/^\/imbrace/, ''));
          });
        },
        rewrite: (path) => {
          // Remove /imbrace prefix from path for backend API
          const newPath = path.replace(/^\/imbrace/, '');
          console.log('🔄 Proxy rewrite:', path, '→', newPath);
          return newPath;
        }
      }
    }
  },

  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize bundle size
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react']
        }
      }
    }
  },

  // Environment variables prefix
  envPrefix: 'VITE_',

  // Preview server configuration (for production preview)
  preview: {
    port: 6789,
    host: true
  }
});