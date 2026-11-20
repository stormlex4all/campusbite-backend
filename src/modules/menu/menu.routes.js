'use strict';

const { Router } = require('express');
const validate = require('../../middleware/validate');
const uploadImage = require('../../middleware/uploadImage');
const { idParams } = require('../../schemas');
const controller = require('./menu.controller');
const v = require('./menu.validators');

/** Vendor's recurring menu items: mounted under /api/vendor/menu-items (vendor role + store loaded). */
const router = Router();

router.get('/', validate({ query: v.listQuery }), controller.list);
router.post('/', validate({ body: v.createBody }), controller.create);
router.get('/:id', validate({ params: idParams }), controller.get);
router.patch('/:id', validate({ params: idParams, body: v.updateBody }), controller.update);
router.post('/:id/archive', validate({ params: idParams }), controller.archive);
router.post('/:id/restore', validate({ params: idParams }), controller.restore);

// Photos: multipart/form-data with the file in "image" and an optional text field "alt"
router.post('/:id/images', validate({ params: idParams }), uploadImage, validate({ body: v.imageBody }), controller.addImage);
router.delete('/:id/images/:imageId', validate({ params: v.imageParams }), controller.removeImage);

module.exports = router;
