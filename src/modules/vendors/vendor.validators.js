'use strict';

const { z, optionalQuery, pagination } = require('../../schemas');
const { WEEKDAYS } = require('../../constants');

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use 24-hour time like 08:30');

const openingHour = z
  .object({
    day: z.enum(WEEKDAYS),
    closed: z.boolean().optional().default(false),
    opens: time.optional(),
    closes: time.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.closed) return;
    if (!v.opens || !v.closes) {
      ctx.addIssue({ code: 'custom', path: ['opens'], message: 'Provide opening and closing times, or mark the day as closed' });
    } else if (v.closes <= v.opens) {
      ctx.addIssue({ code: 'custom', path: ['closes'], message: 'Closing time must be after opening time' });
    }
  });

const openingHours = z
  .array(openingHour)
  .max(7)
  .refine((list) => new Set(list.map((h) => h.day)).size === list.length, 'Each day can only appear once');

const profileFields = {
  storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(80),
  description: z.string().trim().max(500),
  building: z.string().trim().min(1, 'Building is required').max(80),
  counterLocation: z.string().trim().max(120),
  openingHours,
  pickupInstructions: z.string().trim().max(300),
};

const updateProfileBody = z
  .object(profileFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

const listQuery = z.object({
  q: optionalQuery(z.string().trim().max(80)),
  ...pagination,
});

module.exports = { profileFields, updateProfileBody, listQuery };
