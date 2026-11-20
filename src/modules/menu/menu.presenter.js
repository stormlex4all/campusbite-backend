'use strict';

const Config = require('../../config');
const { fromCents } = require('../../utils/money');

/** API shape of an image: where to load it and how to describe it. */
function presentImage(image, fallbackAlt) {
  return { id: String(image._id), url: `${Config.get().uploads.publicPath}/${image.key}`, alt: image.alt || fallbackAlt };
}

function presentMenuItem(item) {
  return {
    id: String(item._id),
    name: item.name,
    description: item.description,
    defaultPrice: fromCents(item.defaultPriceCents),
    status: item.status,
    images: item.images.map((img) => presentImage(img, item.name)),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

module.exports = { presentImage, presentMenuItem };
