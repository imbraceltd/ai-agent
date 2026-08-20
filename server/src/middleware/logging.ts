import morgan, { StreamOptions } from 'morgan';
import logger from '@/lib/logger';

/**
 * Morgan middleware configuration with Winston integration
 * Logs HTTP requests using Winston's http log level
 */

// Stream configuration for Morgan to use Winston
const stream: StreamOptions = {
  write: (message: string) => logger.http(message.trim()),
};

// Skip logging during testing
const skip = (): boolean => {
  const env = process.env['NODE_ENV'] || 'development';
  return env === 'test';
};

// Morgan middleware configuration
const morganMiddleware = morgan(
  // Format: method url status content-length - response-time ms
  ':method :url :status :res[content-length] - :response-time ms',
  { 
    stream,
    skip 
  }
);

// Additional detailed Morgan middleware for development
const morganDetailedMiddleware = morgan(
  // More detailed format for development debugging
  ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
  {
    stream,
    skip: () => process.env['NODE_ENV'] === 'production'
  }
);

/**
 * Error logging middleware
 * Logs errors with full stack traces
 */
const errorLogger = (error: Error, req: any, _res: any, next: any): void => {
  logger.error('Express Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });
  next(error);
};

/**
 * Request logging middleware
 * Logs incoming requests with additional context
 */
const requestLogger = (req: any, _res: any, next: any): void => {
  logger.info('Incoming Request:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    body: req.method === 'POST' || req.method === 'PUT' ? req.body : undefined
  });
  next();
};

export {
  morganMiddleware,
  morganDetailedMiddleware,
  errorLogger,
  requestLogger
};