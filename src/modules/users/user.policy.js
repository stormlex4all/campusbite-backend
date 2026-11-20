'use strict';

const ErrorFactory = require('../../core/errors/ErrorFactory');
const { USER_STATUSES } = require('../../constants');

/**
 * Account status rule shared by sign-in and the authenticate middleware, so a
 * suspended user is stopped at login and on every later request (Feature 13).
 */
function assertAccountUsable(user) {
  if (user.status === USER_STATUSES.SUSPENDED) {
    throw ErrorFactory.forbidden('Your account has been suspended. Please contact campus food services.', {
      code: 'ACCOUNT_SUSPENDED',
    });
  }
  if (user.status === USER_STATUSES.PENDING) {
    throw ErrorFactory.forbidden('Your account is waiting for approval by an administrator.', {
      code: 'ACCOUNT_PENDING',
    });
  }
}

module.exports = { assertAccountUsable };
