'use strict';

const mongoose = require('mongoose');
const { MENU_ITEM_STATUSES } = require('../../constants');
const { baseOptions } = require('../../utils/schemaOptions');

const imageSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // storage key, e.g. "3f9c...a1.jpg"
    alt: { type: String, trim: true, maxlength: 140, default: '' }, // description for screen readers
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/**
 * A recurring menu item: something a vendor sells regularly (e.g. "Veggie wrap"), profiled once with
 * a description, usual price and photos. New listings are created from these items.
 * Items are archived instead of deleted so old listings keep their history.
 */
const menuItemSchema = new mongoose.Schema(
  {
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    nameKey: { type: String, required: true }, // lower-case name, used to prevent duplicates
    description: { type: String, trim: true, maxlength: 500, default: '' },
    defaultPriceCents: { type: Number, required: true, min: 1, max: 100000 },
    images: { type: [imageSchema], default: [] },
    status: { type: String, enum: Object.values(MENU_ITEM_STATUSES), default: MENU_ITEM_STATUSES.ACTIVE, index: true },
  },
  baseOptions,
);

menuItemSchema.index({ vendor: 1, nameKey: 1 }, { unique: true });

module.exports = mongoose.models.MenuItem || mongoose.model('MenuItem', menuItemSchema);
