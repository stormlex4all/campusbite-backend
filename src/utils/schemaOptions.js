'use strict';

/**
 * Shared Mongoose schema options: adds createdAt/updatedAt and makes every document
 * serialise to a clean API shape (`id` instead of `_id`, no `__v`, no password hash).
 */
const baseOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform(doc, ret) {
      if (ret._id !== undefined) {
        ret.id = String(ret._id);
        delete ret._id;
      }
      delete ret.passwordHash;
      return ret;
    },
  },
};

module.exports = { baseOptions };
