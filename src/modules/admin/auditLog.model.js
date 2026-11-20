'use strict';

const mongoose = require('mongoose');
const { baseOptions } = require('../../utils/schemaOptions');

/** One row per administrator action: who, what, to whom, when. */
const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    actor: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      name: String,
      email: String,
    },
    target: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      name: String,
      email: String,
      role: String,
    },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { ...baseOptions, timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ 'target.id': 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
