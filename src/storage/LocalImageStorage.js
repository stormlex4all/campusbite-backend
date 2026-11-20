'use strict';

const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const KEY_PATTERN = /^[a-f0-9]{32}\.(jpg|png|webp)$/;

/**
 * Stores images as files in a folder. Keys are random (never derived from the client's file name),
 * so there is no path traversal, no overwriting and no guessing.
 * Every storage driver implements: save(buffer, ext) -> key, remove(key), publicUrl(key).
 */
class LocalImageStorage {
  constructor({ dir, publicPath }) {
    this.dir = dir;
    this.publicPath = publicPath;
  }

  async save(buffer, ext) {
    await fs.mkdir(this.dir, { recursive: true });
    const key = `${crypto.randomBytes(16).toString('hex')}.${ext}`;
    await fs.writeFile(path.join(this.dir, key), buffer, { flag: 'wx' });
    return key;
  }

  async remove(key) {
    if (!KEY_PATTERN.test(key)) return; // ignore anything that is not one of our keys
    await fs.rm(path.join(this.dir, key), { force: true });
  }

  publicUrl(key) {
    return `${this.publicPath}/${key}`;
  }
}

module.exports = LocalImageStorage;
