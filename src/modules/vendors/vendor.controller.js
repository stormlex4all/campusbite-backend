'use strict';

const asyncHandler = require('../../core/http/asyncHandler');
const { ok } = require('../../core/http/respond');
const vendorService = require('./vendor.service');

module.exports = {
  list: asyncHandler(async (req, res) => {
    const { items, meta } = await vendorService.listPublic(req.valid.query);
    ok(res, items, meta);
  }),

  get: asyncHandler(async (req, res) => {
    ok(res, await vendorService.getPublic(req.valid.params.id));
  }),

  getMine: asyncHandler(async (req, res) => {
    ok(res, req.vendor);
  }),

  updateMine: asyncHandler(async (req, res) => {
    ok(res, await vendorService.updateProfile(req.vendor, req.valid.body));
  }),
};
