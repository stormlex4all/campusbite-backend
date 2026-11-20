'use strict';

const ErrorFactory = require('../../core/errors/ErrorFactory');
const { escapeRegex } = require('../../utils/text');
const { toPageWindow, pageMeta } = require('../../utils/pagination');
const Vendor = require('./vendor.model');

const vendorService = {
  /** Students browse participating stores (only stores whose owner account is active). */
  async listPublic({ q, page, limit }) {
    const window = toPageWindow({ page, limit });
    const filter = { isActive: true };
    if (q) filter.storeName = new RegExp(escapeRegex(q), 'i');
    const [items, total] = await Promise.all([
      Vendor.find(filter).sort({ storeName: 1 }).skip(window.skip).limit(window.limit),
      Vendor.countDocuments(filter),
    ]);
    return { items, meta: pageMeta(total, window) };
  },

  /** A store page (only while the owner account is active). */
  async getPublic(id) {
    const vendor = await Vendor.findOne({ _id: id, isActive: true });
    if (!vendor) throw ErrorFactory.notFound('Store');
    return vendor;
  },

  /** Vendors edit their own store profile. */
  async updateProfile(vendor, patch) {
    vendor.set(patch);
    await vendor.save();
    return vendor;
  },
};

module.exports = vendorService;
