'use strict';

const asyncHandler = require('../../core/http/asyncHandler');
const { ok, created } = require('../../core/http/respond');
const menuService = require('./menu.service');
const { presentMenuItem } = require('./menu.presenter');

module.exports = {
  list: asyncHandler(async (req, res) => {
    const items = await menuService.list(req.vendor, req.valid.query);
    ok(res, items.map(presentMenuItem));
  }),

  get: asyncHandler(async (req, res) => {
    ok(res, presentMenuItem(await menuService.getOwned(req.vendor, req.valid.params.id)));
  }),

  create: asyncHandler(async (req, res) => {
    created(res, presentMenuItem(await menuService.create(req.vendor, req.valid.body)));
  }),

  update: asyncHandler(async (req, res) => {
    ok(res, presentMenuItem(await menuService.update(req.vendor, req.valid.params.id, req.valid.body)));
  }),

  archive: asyncHandler(async (req, res) => {
    ok(res, presentMenuItem(await menuService.setStatus(req.vendor, req.valid.params.id, 'archived')));
  }),

  restore: asyncHandler(async (req, res) => {
    ok(res, presentMenuItem(await menuService.setStatus(req.vendor, req.valid.params.id, 'active')));
  }),

  addImage: asyncHandler(async (req, res) => {
    const item = await menuService.addImage(req.vendor, req.valid.params.id, req.file, req.valid.body.alt);
    created(res, presentMenuItem(item));
  }),

  removeImage: asyncHandler(async (req, res) => {
    const { id, imageId } = req.valid.params;
    ok(res, presentMenuItem(await menuService.removeImage(req.vendor, id, imageId)));
  }),
};
