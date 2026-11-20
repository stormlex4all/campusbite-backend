'use strict';

const multer = require('multer');
const Config = require('../config');
const ErrorFactory = require('../core/errors/ErrorFactory');

/**
 * Accepts ONE image in the multipart field "image" (plus optional text fields such as "alt").
 * The file is kept in memory, checked, and then handed to the storage driver by the service.
 * The real type is verified from the file's bytes later (utils/imageType), not from what the client claims.
 */
function uploadImage(req, res, next) {
  const { maxBytes } = Config.get().uploads;
  const parser = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1, fields: 5, parts: 8 } }).single('image');

  parser(req, res, (err) => {
    if (!err) {
      if (!req.file) return next(ErrorFactory.validation([{ source: 'body', field: 'image', message: 'Choose an image to upload' }]));
      return next();
    }
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = Math.round((maxBytes / 1024 / 1024) * 10) / 10;
      return next(ErrorFactory.payloadTooLarge(`This image is too large. The limit is ${mb} MB.`, { code: 'IMAGE_TOO_LARGE' }));
    }
    if (err instanceof multer.MulterError) {
      return next(ErrorFactory.validation([{ source: 'body', field: 'image', message: 'Send exactly one image in the "image" field' }]));
    }
    return next(err);
  });
}

module.exports = uploadImage;
