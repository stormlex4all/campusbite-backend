'use strict';

const asyncHandler = require('../core/http/asyncHandler');
const ErrorFactory = require('../core/errors/ErrorFactory');
const tokenService = require('../modules/auth/token.service');
const User = require('../modules/users/user.model');
const { assertAccountUsable } = require('../modules/users/user.policy');

/**
 * Requires `Authorization: Bearer <accessToken>`.
 * The user is loaded from the database on every request so a suspension takes effect
 * immediately, not when the token expires.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) throw ErrorFactory.unauthorized('Authentication required.');

  const payload = tokenService.verifyAccessToken(token);
  const user = await User.findById(payload.sub);
  if (!user) throw ErrorFactory.unauthorized('Invalid authentication token.', { code: 'INVALID_TOKEN' });
  assertAccountUsable(user);

  req.user = user;
  next();
});

module.exports = authenticate;
