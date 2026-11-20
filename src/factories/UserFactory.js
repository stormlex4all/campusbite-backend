'use strict';

const Config = require('../config');
const ErrorFactory = require('../core/errors/ErrorFactory');
const passwordHasher = require('../utils/passwordHasher');
const { ROLES, USER_STATUSES } = require('../constants');

/**
 * UserFactory (Factory pattern)
 * -----------------------------
 * Builds an *unsaved* User for each role. Every role has its own creation rules:
 *
 *   student  - must use a configured school email domain, active immediately
 *   vendor   - provisioned by the team; pending until approved (or active when provisioned as approved)
 *   admin    - created by the seed script / another admin
 *
 * Callers save the returned document (`await user.save()`).
 */
class UserFactory {
  static #creators = {
    [ROLES.STUDENT]: UserFactory.#student,
    [ROLES.VENDOR]: UserFactory.#vendor,
    [ROLES.ADMIN]: UserFactory.#admin,
  };

  /**
   * @param {'student'|'vendor'|'admin'} role
   * @param {{name: string, email: string, password: string, status?: string}} input
   */
  static async create(role, input) {
    const creator = UserFactory.#creators[role];
    if (!creator) throw ErrorFactory.badRequest(`Unknown role "${role}".`, { code: 'UNKNOWN_ROLE' });
    const User = require('../modules/users/user.model');
    const fields = await creator(input);
    return new User(fields);
  }

  static async #base(role, { name, email, password }, status) {
    return {
      name: String(name).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash: await passwordHasher.hash(password),
      role,
      status,
    };
  }

  static async #student(input) {
    const email = String(input.email).trim().toLowerCase();
    const domains = Config.get().auth.schoolEmailDomains;
    const domain = email.split('@')[1];
    if (!domain || !domains.includes(domain)) {
      throw ErrorFactory.unprocessable(
        `Please register with your school email address (${domains.map((d) => `@${d}`).join(' or ')}).`,
        { code: 'EMAIL_DOMAIN_NOT_ALLOWED' },
      );
    }
    return UserFactory.#base(ROLES.STUDENT, input, USER_STATUSES.ACTIVE);
  }

  static async #vendor(input) {
    const status = input.status === USER_STATUSES.ACTIVE ? USER_STATUSES.ACTIVE : USER_STATUSES.PENDING;
    return UserFactory.#base(ROLES.VENDOR, input, status);
  }

  static async #admin(input) {
    return UserFactory.#base(ROLES.ADMIN, input, USER_STATUSES.ACTIVE);
  }
}

module.exports = UserFactory;
