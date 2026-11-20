'use strict';

const { z, optionalQuery, pagination } = require('../../schemas');
const { profileFields } = require('../vendors/vendor.validators');
const { registerBody } = require('../auth/auth.validators');
const { ROLES, USER_STATUSES } = require('../../constants');

const usersQuery = z.object({
  role: optionalQuery(z.enum(Object.values(ROLES))),
  status: optionalQuery(z.enum(Object.values(USER_STATUSES))),
  q: optionalQuery(z.string().trim().max(80)),
  ...pagination,
});

const provisionVendorBody = z.object({
  name: registerBody.shape.name,
  email: registerBody.shape.email,
  password: registerBody.shape.password,
  // Provisioned accounts are approved by default; use "pending" to require a separate approval step
  status: z.enum([USER_STATUSES.ACTIVE, USER_STATUSES.PENDING]).optional().default(USER_STATUSES.ACTIVE),
  store: z.object({
    storeName: profileFields.storeName,
    building: profileFields.building,
    description: profileFields.description.optional(),
    counterLocation: profileFields.counterLocation.optional(),
    openingHours: profileFields.openingHours.optional(),
    pickupInstructions: profileFields.pickupInstructions.optional(),
  }),
});

const suspendBody = z.object({
  reason: z.string().trim().min(3, 'Give a short reason for the suspension').max(300),
});

const auditQuery = z.object({
  action: optionalQuery(z.string().trim().max(80)),
  target: optionalQuery(z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id')),
  ...pagination,
});

module.exports = { usersQuery, provisionVendorBody, suspendBody, auditQuery };
