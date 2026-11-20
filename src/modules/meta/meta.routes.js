'use strict';

const { Router } = require('express');
const Config = require('../../config');
const { ok } = require('../../core/http/respond');
const { ROLES, USER_STATUSES, WEEKDAYS } = require('../../constants');

/**
 * GET /api/meta/options: static lists and rules the React and React Native forms need
 * (roles, statuses, weekdays, allowed school email domains) so the clients never hard-code them.
 */
const router = Router();
router.get('/options', (req, res) => {
  const { auth, uploads } = Config.get();
  ok(res, {
    roles: Object.values(ROLES),
    userStatuses: Object.values(USER_STATUSES),
    weekdays: WEEKDAYS,
    schoolEmailDomains: auth.schoolEmailDomains,
    images: { maxMb: Math.round((uploads.maxBytes / 1024 / 1024) * 10) / 10, maxPerItem: uploads.maxImagesPerItem, types: uploads.allowedTypes },
    listing: { maxQuantity: 200, maxWindowHours: 12 },
    password: { minLength: 8, maxLength: 72, requires: 'at least one letter and one number' },
  });
});

module.exports = router;
