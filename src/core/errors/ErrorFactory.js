'use strict';

const AppError = require('./AppError');

/**
 * ErrorFactory (Factory pattern)
 * ------------------------------
 * The one place that knows which HTTP status and error code belongs to which kind of
 * problem. Services say *what* went wrong (`ErrorFactory.conflict(...)`), the factory
 * decides *how* it is represented, and the error middleware turns it into JSON.
 */
const KINDS = Object.freeze({
  BAD_REQUEST: { statusCode: 400, code: 'BAD_REQUEST', message: 'The request could not be understood.' },
  VALIDATION: { statusCode: 400, code: 'VALIDATION_ERROR', message: 'Some of the information provided is not valid.' },
  UNAUTHORIZED: { statusCode: 401, code: 'UNAUTHORIZED', message: 'Authentication required.' },
  FORBIDDEN: { statusCode: 403, code: 'FORBIDDEN', message: 'You do not have permission to do that.' },
  NOT_FOUND: { statusCode: 404, code: 'NOT_FOUND', message: 'The requested resource was not found.' },
  CONFLICT: { statusCode: 409, code: 'CONFLICT', message: 'This action conflicts with the current state.' },
  PAYLOAD_TOO_LARGE: { statusCode: 413, code: 'PAYLOAD_TOO_LARGE', message: 'The file is too large.' },
  UNPROCESSABLE: { statusCode: 422, code: 'UNPROCESSABLE', message: 'The request is valid but cannot be processed.' },
  TOO_MANY_REQUESTS: { statusCode: 429, code: 'TOO_MANY_REQUESTS', message: 'Too many requests. Please try again later.' },
  INTERNAL: { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Something went wrong on our side.' },
});

class ErrorFactory {
  static KINDS = KINDS;

  /**
   * Generic factory method.
   * @param {keyof typeof KINDS} kind
   * @param {string} [message] overrides the default message
   * @param {{code?: string, details?: any}} [options] `code` overrides the default machine readable code
   */
  static create(kind, message, { code, details } = {}) {
    const base = KINDS[kind];
    if (!base) throw new Error(`Unknown error kind "${kind}"`);
    return new AppError(message || base.message, {
      statusCode: base.statusCode,
      code: code || base.code,
      details,
      isOperational: kind !== 'INTERNAL',
    });
  }

  static badRequest(message, options) {
    return ErrorFactory.create('BAD_REQUEST', message, options);
  }

  static validation(details, message) {
    return ErrorFactory.create('VALIDATION', message, { details });
  }

  static unauthorized(message, options) {
    return ErrorFactory.create('UNAUTHORIZED', message, options);
  }

  static forbidden(message, options) {
    return ErrorFactory.create('FORBIDDEN', message, options);
  }

  static notFound(resource = 'Resource', options) {
    return ErrorFactory.create('NOT_FOUND', `${resource} not found.`, options);
  }

  static conflict(message, options) {
    return ErrorFactory.create('CONFLICT', message, options);
  }

  static payloadTooLarge(message, options) {
    return ErrorFactory.create('PAYLOAD_TOO_LARGE', message, options);
  }

  static unprocessable(message, options) {
    return ErrorFactory.create('UNPROCESSABLE', message, options);
  }

  static tooManyRequests(message, options) {
    return ErrorFactory.create('TOO_MANY_REQUESTS', message, options);
  }

  static internal(message, options) {
    return ErrorFactory.create('INTERNAL', message, options);
  }

  /** Build a VALIDATION error from a Zod error. `source` is body | query | params. */
  static fromZod(zodError, source = 'body') {
    return ErrorFactory.validation(ErrorFactory.zodDetails(zodError, source));
  }

  static zodDetails(zodError, source = 'body') {
    return zodError.issues.map((issue) => ({
      source,
      field: issue.path.join('.') || '(root)',
      message: issue.message,
    }));
  }

  /**
   * Convert anything thrown anywhere into an AppError.
   * Unknown errors become non-operational INTERNAL errors whose details are never sent to clients.
   */
  static normalize(err) {
    if (err instanceof AppError) return err;

    if (err?.name === 'ZodError' && Array.isArray(err.issues)) return ErrorFactory.fromZod(err);

    // Body parser errors
    if (err?.type === 'entity.parse.failed') return ErrorFactory.badRequest('Malformed JSON in the request body.');
    if (err?.type === 'entity.too.large') {
      return new AppError('The request body is too large.', { statusCode: 413, code: 'PAYLOAD_TOO_LARGE' });
    }

    // Mongoose / MongoDB
    if (err?.name === 'CastError') {
      return ErrorFactory.badRequest(`Invalid value for "${err.path}".`, { code: 'INVALID_ID' });
    }
    if (err?.name === 'ValidationError' && err.errors) {
      const details = Object.values(err.errors).map((e) => ({ source: 'body', field: e.path, message: e.message }));
      return ErrorFactory.validation(details);
    }
    if (err?.code === 11000) {
      const fields = Object.keys(err.keyPattern || err.keyValue || {});
      return ErrorFactory.conflict(
        fields.length ? `A record with this ${fields.join(', ')} already exists.` : 'A duplicate record already exists.',
        { code: 'DUPLICATE_KEY', details: fields.map((field) => ({ field })) },
      );
    }

    const wrapped = ErrorFactory.internal(undefined, {});
    wrapped.cause = err;
    return wrapped;
  }
}

module.exports = ErrorFactory;
