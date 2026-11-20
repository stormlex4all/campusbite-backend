'use strict';

const rateLimit = require('express-rate-limit');
const Config = require('../config');
const ErrorFactory = require('../core/errors/ErrorFactory');

/** Brute-force protection for sign-in / register / refresh. */
const authLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: Config.get().auth.rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res, next) =>
      next(ErrorFactory.tooManyRequests('Too many attempts. Please wait a few minutes and try again.')),
  });

module.exports = { authLimiter };
