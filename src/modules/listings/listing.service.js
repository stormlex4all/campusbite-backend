'use strict';

const ErrorFactory = require('../../core/errors/ErrorFactory');
const { toPageWindow, pageMeta } = require('../../utils/pagination');
const { toCents } = require('../../utils/money');
const { LISTING_SOURCES, LISTING_STATUSES, MENU_ITEM_STATUSES } = require('../../constants');
const Vendor = require('../vendors/vendor.model');
const MenuItem = require('../menu/menuItem.model');
const Listing = require('./listing.model');

const listingService = {
  /** Create a listing from a saved menu item, or as a one-off item. */
  async create(vendor, body, now = new Date()) {
    if (body.pickupEnd <= now) {
      throw ErrorFactory.unprocessable('The pickup window has already ended. Choose a time in the future.', { code: 'PICKUP_WINDOW_IN_PAST' });
    }

    const base = {
      vendor: vendor._id,
      quantityTotal: body.quantityTotal,
      quantityAvailable: body.quantityTotal,
      pickupStart: body.pickupStart,
      pickupEnd: body.pickupEnd,
    };

    if (body.source === LISTING_SOURCES.MENU_ITEM) {
      const item = await MenuItem.findOne({ _id: body.menuItemId, vendor: vendor._id });
      if (!item) throw ErrorFactory.notFound('Menu item');
      if (item.status === MENU_ITEM_STATUSES.ARCHIVED) {
        throw ErrorFactory.conflict('This menu item is archived. Restore it before creating a listing from it.', { code: 'MENU_ITEM_ARCHIVED' });
      }
      return Listing.create({
        ...base,
        source: LISTING_SOURCES.MENU_ITEM,
        menuItem: item._id,
        title: item.name, // copied: later edits to the menu item do not change this listing
        description: item.description,
        priceCents: body.price !== undefined ? toCents(body.price) : item.defaultPriceCents,
        images: item.images.map(({ key, alt }) => ({ key, alt })),
      });
    }

    return Listing.create({
      ...base,
      source: LISTING_SOURCES.ONE_OFF,
      title: body.title,
      description: body.description,
      priceCents: toCents(body.price),
    });
  },

  async listForVendor(vendor, { status = 'active', page, limit }) {
    const window = toPageWindow({ page, limit });
    const filter = { vendor: vendor._id };
    if (status !== 'all') filter.status = status;
    const [items, total] = await Promise.all([
      Listing.find(filter).sort({ pickupStart: -1 }).skip(window.skip).limit(window.limit),
      Listing.countDocuments(filter),
    ]);
    return { items, meta: pageMeta(total, window) };
  },

  async getOwned(vendor, id) {
    const listing = await Listing.findOne({ _id: id, vendor: vendor._id });
    if (!listing) throw ErrorFactory.notFound('Listing');
    return listing;
  },

  /** Close early (stops showing to students). Idempotent. */
  async close(vendor, id) {
    const listing = await listingService.getOwned(vendor, id);
    if (listing.status !== LISTING_STATUSES.CLOSED) {
      listing.status = LISTING_STATUSES.CLOSED;
      await listing.save();
    }
    return listing;
  },

  /** Show a closed listing again, as long as its pickup window has not ended. Idempotent. */
  async reopen(vendor, id, now = new Date()) {
    const listing = await listingService.getOwned(vendor, id);
    if (listing.status === LISTING_STATUSES.ACTIVE) return listing;
    if (listing.pickupEnd <= now) {
      throw ErrorFactory.conflict('This pickup window has ended, so the listing cannot be reopened. Create a new listing instead.', { code: 'LISTING_ENDED' });
    }
    listing.status = LISTING_STATUSES.ACTIVE;
    await listing.save();
    return listing;
  },

  /** What students can see for a store: live listings only, soonest pickup first. */
  async listLiveForStore(storeId, { page, limit }, now = new Date()) {
    const store = await Vendor.findOne({ _id: storeId, isActive: true });
    if (!store) throw ErrorFactory.notFound('Store');
    const window = toPageWindow({ page, limit });
    const filter = { vendor: store._id, status: LISTING_STATUSES.ACTIVE, pickupEnd: { $gt: now }, quantityAvailable: { $gt: 0 } };
    const [items, total] = await Promise.all([
      Listing.find(filter).sort({ pickupStart: 1 }).skip(window.skip).limit(window.limit),
      Listing.countDocuments(filter),
    ]);
    return { items, meta: pageMeta(total, window) };
  },
};

module.exports = listingService;
