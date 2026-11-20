'use strict';

/**
 * Every successful response has the same envelope so the React and React Native
 * clients can share one API layer:
 *   { success: true, data: ..., meta?: ... }
 * Errors use { success: false, error: { code, message, details? } } (see errorHandler).
 */
const ok = (res, data, meta) => res.status(200).json(envelope(data, meta));
const created = (res, data, meta) => res.status(201).json(envelope(data, meta));
const noContent = (res) => res.status(204).end();

function envelope(data, meta) {
  const body = { success: true, data };
  if (meta !== undefined) body.meta = meta;
  return body;
}

module.exports = { ok, created, noContent };
