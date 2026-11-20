'use strict';

const { fromCents } = require('../../utils/money');
const { presentImage } = require('../menu/menu.presenter');

/** What a viewer should understand about a listing right now. */
function stateOf(listing, now = new Date()) {
  if (listing.status === 'closed') return 'closed';
  if (listing.pickupEnd <= now) return 'ended';
  if (listing.quantityAvailable <= 0) return 'sold_out';
  return 'live';
}

function presentListing(listing, now = new Date()) {
  return {
    id: String(listing._id),
    source: listing.source,
    menuItemId: listing.menuItem ? String(listing.menuItem) : null,
    title: listing.title,
    description: listing.description,
    price: fromCents(listing.priceCents),
    quantityTotal: listing.quantityTotal,
    quantityAvailable: listing.quantityAvailable,
    pickupStart: listing.pickupStart,
    pickupEnd: listing.pickupEnd,
    status: listing.status,
    state: stateOf(listing, now),
    images: listing.images.map((img) => presentImage(img, listing.title)),
    createdAt: listing.createdAt,
  };
}

module.exports = { presentListing, stateOf };
