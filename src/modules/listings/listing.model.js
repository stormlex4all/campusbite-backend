'use strict';

const mongoose = require('mongoose');
const { LISTING_SOURCES, LISTING_STATUSES } = require('../../constants');
const { baseOptions } = require('../../utils/schemaOptions');

const imageSchema = new mongoose.Schema(
  { key: { type: String, required: true }, alt: { type: String, trim: true, maxlength: 140, default: '' } },
  { _id: false },
);

/**
 * One offer of surplus food for a pickup window.
 *  - source "menu_item": created from a saved recurring menu item (name, description, photos are
 *    copied from it, so later edits to the menu item never change an existing listing).
 *  - source "one_off":   an item entered as it comes, without a saved menu item.
 */
const listingSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    source: { type: String, enum: Object.values(LISTING_SOURCES), required: true },
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', default: null },
    title: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    priceCents: { type: Number, required: true, min: 1, max: 100000 },
    quantityTotal: { type: Number, required: true, min: 1, max: 500 },
    quantityAvailable: { type: Number, required: true, min: 0 },
    pickupStart: { type: Date, required: true },
    pickupEnd: { type: Date, required: true },
    images: { type: [imageSchema], default: [] },
    status: { type: String, enum: Object.values(LISTING_STATUSES), default: LISTING_STATUSES.ACTIVE, index: true },
  },
  baseOptions,
);

listingSchema.index({ vendor: 1, pickupStart: -1 });
listingSchema.index({ status: 1, pickupEnd: 1 });
listingSchema.index({ 'images.key': 1 });

module.exports = mongoose.models.Listing || mongoose.model('Listing', listingSchema);
