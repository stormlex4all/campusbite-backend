'use strict';

const request = require('supertest');
const createApp = require('../../src/app');
const UserFactory = require('../../src/factories/UserFactory');

const PASSWORD = 'Password123';
let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq += 1)}`;

const app = createApp();
const http = () => request(app);
const bearer = (token) => ({ Authorization: `Bearer ${token}` });

async function registerStudent(overrides = {}) {
  const email = overrides.email || `student${uniq()}@rdpolytech.ca`;
  const res = await http().post('/api/auth/register').send({ name: 'Sam Student', email, password: PASSWORD, ...overrides });
  if (res.status !== 201) throw new Error(`registerStudent failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { email, id: res.body.data.user.id, token: res.body.data.tokens.accessToken, refreshToken: res.body.data.tokens.refreshToken };
}

async function login(email, password = PASSWORD) {
  const res = await http().post('/api/auth/login').send({ email, password });
  return res;
}

async function createAdmin() {
  const email = `admin${uniq()}@campusbite.test`;
  const admin = await UserFactory.create('admin', { name: 'Ada Admin', email, password: PASSWORD });
  await admin.save();
  const res = await login(email);
  return { email, id: String(admin._id), token: res.body.data.tokens.accessToken };
}

async function provisionVendor(admin, overrides = {}) {
  const email = overrides.email || `vendor${uniq()}@campusbite.test`;
  const res = await http()
    .post('/api/admin/vendors')
    .set(bearer(admin.token))
    .send({
      name: 'Val Vendor',
      email,
      password: PASSWORD,
      store: { storeName: `Cafe ${uniq()}`, building: 'Main Building' },
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`provisionVendor failed: ${res.status} ${JSON.stringify(res.body)}`);
  const loginRes = await login(email);
  return { email, id: res.body.data.id, vendorId: res.body.data.store.id, token: loginRes.body.data?.tokens?.accessToken };
}

module.exports = { http, bearer, PASSWORD, uniq, registerStudent, login, createAdmin, provisionVendor };
