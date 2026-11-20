'use strict';

const mongoose = require('mongoose');
const { WEEKDAYS } = require('../../constants');
const { baseOptions } = require('../../utils/schemaOptions');

const openingHoursSchema = new mongoose.Schema(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    closed: { type: Boolean, default: false },
    opens: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    closes: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  },
  { _id: false },
);

/** Store profile of a vendor user (Feature 2). One profile per vendor account. */
const vendorSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    storeName: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    description: { type: String, trim: true, maxlength: 500, default: '' },
    building: { type: String, required: true, trim: true, maxlength: 80 },
    counterLocation: { type: String, trim: true, maxlength: 120, default: '' },
    openingHours: { type: [openingHoursSchema], default: [] },
    pickupInstructions: { type: String, trim: true, maxlength: 300, default: '' },
    // false while the owner account is pending or suspended: hidden from students
    isActive: { type: Boolean, default: true, index: true },
  },
  baseOptions,
);

vendorSchema.index({ storeName: 1 });

module.exports = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
