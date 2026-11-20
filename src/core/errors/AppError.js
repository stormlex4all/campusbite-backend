'use strict';

/** An error the API can safely describe to the client (validation, not found, ...). */
class AppError extends Error {
  /**
   * @param {string} message human readable, safe to show to users
   * @param {{statusCode?: number, code?: string, details?: any, isOperational?: boolean}} [options]
   */
  constructor(message, { statusCode = 500, code = 'INTERNAL_ERROR', details, isOperational = true } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

module.exports = AppError;
