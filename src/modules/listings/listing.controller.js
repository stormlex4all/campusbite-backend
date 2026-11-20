'use strict';

const asyncHandler = require('../../core/http/asyncHandler');
const { ok, created } = require('../../core/http/respond');
const listingService = require('./listing.service');
const { presentListing } = require('./listing.presenter');

module.exports = {
  create: asyncHandler(async (req, res) => {
    created(res, presentListing(await listingService.create(req.vendor, req.valid.body)));
  }),

  listMine: asyncHandler(async (req, res) => {
    const { items, meta } = await listingService.listForVendor(req.vendor, req.valid.query);
    ok(res, items.map((l) => presentListing(l)), meta);
  }),

  getMine: asyncHandler(async (req, res) => {
    ok(res, presentListing(await listingService.getOwned(req.vendor, req.valid.params.id)));
  }),

  close: asyncHandler(async (req, res) => {
    ok(res, presentListing(await listingService.close(req.vendor, req.valid.params.id)));
  }),

  reopen: asyncHandler(async (req, res) => {
    ok(res, presentListing(await listingService.reopen(req.vendor, req.valid.params.id)));
  }),

  listForStore: asyncHandler(async (req, res) => {
    const { items, meta } = await listingService.listLiveForStore(req.valid.params.id, req.valid.query);
    ok(res, items.map((l) => presentListing(l)), meta);
  }),
};
