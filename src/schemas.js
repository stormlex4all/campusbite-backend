'use strict';

const { z } = require('zod');
const { hasAtMostTwoDecimals } = require('./utils/money');

/** Reusable Zod building blocks shared by the module validators. */
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

const idParams = z.object({ id: objectId });

/** Query strings: treat an empty value (`?q=`) as "not provided". */
const optionalQuery = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema.optional());

const pagination = {
  page: optionalQuery(z.coerce.number().int().min(1).max(10000)),
  limit: optionalQuery(z.coerce.number().int().min(1).max(100)),
};

const csvOf = (itemSchema, max = 10) =>
  z.preprocess(
    (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v),
    z.array(itemSchema).max(max),
  );

const boolQuery = z.enum(['true', 'false']).transform((v) => v === 'true');

const price = z
  .number({ invalid_type_error: 'Price must be a number' })
  .positive('Price must be greater than 0')
  .max(1000, 'Price must be 1000 or less')
  .refine(hasAtMostTwoDecimals, 'Price can have at most 2 decimal places');

const isoDate = z.coerce.date({ invalid_type_error: 'Must be a valid date and time' });

module.exports = { z, objectId, idParams, optionalQuery, pagination, csvOf, boolQuery, price, isoDate };
