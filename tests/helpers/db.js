'use strict';

const fs = require('fs');
const mongoose = require('mongoose');
const Database = require('../../src/core/Database');
const EventBus = require('../../src/core/EventBus');
const { registerObservers } = require('../../src/observers');

async function startDb() {
  await Database.getInstance().connect();
  registerObservers(EventBus.getInstance());
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
}

async function stopDb() {
  if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
  await Database.getInstance().disconnect();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
}

async function clearDb() {
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
}

module.exports = { startDb, stopDb, clearDb };
