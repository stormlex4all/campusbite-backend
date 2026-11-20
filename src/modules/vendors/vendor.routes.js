'use strict';

const { Router } = require('express');
const validate = require('../../middleware/validate');
const { idParams } = require('../../schemas');
const controller = require('./vendor.controller');
const v = require('./vendor.validators');

/** Student-facing store pages: GET /api/vendors, GET /api/vendors/:id (any signed-in user). */
const publicRouter = Router();
publicRouter.get('/', validate({ query: v.listQuery }), controller.list);
publicRouter.get('/:id', validate({ params: idParams }), controller.get);

/** Vendor's own profile: mounted under /api/vendor/profile (vendor role + store loaded). */
const profileRouter = Router();
profileRouter.get('/', controller.getMine);
profileRouter.patch('/', validate({ body: v.updateProfileBody }), controller.updateMine);

module.exports = { publicRouter, profileRouter };
