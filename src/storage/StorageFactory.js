'use strict';

const Config = require('../config');
const LocalImageStorage = require('./LocalImageStorage');

/**
 * StorageFactory (Factory pattern)
 * --------------------------------
 * Chooses the image storage driver from configuration so the rest of the app only knows the
 * small interface { save, remove, publicUrl }. To move photos to S3 / Cloudinary later, add a
 * driver class and one `case` here; no service or controller changes.
 */
const StorageFactory = {
  create(driver, options) {
    switch (driver) {
      case 'local':
        return new LocalImageStorage(options);
      default:
        throw new Error(`Unknown image storage driver "${driver}"`);
    }
  },

  /** The configured storage, created once per process (and again after Config.reset() in tests). */
  imageStorage() {
    const { uploads } = Config.get();
    if (!StorageFactory._cache || StorageFactory._cache.dir !== uploads.dir) {
      StorageFactory._cache = { dir: uploads.dir, storage: StorageFactory.create(uploads.driver, { dir: uploads.dir, publicPath: uploads.publicPath }) };
    }
    return StorageFactory._cache.storage;
  },
};

module.exports = StorageFactory;
