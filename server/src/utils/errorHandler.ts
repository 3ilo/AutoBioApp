import logger from './logger';

export class AppError extends Error {
  statusCode: number;
  status: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Define the error response type
interface ErrorResponse {
  status: string;
  message: string;
  statusCode: number;
  errors?: string[];
}

// Base error handler interface
interface ErrorHandler {
  handle(error: Error): ErrorResponse;
}

// MongoDB specific error handler
class MongoDBErrorHandler implements ErrorHandler {
  handle(error: Error): ErrorResponse {
    if (error.name === 'ValidationError') {
      const errors = Object.values((error as any).errors).map((el: any) => el.message);
      return {
        status: 'fail',
        message: 'Validation Error',
        statusCode: 400,
        errors,
      };
    }

    if ((error as any).code === 11000) {
      return {
        status: 'fail',
        message: 'Duplicate field value',
        statusCode: 400,
      };
    }

    throw error; // Let the base handler deal with unknown MongoDB errors
  }
}

// JWT specific error handler
class JWTErrorHandler implements ErrorHandler {
  handle(error: Error): ErrorResponse {
    if (error.name === 'JsonWebTokenError') {
      return {
        status: 'fail',
        message: 'Invalid token. Please log in again!',
        statusCode: 401,
      };
    }

    if (error.name === 'TokenExpiredError') {
      return {
        status: 'fail',
        message: 'Your token has expired! Please log in again.',
        statusCode: 401,
      };
    }

    throw error; // Let the base handler deal with unknown JWT errors
  }
}

// Base error handler implementation
class BaseErrorHandler implements ErrorHandler {
  handle(error: Error): ErrorResponse {
    if (error instanceof AppError) {
      return {
        status: error.status,
        message: error.message,
        statusCode: error.statusCode,
      };
    }

    // Log unexpected errors with full stack trace
    logger.error('Unexpected error occurred', { 
      error: error.message, 
      stack: error.stack,
      name: error.name 
    });

    return {
      status: 'error',
      message: 'Something went wrong!',
      statusCode: 500,
    };
  }
}

// Error handler factory
class ErrorHandlerFactory {
  private handlers: ErrorHandler[];

  constructor() {
    this.handlers = [
      new MongoDBErrorHandler(),
      new JWTErrorHandler(),
      new BaseErrorHandler(),
    ];
  }

  handle(error: Error): ErrorResponse {
    for (const handler of this.handlers) {
      try {
        return handler.handle(error);
      } catch (e) {
        continue; // Try next handler
      }
    }
    // If no handler could process the error, use base handler
    return new BaseErrorHandler().handle(error);
  }
}

// Create singleton instance
const errorHandlerFactory = new ErrorHandlerFactory();

// Export the error handling middleware
export const handleError = (err: Error, req: any, res: any, next: any) => {
  const errorResponse = errorHandlerFactory.handle(err);
  
  return res.status(errorResponse.statusCode).json(errorResponse);
}; 