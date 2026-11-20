'use strict';

const { Router } = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const requireVendor = require('../modules/vendors/requireVendor');

const authRoutes = require('../modules/auth/auth.routes');
const metaRoutes = require('../modules/meta/meta.routes');
const vendorRoutes = require('../modules/vendors/vendor.routes');
const adminRoutes = require('../modules/admin/admin.routes');
const menuRoutes = require('../modules/menu/menu.routes');
const listingRoutes = require('../modules/listings/listing.routes');

/**
 * All API routes, mounted under /api by app.js.
 *
 *   Public     /auth/*, /meta/options
 *   Signed in  /vendors, /vendors/:id/listings           (browse stores and what they currently offer)
 *   Vendor     /vendor/profile, /vendor/menu-items, /vendor/listings
 *   Admin      /admin/*
 */
function buildApiRouter() {
  const router = Router();

  router.use('/auth', authRoutes);
  router.use('/meta', metaRoutes);

  // Everything below needs a valid access token
  router.use(authenticate);

  router.use('/vendors/:id/listings', listingRoutes.storeRouter);
  router.use('/vendors', vendorRoutes.publicRouter);

  const vendorPortal = Router();
  vendorPortal.use(authorize('vendor'), requireVendor);
  vendorPortal.use('/profile', vendorRoutes.profileRouter);
  vendorPortal.use('/menu-items', menuRoutes);
  vendorPortal.use('/listings', listingRoutes.vendorRouter);
  router.use('/vendor', vendorPortal);

  router.use('/admin', adminRoutes);

  return router;
}

module.exports = buildApiRouter;
