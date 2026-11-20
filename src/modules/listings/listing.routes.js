'use strict';

const { Router } = require('express');
const validate = require('../../middleware/validate');
const { idParams } = require('../../schemas');
const controller = require('./listing.controller');
const v = require('./listing.validators');

/** Vendor's own listings: mounted under /api/vendor/listings. */
const vendorRouter = Router();
vendorRouter.get('/', validate({ query: v.listQuery }), controller.listMine);
vendorRouter.post('/', validate({ body: v.createBody }), controller.create);
vendorRouter.get('/:id', validate({ params: idParams }), controller.getMine);
vendorRouter.post('/:id/close', validate({ params: idParams }), controller.close);
vendorRouter.post('/:id/reopen', validate({ params: idParams }), controller.reopen);

/** What students see on a store page: GET /api/vendors/:id/listings (any signed-in user). */
const storeRouter = Router({ mergeParams: true });
storeRouter.get('/', validate({ params: idParams, query: v.storeListingsQuery }), controller.listForStore);

module.exports = { vendorRouter, storeRouter };
