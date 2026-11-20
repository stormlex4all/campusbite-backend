'use strict';

const mongoose = require('mongoose');

/** Refresh tokens are stored hashed. Rotated or revoked tokens stay until they expire (TTL index). */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
    userAgent: { type: String, maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false },
);

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.models.RefreshToken || mongoose.model('RefreshToken', refreshTokenSchema);
