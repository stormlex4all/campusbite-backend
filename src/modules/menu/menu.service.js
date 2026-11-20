'use strict';

const Config = require('../../config');
const ErrorFactory = require('../../core/errors/ErrorFactory');
const StorageFactory = require('../../storage/StorageFactory');
const { detectImageType } = require('../../utils/imageType');
const { toCents } = require('../../utils/money');
const { MENU_ITEM_STATUSES } = require('../../constants');
const MenuItem = require('./menuItem.model');
const Listing = require('../listings/listing.model');

const keyOf = (name) => name.trim().toLowerCase();
const isDuplicate = (err) => err?.code === 11000;
const duplicateError = () =>
  ErrorFactory.conflict('You already have a menu item with this name. Choose a different name, or restore the archived one.', { code: 'MENU_ITEM_EXISTS' });

const menuService = {
  async list(vendor, { status = 'active' } = {}) {
    const filter = { vendor: vendor._id };
    if (status !== 'all') filter.status = status;
    return MenuItem.find(filter).sort({ name: 1 });
  },

  /** An item that belongs to this vendor, or 404 (never reveal other vendors' items). */
  async getOwned(vendor, id) {
    const item = await MenuItem.findOne({ _id: id, vendor: vendor._id });
    if (!item) throw ErrorFactory.notFound('Menu item');
    return item;
  },

  async create(vendor, { name, description, defaultPrice }) {
    try {
      return await MenuItem.create({ vendor: vendor._id, name, nameKey: keyOf(name), description, defaultPriceCents: toCents(defaultPrice) });
    } catch (err) {
      if (isDuplicate(err)) throw duplicateError();
      throw err;
    }
  },

  async update(vendor, id, patch) {
    const item = await menuService.getOwned(vendor, id);
    menuService.assertActive(item);
    if (patch.name !== undefined) {
      item.name = patch.name;
      item.nameKey = keyOf(patch.name);
    }
    if (patch.description !== undefined) item.description = patch.description;
    if (patch.defaultPrice !== undefined) item.defaultPriceCents = toCents(patch.defaultPrice);
    try {
      return await item.save();
    } catch (err) {
      if (isDuplicate(err)) throw duplicateError();
      throw err;
    }
  },

  assertActive(item) {
    if (item.status === MENU_ITEM_STATUSES.ARCHIVED) {
      throw ErrorFactory.conflict('This menu item is archived. Restore it to make changes.', { code: 'MENU_ITEM_ARCHIVED' });
    }
  },

  /** Archive / restore. Idempotent. Existing listings are unaffected. */
  async setStatus(vendor, id, status) {
    const item = await menuService.getOwned(vendor, id);
    if (item.status !== status) {
      item.status = status;
      await item.save();
    }
    return item;
  },

  /**
   * Add a photo. The file type is verified from its bytes, the per-item limit is enforced atomically
   * in the database update, and the stored file is removed again if the update does not happen.
   */
  async addImage(vendor, id, file, alt = '') {
    const { maxImagesPerItem } = Config.get().uploads;
    const item = await menuService.getOwned(vendor, id);
    menuService.assertActive(item);

    const type = detectImageType(file.buffer);
    if (!type) {
      throw ErrorFactory.unprocessable('This file is not a supported image. Use a JPEG, PNG or WebP photo.', { code: 'UNSUPPORTED_IMAGE_TYPE' });
    }

    const storage = StorageFactory.imageStorage();
    const key = await storage.save(file.buffer, type.ext);
    try {
      const updated = await MenuItem.findOneAndUpdate(
        { _id: item._id, status: MENU_ITEM_STATUSES.ACTIVE, $expr: { $lt: [{ $size: '$images' }, maxImagesPerItem] } },
        { $push: { images: { key, alt } } },
        { new: true },
      );
      if (!updated) {
        await storage.remove(key);
        throw ErrorFactory.conflict(`A menu item can have up to ${maxImagesPerItem} photos. Remove one to add another.`, { code: 'IMAGE_LIMIT_REACHED' });
      }
      return updated;
    } catch (err) {
      if (!(err.code === 'IMAGE_LIMIT_REACHED')) await storage.remove(key);
      throw err;
    }
  },

  /** Remove a photo from the item. The file is deleted unless an existing listing still shows it. */
  async removeImage(vendor, id, imageId) {
    const item = await menuService.getOwned(vendor, id);
    menuService.assertActive(item);
    const image = item.images.id(imageId);
    if (!image) throw ErrorFactory.notFound('Photo');

    const updated = await MenuItem.findOneAndUpdate({ _id: item._id }, { $pull: { images: { _id: image._id } } }, { new: true });
    const stillUsed = await Listing.exists({ 'images.key': image.key });
    if (!stillUsed) await StorageFactory.imageStorage().remove(image.key);
    return updated;
  },
};

module.exports = menuService;
