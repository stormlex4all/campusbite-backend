'use strict';

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Config = require('../../config');
const ErrorFactory = require('../../core/errors/ErrorFactory');
const RefreshToken = require('./refreshToken.model');
const User = require('../users/user.model');
const { assertAccountUsable } = require('../users/user.policy');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/**
 * Short-lived JWT access tokens + long-lived, rotating, revocable refresh tokens.
 * Both the React app and the React Native app use the same flow:
 *   1. sign in -> { accessToken, refreshToken }
 *   2. send  Authorization: Bearer <accessToken>
 *   3. on 401 TOKEN_EXPIRED call POST /api/auth/refresh with the refresh token
 */
const tokenService = {
  signAccessToken(user) {
    const { accessSecret, accessTtl, issuer } = Config.get().auth;
    return jwt.sign({ role: user.role }, accessSecret, {
      subject: String(user._id),
      expiresIn: accessTtl,
      issuer,
    });
  },

  verifyAccessToken(token) {
    const { accessSecret, issuer } = Config.get().auth;
    try {
      return jwt.verify(token, accessSecret, { issuer });
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw ErrorFactory.unauthorized('Your session has expired. Please sign in again.', { code: 'TOKEN_EXPIRED' });
      }
      throw ErrorFactory.unauthorized('Invalid authentication token.', { code: 'INVALID_TOKEN' });
    }
  },

  async issueTokenPair(user, { userAgent } = {}) {
    const accessToken = tokenService.signAccessToken(user);
    const decoded = jwt.decode(accessToken);
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + Config.get().auth.refreshTtlDays * 24 * 60 * 60 * 1000);
    await RefreshToken.create({
      user: user._id,
      tokenHash: sha256(refreshToken),
      expiresAt,
      userAgent: userAgent ? String(userAgent).slice(0, 200) : undefined,
    });
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: decoded.exp - decoded.iat,
      refreshTokenExpiresAt: expiresAt,
    };
  },

  /** Exchange a refresh token for a new pair. The old refresh token is revoked (rotation). */
  async rotate(rawRefreshToken, meta) {
    const invalid = () =>
      ErrorFactory.unauthorized('Your session is no longer valid. Please sign in again.', { code: 'INVALID_REFRESH_TOKEN' });
    const stored = await RefreshToken.findOne({ tokenHash: sha256(rawRefreshToken) });
    if (!stored || stored.expiresAt <= new Date()) throw invalid();

    if (stored.revokedAt) {
      // A revoked token was presented again: assume it leaked and end every session of this user.
      await tokenService.revokeAllForUser(stored.user);
      throw invalid();
    }

    const user = await User.findById(stored.user);
    if (!user) throw invalid();
    assertAccountUsable(user);

    // Atomic revoke so two simultaneous refreshes cannot both succeed
    const revoked = await RefreshToken.findOneAndUpdate(
      { _id: stored._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    if (!revoked) throw invalid();

    return { user, tokens: await tokenService.issueTokenPair(user, meta) };
  },

  async revoke(rawRefreshToken) {
    await RefreshToken.updateOne(
      { tokenHash: sha256(rawRefreshToken), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
  },

  async revokeAllForUser(userId) {
    await RefreshToken.updateMany({ user: userId, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
  },
};

module.exports = tokenService;
