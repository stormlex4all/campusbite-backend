'use strict';

const asyncHandler = require('../../core/http/asyncHandler');
const { ok, created } = require('../../core/http/respond');
const adminService = require('./admin.service');

module.exports = {
  listUsers: asyncHandler(async (req, res) => {
    const { items, meta } = await adminService.listUsers(req.valid.query);
    ok(res, items, meta);
  }),
  getUser: asyncHandler(async (req, res) => ok(res, await adminService.getUser(req.valid.params.id))),
  provisionVendor: asyncHandler(async (req, res) => created(res, await adminService.provisionVendor(req.user, req.valid.body))),
  approve: asyncHandler(async (req, res) => ok(res, await adminService.approve(req.user, req.valid.params.id))),
  suspend: asyncHandler(async (req, res) =>
    ok(res, await adminService.suspend(req.user, req.valid.params.id, req.valid.body.reason)),
  ),
  reactivate: asyncHandler(async (req, res) => ok(res, await adminService.reactivate(req.user, req.valid.params.id))),
  auditLogs: asyncHandler(async (req, res) => {
    const { items, meta } = await adminService.listAuditLogs(req.valid.query);
    ok(res, items, meta);
  }),
};
