'use strict';

const asyncHandler = require('../../core/http/asyncHandler');
const ErrorFactory = require('../../core/errors/ErrorFactory');
const Vendor = require('./vendor.model');

/** For vendor-only routes: loads the signed-in vendor's store profile into `req.vendor`. */
const requireVendor = asyncHandler(async (req, res, next) => {
  const vendor = await Vendor.findOne({ owner: req.user._id });
  if (!vendor) {
    throw ErrorFactory.notFound('Store profile', { code: 'STORE_PROFILE_MISSING' });
  }
  req.vendor = vendor;
  next();
});

module.exports = requireVendor;
