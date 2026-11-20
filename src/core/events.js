'use strict';

/** Names of every domain event published on the EventBus. */
module.exports = Object.freeze({
  ADMIN_VENDOR_PROVISIONED: 'admin.vendor.provisioned',
  ADMIN_USER_APPROVED: 'admin.user.approved',
  ADMIN_USER_SUSPENDED: 'admin.user.suspended',
  ADMIN_USER_REACTIVATED: 'admin.user.reactivated',
});
