'use strict';

const { Router } = require('express');
const validate = require('../../middleware/validate');
const authenticate = require('../../middleware/authenticate');
const { authLimiter } = require('../../middleware/rateLimiters');
const controller = require('./auth.controller');
const v = require('./auth.validators');

const router = Router();
const limiter = authLimiter();

router.post('/register', limiter, validate({ body: v.registerBody }), controller.register);
router.post('/login', limiter, validate({ body: v.loginBody }), controller.login);
router.post('/refresh', limiter, validate({ body: v.refreshBody }), controller.refresh);
router.post('/logout', validate({ body: v.refreshBody }), controller.logout);

router.get('/me', authenticate, controller.me);
router.patch('/me', authenticate, validate({ body: v.updateMeBody }), controller.updateMe);
router.post('/change-password', authenticate, validate({ body: v.changePasswordBody }), controller.changePassword);

module.exports = router;
