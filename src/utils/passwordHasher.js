'use strict';

const bcrypt = require('bcryptjs');
const Config = require('../config');

/** Thin wrapper around bcrypt so the rest of the code never touches the library directly. */
const passwordHasher = {
  hash: (plain) => bcrypt.hash(plain, Config.get().auth.bcryptRounds),
  compare: (plain, hash) => bcrypt.compare(plain, hash),
};

module.exports = passwordHasher;
