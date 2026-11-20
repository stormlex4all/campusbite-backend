'use strict';

const ErrorFactory = require('../../core/errors/ErrorFactory');
const UserFactory = require('../../factories/UserFactory');
const passwordHasher = require('../../utils/passwordHasher');
const User = require('../users/user.model');
const Vendor = require('../vendors/vendor.model');
const { assertAccountUsable } = require('../users/user.policy');
const tokenService = require('./token.service');
const { ROLES } = require('../../constants');

// Compared against when the email is unknown so response time does not reveal which emails exist
let dummyHash = null;
const getDummyHash = () => (dummyHash ||= passwordHasher.hash('not-a-real-password-0'));

const authService = {
  async register({ name, email, password }, meta) {
    const user = await UserFactory.create(ROLES.STUDENT, { name, email, password });
    try {
      await user.save();
    } catch (err) {
      if (err.code === 11000) {
        throw ErrorFactory.conflict('An account with this email already exists.', { code: 'EMAIL_TAKEN' });
      }
      throw err;
    }
    return { user, tokens: await tokenService.issueTokenPair(user, meta) };
  },

  async login({ email, password }, meta) {
    const user = await User.findOne({ email }).select('+passwordHash');
    const matches = await passwordHasher.compare(password, user ? user.passwordHash : await getDummyHash());
    if (!user || !matches) {
      throw ErrorFactory.unauthorized('Incorrect email or password.', { code: 'INVALID_CREDENTIALS' });
    }
    assertAccountUsable(user);

    user.lastLoginAt = new Date();
    await user.save();
    return { user, tokens: await tokenService.issueTokenPair(user, meta) };
  },

  refresh(refreshToken, meta) {
    return tokenService.rotate(refreshToken, meta);
  },

  async logout(refreshToken) {
    await tokenService.revoke(refreshToken);
  },

  /** The signed-in user plus, for vendors, their store profile. */
  async profileOf(user) {
    const profile = { user };
    if (user.role === ROLES.VENDOR) profile.vendor = await Vendor.findOne({ owner: user._id });
    return profile;
  },

  async updateName(user, name) {
    user.name = name;
    await user.save();
    return user;
  },

  async changePassword(user, { currentPassword, newPassword }, meta) {
    const withHash = await User.findById(user._id).select('+passwordHash');
    if (!(await passwordHasher.compare(currentPassword, withHash.passwordHash))) {
      throw ErrorFactory.unauthorized('Current password is incorrect.', { code: 'INVALID_CREDENTIALS' });
    }
    withHash.passwordHash = await passwordHasher.hash(newPassword);
    await withHash.save();
    await tokenService.revokeAllForUser(user._id); // sign out every other device
    return tokenService.issueTokenPair(withHash, meta);
  },
};

module.exports = authService;
