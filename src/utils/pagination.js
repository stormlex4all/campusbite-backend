'use strict';

/** Turn validated `page` / `limit` values into skip/limit and build the response meta block. */
function toPageWindow({ page = 1, limit = 20 } = {}, { maxLimit = 100 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), maxLimit);
  const safePage = Math.max(Number(page) || 1, 1);
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}

function pageMeta(total, { page, limit }) {
  return { total, page, limit, totalPages: Math.max(Math.ceil(total / limit), 1) };
}

module.exports = { toPageWindow, pageMeta };
