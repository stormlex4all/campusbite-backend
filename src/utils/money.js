'use strict';

/** Money is handled in integer cents internally to avoid floating point drift. */
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => Math.round(cents) / 100;
const multiplyPrice = (unitPrice, quantity) => fromCents(toCents(unitPrice) * quantity);
const hasAtMostTwoDecimals = (amount) => Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;

module.exports = { toCents, fromCents, multiplyPrice, hasAtMostTwoDecimals };
