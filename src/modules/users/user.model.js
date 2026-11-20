'use strict';

const mongoose = require('mongoose');
const { ROLES, USER_STATUSES } = require('../../constants');
const { baseOptions } = require('../../utils/schemaOptions');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: Object.values(ROLES), required: true, index: true },
    status: { type: String, enum: Object.values(USER_STATUSES), default: USER_STATUSES.ACTIVE, index: true },

    // Account administration (Feature 13)
    statusReason: { type: String, trim: true, maxlength: 300 },
    statusChangedAt: { type: Date },
    statusChangedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    statusBeforeSuspension: { type: String, enum: Object.values(USER_STATUSES) },

    lastLoginAt: { type: Date },
  },
  baseOptions,
);

userSchema.index({ name: 1 });

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
