'use strict';

const Config = require('../config');
const Logger = require('../core/Logger');
const ErrorFactory = require('../core/errors/ErrorFactory');

const notFound = (req, res, next) => next(ErrorFactory.notFound(`Route ${req.method} ${req.originalUrl.split('?')[0]}`));

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const appError = ErrorFactory.normalize(err);

  if (!appError.isOperational) {
    Logger.getInstance().error(`Unhandled error on ${req.method} ${req.originalUrl}`, appError.cause || err);
  }

  const safeMessage = Config.get().isProduction ? 'Something went wrong on our side.' : appError.cause?.message || appError.message;
  const body = {
    success: false,
    error: {
      code: appError.code,
      message: appError.isOperational ? appError.message : safeMessage,
    },
  };
  if (appError.details !== undefined && appError.isOperational) body.error.details = appError.details;

  res.status(appError.statusCode).json(body);
};

module.exports = { notFound, errorHandler };
