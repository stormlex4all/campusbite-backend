'use strict';

const Database = require('../../core/Database');
const EventBus = require('../../core/EventBus');
const EVENTS = require('../../core/events');
const ErrorFactory = require('../../core/errors/ErrorFactory');
const UserFactory = require('../../factories/UserFactory');
const { escapeRegex } = require('../../utils/text');
const { toPageWindow, pageMeta } = require('../../utils/pagination');
const User = require('../users/user.model');
const Vendor = require('../vendors/vendor.model');
const AuditLog = require('./auditLog.model');
const tokenService = require('../auth/token.service');
const { ROLES, USER_STATUSES } = require('../../constants');

const snapshot = (user) => ({ id: String(user._id), name: user.name, email: user.email, role: user.role });

async function loadUser(id) {
  const user = await User.findById(id);
  if (!user) throw ErrorFactory.notFound('User');
  return user;
}

const publish = (name, actor, target, details) =>
  EventBus.getInstance().publish(name, { actor: snapshot(actor), target: snapshot(target), details });

/** Feature 13: administrators manage vendor and student accounts. Every action is audited via events. */
const adminService = {
  async listUsers({ role, status, q, page, limit }) {
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const pattern = new RegExp(escapeRegex(q), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    const window = toPageWindow({ page, limit });
    const [users, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip(window.skip).limit(window.limit),
      User.countDocuments(filter),
    ]);
    const stores = await Vendor.find({ owner: { $in: users.filter((u) => u.role === ROLES.VENDOR).map((u) => u._id) } });
    const storeByOwner = new Map(stores.map((s) => [String(s.owner), s]));
    const items = users.map((u) => ({ ...u.toJSON(), store: storeByOwner.get(String(u._id))?.toJSON() ?? null }));
    return { items, meta: pageMeta(total, window) };
  },

  async getUser(id) {
    const user = await loadUser(id);
    const store = user.role === ROLES.VENDOR ? await Vendor.findOne({ owner: user._id }) : null;
    return { ...user.toJSON(), store: store ? store.toJSON() : null };
  },

  /** The team creates approved vendor accounts (login + store profile) here. */
  async provisionVendor(actor, { name, email, password, status, store }) {
    const user = await UserFactory.create(ROLES.VENDOR, { name, email, password, status });
    let vendor;
    try {
      vendor = await Database.getInstance().withTransaction(async (session) => {
        await user.save({ session });
        const [created] = await Vendor.create(
          [{ owner: user._id, ...store, isActive: user.status === USER_STATUSES.ACTIVE }],
          { session },
        );
        return created;
      });
    } catch (err) {
      if (err.code === 11000) {
        throw ErrorFactory.conflict('An account with this email already exists.', { code: 'EMAIL_TAKEN' });
      }
      throw err;
    }
    await publish(EVENTS.ADMIN_VENDOR_PROVISIONED, actor, user, { storeName: vendor.storeName, status: user.status });
    return { ...user.toJSON(), store: vendor.toJSON() };
  },

  /** pending vendor -> active */
  async approve(actor, id) {
    const user = await loadUser(id);
    if (user.role !== ROLES.VENDOR) {
      throw ErrorFactory.unprocessable('Only vendor accounts need approval.', { code: 'APPROVAL_NOT_APPLICABLE' });
    }
    if (user.status !== USER_STATUSES.PENDING) {
      throw ErrorFactory.conflict('This account is not waiting for approval.', { code: 'NOT_PENDING' });
    }
    const updated = await User.findOneAndUpdate(
      { _id: user._id, status: USER_STATUSES.PENDING },
      { $set: { status: USER_STATUSES.ACTIVE, statusChangedAt: new Date(), statusChangedBy: actor._id } },
      { returnDocument: 'after' },
    );
    if (!updated) throw ErrorFactory.conflict('This account was just changed. Refresh and try again.', { code: 'STALE_STATE' });
    await Vendor.updateOne({ owner: user._id }, { $set: { isActive: true } });
    await publish(EVENTS.ADMIN_USER_APPROVED, actor, updated);
    return updated;
  },

  /**
   * Suspended users cannot sign in. Active
   * sessions end at once because `authenticate` checks the status on every request, and refresh
   * tokens are revoked.
   */
  async suspend(actor, id, reason) {
    const user = await loadUser(id);
    if (String(user._id) === String(actor._id)) {
      throw ErrorFactory.forbidden('You cannot suspend your own account.', { code: 'CANNOT_SUSPEND_SELF' });
    }
    if (user.role === ROLES.ADMIN) {
      throw ErrorFactory.forbidden('Administrator accounts cannot be suspended from here.', { code: 'CANNOT_SUSPEND_ADMIN' });
    }
    if (user.status === USER_STATUSES.SUSPENDED) {
      throw ErrorFactory.conflict('This account is already suspended.', { code: 'ALREADY_SUSPENDED' });
    }
    const updated = await User.findOneAndUpdate(
      { _id: user._id, status: { $ne: USER_STATUSES.SUSPENDED } },
      {
        $set: {
          status: USER_STATUSES.SUSPENDED,
          statusBeforeSuspension: user.status,
          statusReason: reason,
          statusChangedAt: new Date(),
          statusChangedBy: actor._id,
        },
      },
      { returnDocument: 'after' },
    );
    if (!updated) throw ErrorFactory.conflict('This account is already suspended.', { code: 'ALREADY_SUSPENDED' });
    await Vendor.updateOne({ owner: user._id }, { $set: { isActive: false } });
    await tokenService.revokeAllForUser(user._id);
    await publish(EVENTS.ADMIN_USER_SUSPENDED, actor, updated, { reason });
    return updated;
  },

  async reactivate(actor, id) {
    const user = await loadUser(id);
    if (user.status !== USER_STATUSES.SUSPENDED) {
      throw ErrorFactory.conflict('This account is not suspended.', { code: 'NOT_SUSPENDED' });
    }
    const restoreTo = user.statusBeforeSuspension || USER_STATUSES.ACTIVE;
    const updated = await User.findOneAndUpdate(
      { _id: user._id, status: USER_STATUSES.SUSPENDED },
      {
        $set: { status: restoreTo, statusChangedAt: new Date(), statusChangedBy: actor._id },
        $unset: { statusReason: '', statusBeforeSuspension: '' },
      },
      { returnDocument: 'after' },
    );
    if (!updated) throw ErrorFactory.conflict('This account was just changed. Refresh and try again.', { code: 'STALE_STATE' });
    await Vendor.updateOne({ owner: user._id }, { $set: { isActive: restoreTo === USER_STATUSES.ACTIVE } });
    await publish(EVENTS.ADMIN_USER_REACTIVATED, actor, updated, { restoredStatus: restoreTo });
    return updated;
  },

  async listAuditLogs({ action, target, page, limit }) {
    const filter = {};
    if (action) filter.action = action;
    if (target) filter['target.id'] = target;
    const window = toPageWindow({ page, limit });
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(window.skip).limit(window.limit),
      AuditLog.countDocuments(filter),
    ]);
    return { items, meta: pageMeta(total, window) };
  },
};

module.exports = adminService;
