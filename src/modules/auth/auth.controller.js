'use strict';

const asyncHandler = require('../../core/http/asyncHandler');
const { ok, created, noContent } = require('../../core/http/respond');
const authService = require('./auth.service');

const metaOf = (req) => ({ userAgent: req.get('user-agent') });

module.exports = {
  register: asyncHandler(async (req, res) => {
    const { user, tokens } = await authService.register(req.valid.body, metaOf(req));
    created(res, { user, tokens });
  }),

  login: asyncHandler(async (req, res) => {
    const { user, tokens } = await authService.login(req.valid.body, metaOf(req));
    ok(res, { user, tokens });
  }),

  refresh: asyncHandler(async (req, res) => {
    const { user, tokens } = await authService.refresh(req.valid.body.refreshToken, metaOf(req));
    ok(res, { user, tokens });
  }),

  logout: asyncHandler(async (req, res) => {
    await authService.logout(req.valid.body.refreshToken);
    noContent(res);
  }),

  me: asyncHandler(async (req, res) => {
    ok(res, await authService.profileOf(req.user));
  }),

  updateMe: asyncHandler(async (req, res) => {
    const user = await authService.updateName(req.user, req.valid.body.name);
    ok(res, { user });
  }),

  changePassword: asyncHandler(async (req, res) => {
    const tokens = await authService.changePassword(req.user, req.valid.body, metaOf(req));
    ok(res, { tokens });
  }),
};
