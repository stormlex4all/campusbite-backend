'use strict';

const { z, objectId, optionalQuery, pagination, price, isoDate } = require('../../schemas');

const MAX_WINDOW_HOURS = 12;

const quantityTotal = z
  .number({ required_error: 'Number of portions is required', invalid_type_error: 'Number of portions must be a number' })
  .int('Number of portions must be a whole number')
  .min(1, 'Number of portions must be at least 1')
  .max(200, 'Number of portions must be 200 or fewer');

const window = {
  pickupStart: isoDate,
  pickupEnd: isoDate,
};

const fromMenuItem = z.object({
  source: z.literal('menu_item'),
  menuItemId: objectId,
  price: price.optional(), // defaults to the menu item's usual price
  quantityTotal,
  ...window,
});

const oneOff = z.object({
  source: z.literal('one_off'),
  title: z.string({ required_error: 'Item name is required' }).trim().min(2, 'Item name must be at least 2 characters').max(80, 'Item name must be 80 characters or fewer'),
  description: z.string().trim().max(500, 'Description must be 500 characters or fewer').optional().default(''),
  price,
  quantityTotal,
  ...window,
});

const createBody = z
  .discriminatedUnion('source', [fromMenuItem, oneOff], {
    errorMap: () => ({ message: 'Choose whether this listing is from a menu item or a one-off item' }),
  })
  .superRefine((v, ctx) => {
    if (!(v.pickupStart instanceof Date) || !(v.pickupEnd instanceof Date)) return;
    if (v.pickupEnd <= v.pickupStart) {
      ctx.addIssue({ code: 'custom', path: ['pickupEnd'], message: 'Pickup must end after it starts' });
    } else if (v.pickupEnd - v.pickupStart > MAX_WINDOW_HOURS * 3600 * 1000) {
      ctx.addIssue({ code: 'custom', path: ['pickupEnd'], message: `The pickup window can be at most ${MAX_WINDOW_HOURS} hours long` });
    }
  });

const listQuery = z.object({
  status: optionalQuery(z.enum(['active', 'closed', 'all'])),
  ...pagination,
});

const storeListingsQuery = z.object({ ...pagination });

module.exports = { createBody, listQuery, storeListingsQuery, MAX_WINDOW_HOURS };
