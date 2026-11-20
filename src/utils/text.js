'use strict';

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const unique = (list) => [...new Set(list)];

module.exports = { escapeRegex, unique };
