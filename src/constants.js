'use strict';

/** Shared enumerations used by models, validators and presenters. */
const ROLES = Object.freeze({ STUDENT: 'student', VENDOR: 'vendor', ADMIN: 'admin' });
const USER_STATUSES = Object.freeze({ ACTIVE: 'active', PENDING: 'pending', SUSPENDED: 'suspended' });
const MENU_ITEM_STATUSES = Object.freeze({ ACTIVE: 'active', ARCHIVED: 'archived' });

/** A listing is made from a saved (recurring) menu item, or is a one-off item that is entered as it comes. */
const LISTING_SOURCES = Object.freeze({ MENU_ITEM: 'menu_item', ONE_OFF: 'one_off' });
const LISTING_STATUSES = Object.freeze({ ACTIVE: 'active', CLOSED: 'closed' });

const WEEKDAYS = Object.freeze([
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

module.exports = {
  ROLES,
  USER_STATUSES,
  MENU_ITEM_STATUSES,
  LISTING_SOURCES,
  LISTING_STATUSES,
  WEEKDAYS,
};
