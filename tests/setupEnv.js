'use strict';

// Loaded by Jest before every test file. Sets a safe, fast, isolated environment.
// The server is chosen with TEST_MONGODB_URI (set it in .env or the shell; default: local mongod on 27017).
// Each test file works in its OWN throw-away database (campusbite_test_<random>), which is dropped afterwards.
// Any database name in the URI is ignored and replaced, so your real data is never touched.
require('dotenv').config({ quiet: true });
const base = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/';
const dbName = `campusbite_test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
const parts = base.match(/^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?(\?.*)?$/);
if (!parts) throw new Error('TEST_MONGODB_URI must look like mongodb://host:port/ or mongodb+srv://...');

const os = require('os');
const path = require('path');
const uploadDir = path.join(os.tmpdir(), `campusbite_uploads_${dbName}`);

Object.assign(process.env, {
  UPLOAD_DIR: uploadDir,
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  BCRYPT_ROUNDS: '4',
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-16-chars',
  AUTH_RATE_LIMIT_MAX: '10000',
  SCHOOL_EMAIL_DOMAINS: 'rdpolytech.ca',
  MISSED_SWEEP_SECONDS: '0',
  APP_TIMEZONE: 'America/Edmonton',
  MAX_QUANTITY_PER_RESERVATION: '5',
  REMINDER_MINUTES: '30',
  MONGODB_URI: `${parts[1]}/${dbName}${parts[2] || ''}`,
  USE_TRANSACTIONS: process.env.USE_TRANSACTIONS || 'auto',
});
delete process.env.CLIENT_BUILD_DIR;
