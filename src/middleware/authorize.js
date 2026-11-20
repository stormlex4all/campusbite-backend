'use strict';

const ErrorFactory = require('../core/errors/ErrorFactory');

/** Role-based access control: `authorize('vendor')`, `authorize('admin', 'vendor')`. */
const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return next(ErrorFactory.unauthorized('Authentication required.'));
    if (!roles.includes(req.user.role)) {
      return next(ErrorFactory.forbidden('You do not have access to this area.', { code: 'ROLE_NOT_ALLOWED' }));
    }
    return next();
  };

module.exports = authorize;
