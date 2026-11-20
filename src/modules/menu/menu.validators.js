'use strict';

const { z, objectId, optionalQuery, price } = require('../../schemas');

const name = z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(80, 'Name must be 80 characters or fewer');
const description = z.string().trim().max(500, 'Description must be 500 characters or fewer');

const createBody = z.object({
  name,
  description: description.optional().default(''),
  defaultPrice: price,
});

const updateBody = z
  .object({ name: name.optional(), description: description.optional(), defaultPrice: price.optional() })
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Provide at least one field to update');

const listQuery = z.object({ status: optionalQuery(z.enum(['active', 'archived', 'all'])) });

const imageParams = z.object({ id: objectId, imageId: objectId });

const imageBody = z.object({ alt: z.string().trim().max(140, 'Description must be 140 characters or fewer').optional() });

module.exports = { createBody, updateBody, listQuery, imageParams, imageBody };
