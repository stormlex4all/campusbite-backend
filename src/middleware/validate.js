'use strict';

const ErrorFactory = require('../core/errors/ErrorFactory');

/**
 * Validate params / query / body with Zod schemas. Parsed (and coerced) values are placed
 * on `req.valid.params|query|body`; controllers read from there, never from raw input.
 * All problems across the three sources are reported together.
 *
 *   router.get('/', validate({ query: searchQuerySchema }), controller.search)
 */
const validate = (schemas) => (req, res, next) => {
  const details = [];
  req.valid = req.valid || {};
  for (const source of ['params', 'query', 'body']) {
    if (!schemas[source]) continue;
    const result = schemas[source].safeParse(req[source] ?? {});
    if (result.success) req.valid[source] = result.data;
    else details.push(...ErrorFactory.zodDetails(result.error, source));
  }
  if (details.length) return next(ErrorFactory.validation(details));
  return next();
};

module.exports = validate;
