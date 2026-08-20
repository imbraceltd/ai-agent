/**
 * Health check script for Docker container
 * This script performs a simple HTTP request to the health endpoint
 */

import http from 'http';

const options = {
  hostname: 'localhost',
  port: process.env['PORT'] || 3000,
  path: '/health',
  method: 'GET',
  timeout: 2000
};

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    console.log('Health check passed');
    process.exit(0);
  } else {
    console.log('Health check failed');
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.error('Health check error:', err.message);
  process.exit(1);
});

healthCheck.on('timeout', () => {
  console.error('Health check timeout');
  healthCheck.destroy();
  process.exit(1);
});

healthCheck.end();