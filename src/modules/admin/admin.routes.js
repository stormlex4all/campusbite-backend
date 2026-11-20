'use strict';

const { Router } = require('express');
const validate = require('../../middleware/validate');
const authorize = require('../../middleware/authorize');
const { idParams } = require('../../schemas');
const controller = require('./admin.controller');
const v = require('./admin.validators');

/** /api/admin  (administrators only) */
const router = Router();
router.use(authorize('admin'));

router.get('/users', validate({ query: v.usersQuery }), controller.listUsers);
router.get('/users/:id', validate({ params: idParams }), controller.getUser);
router.post('/vendors', validate({ body: v.provisionVendorBody }), controller.provisionVendor);
router.post('/users/:id/approve', validate({ params: idParams }), controller.approve);
router.post('/users/:id/suspend', validate({ params: idParams, body: v.suspendBody }), controller.suspend);
router.post('/users/:id/reactivate', validate({ params: idParams }), controller.reactivate);
router.get('/audit-logs', validate({ query: v.auditQuery }), controller.auditLogs);

module.exports = router;
