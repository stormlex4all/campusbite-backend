'use strict';

const { startDb, stopDb, clearDb } = require('../helpers/db');
const { http, bearer, registerStudent, login, createAdmin, provisionVendor, PASSWORD } = require('../helpers/api');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

describe('auth', () => {
  test('register returns user + tokens and never the password hash', async () => {
    const res = await http().post('/api/auth/register').send({ name: 'Sam', email: 'sam@rdpolytech.ca', password: PASSWORD });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user).toMatchObject({ email: 'sam@rdpolytech.ca', role: 'student' });
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash/);
    expect(res.body.data.tokens.accessToken).toBeTruthy();
    expect(res.body.data.tokens.refreshToken).toBeTruthy();
  });

  test('rejects non-school email, duplicate email and bad input with consistent errors', async () => {
    const bad = await http().post('/api/auth/register').send({ name: 'Sam', email: 'sam@gmail.com', password: PASSWORD });
    expect(bad.status).toBe(422);
    expect(bad.body.error.code).toBe('EMAIL_DOMAIN_NOT_ALLOWED');

    await registerStudent({ email: 'dup@rdpolytech.ca' });
    const dup = await http().post('/api/auth/register').send({ name: 'Sam', email: 'DUP@rdpolytech.ca', password: PASSWORD });
    expect(dup.status).toBe(409);

    const invalid = await http().post('/api/auth/register').send({ name: 'S', email: 'x', password: '1' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
    expect(invalid.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  test('login works, wrong password and unknown email give the same message', async () => {
    const s = await registerStudent();
    expect((await login(s.email)).status).toBe(200);
    const wrong = await login(s.email, 'Wrong12345');
    const unknown = await login('nobody@rdpolytech.ca', 'Wrong12345');
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  test('protected routes need a valid token', async () => {
    expect((await http().get('/api/auth/me')).status).toBe(401);
    expect((await http().get('/api/auth/me').set(bearer('garbage'))).status).toBe(401);
    const s = await registerStudent();
    const me = await http().get('/api/auth/me').set(bearer(s.token));
    expect(me.status).toBe(200);
  });

  test('refresh rotates the token; reusing an old one revokes the whole family', async () => {
    const s = await registerStudent();
    const r1 = await http().post('/api/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    const next = r1.body.data.tokens.refreshToken;
    expect(next).not.toBe(s.refreshToken);

    const reuse = await http().post('/api/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(reuse.status).toBe(401);

    const afterReuse = await http().post('/api/auth/refresh').send({ refreshToken: next });
    expect(afterReuse.status).toBe(401);
  });

  test('logout revokes the refresh token', async () => {
    const s = await registerStudent();
    const out = await http().post('/api/auth/logout').send({ refreshToken: s.refreshToken });
    expect(out.status).toBe(204);
    expect((await http().post('/api/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401);
  });

  test('change password requires the current one and invalidates old sessions', async () => {
    const s = await registerStudent();
    const wrong = await http().post('/api/auth/change-password').set(bearer(s.token)).send({ currentPassword: 'Nope12345', newPassword: 'NewPass123' });
    expect(wrong.status).toBeGreaterThanOrEqual(400);
    const ok = await http().post('/api/auth/change-password').set(bearer(s.token)).send({ currentPassword: PASSWORD, newPassword: 'NewPass123' });
    expect(ok.status).toBe(200);
    expect((await http().post('/api/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401);
    expect((await login(s.email, 'NewPass123')).status).toBe(200);
  });

  test('role checks: student cannot use vendor or admin routes', async () => {
    const s = await registerStudent();
    expect((await http().get('/api/vendor/profile').set(bearer(s.token))).status).toBe(403);
    expect((await http().get('/api/admin/users').set(bearer(s.token))).status).toBe(403);
  });
});

describe('admin (feature 13)', () => {
  test('provision, suspend (instant lockout), reactivate, and audit trail', async () => {
    const admin = await createAdmin();
    const vendor = await provisionVendor(admin);

    expect((await http().get('/api/vendor/profile').set(bearer(vendor.token))).status).toBe(200);

    const bad = await http().post(`/api/admin/users/${vendor.id}/suspend`).set(bearer(admin.token)).send({});
    expect(bad.status).toBe(400);

    const sus = await http().post(`/api/admin/users/${vendor.id}/suspend`).set(bearer(admin.token)).send({ reason: 'Policy breach' });
    expect(sus.status).toBe(200);
    // the still-valid access token stops working immediately
    expect((await http().get('/api/vendor/profile').set(bearer(vendor.token))).status).toBe(403);
    expect((await login(vendor.email)).status).toBeGreaterThanOrEqual(401);

    const re = await http().post(`/api/admin/users/${vendor.id}/reactivate`).set(bearer(admin.token));
    expect(re.status).toBe(200);
    expect((await login(vendor.email)).status).toBe(200);

    const logs = await http().get('/api/admin/audit-logs').set(bearer(admin.token));
    expect(logs.status).toBe(200);
    const actions = logs.body.data.map((l) => l.action);
    expect(actions.length).toBeGreaterThanOrEqual(3);
  });

  test('pending vendors cannot sign in until approved', async () => {
    const admin = await createAdmin();
    const v = await provisionVendor(admin, { status: 'pending' });
    expect((await login(v.email)).status).toBeGreaterThanOrEqual(401);
    const ap = await http().post(`/api/admin/users/${v.id}/approve`).set(bearer(admin.token));
    expect(ap.status).toBe(200);
    expect((await login(v.email)).status).toBe(200);
  });
});

describe('vendor store profiles (feature 2)', () => {
  test('vendor reads and edits own profile with validation; students browse active stores only', async () => {
    const admin = await createAdmin();
    const vendor = await provisionVendor(admin);
    const student = await registerStudent();

    const mine = await http().get('/api/vendor/profile').set(bearer(vendor.token));
    expect(mine.status).toBe(200);
    expect(mine.body.data.building).toBe('Main Building');

    const up = await http().patch('/api/vendor/profile').set(bearer(vendor.token)).send({
      storeName: 'Renamed Cafe',
      description: 'Coffee and snacks',
      counterLocation: 'Counter 2',
      pickupInstructions: 'Show your code',
      openingHours: [{ day: 'monday', opens: '08:00', closes: '16:00' }, { day: 'sunday', closed: true }],
    });
    expect(up.status).toBe(200);
    expect(up.body.data.storeName).toBe('Renamed Cafe');

    const bad = await http().patch('/api/vendor/profile').set(bearer(vendor.token)).send({
      storeName: 'X',
      openingHours: [{ day: 'monday', opens: '18:00', closes: '09:00' }],
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details.map((d) => d.field)).toEqual(expect.arrayContaining(['storeName']));
    expect((await http().patch('/api/vendor/profile').set(bearer(vendor.token)).send({})).status).toBe(400);

    const list = await http().get('/api/vendors?q=renamed').set(bearer(student.token));
    expect(list.body.data).toHaveLength(1);
    const one = await http().get(`/api/vendors/${vendor.vendorId}`).set(bearer(student.token));
    expect(one.status).toBe(200);

    // students cannot edit store profiles; suspended stores disappear from the public list
    expect((await http().patch('/api/vendor/profile').set(bearer(student.token)).send({ storeName: 'Hack' })).status).toBe(403);
    await http().post(`/api/admin/users/${vendor.id}/suspend`).set(bearer(admin.token)).send({ reason: 'test suspension' });
    expect((await http().get('/api/vendors').set(bearer(student.token))).body.data).toHaveLength(0);
    expect((await http().get(`/api/vendors/${vendor.vendorId}`).set(bearer(student.token))).status).toBe(404);
  });
});

describe('clear validation (feature 12)', () => {
  test('errors list each field with a plain-language message and a stable code', async () => {
    const res = await http().post('/api/auth/register').send({ name: 'S', email: 'x', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: 'VALIDATION_ERROR' } });
    const fields = res.body.error.details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    res.body.error.details.forEach((d) => expect(typeof d.message).toBe('string'));
  });

  test('malformed ids and bad JSON also use the standard envelope', async () => {
    const admin = await createAdmin();
    const badId = await http().get('/api/admin/users/not-an-id').set(bearer(admin.token));
    expect(badId.status).toBe(400);
    expect(badId.body.success).toBe(false);
    const badJson = await http().post('/api/auth/login').set('Content-Type', 'application/json').send('{oops');
    expect(badJson.status).toBe(400);
    expect(badJson.body.success).toBe(false);
  });
});

describe('admin user management (feature 13)', () => {
  test('list/filter users, view one, guard rails on suspension, audit filters', async () => {
    const admin = await createAdmin();
    const vendor = await provisionVendor(admin);
    const student = await registerStudent();

    const all = await http().get('/api/admin/users').set(bearer(admin.token));
    expect(all.body.meta.total).toBe(3);
    expect((await http().get('/api/admin/users?role=vendor').set(bearer(admin.token))).body.data).toHaveLength(1);
    expect((await http().get('/api/admin/users?q=sam').set(bearer(admin.token))).body.data).toHaveLength(1);
    const one = await http().get(`/api/admin/users/${vendor.id}`).set(bearer(admin.token));
    expect(one.body.data.store.id).toBe(vendor.vendorId);

    const self = await http().post(`/api/admin/users/${admin.id}/suspend`).set(bearer(admin.token)).send({ reason: 'oops oops' });
    expect(self.status).toBe(403);
    expect(self.body.error.code).toBe('CANNOT_SUSPEND_SELF');

    await http().post(`/api/admin/users/${student.id}/suspend`).set(bearer(admin.token)).send({ reason: 'Spam account' });
    const twice = await http().post(`/api/admin/users/${student.id}/suspend`).set(bearer(admin.token)).send({ reason: 'Spam account' });
    expect(twice.body.error.code).toBe('ALREADY_SUSPENDED');
    expect((await http().post(`/api/admin/users/${vendor.id}/reactivate`).set(bearer(admin.token))).body.error.code).toBe('NOT_SUSPENDED');

    const logs = await http().get(`/api/admin/audit-logs?action=admin.user.suspended&target=${student.id}`).set(bearer(admin.token));
    expect(logs.body.data).toHaveLength(1);
    expect(logs.body.data[0]).toMatchObject({ action: 'admin.user.suspended', actor: { email: admin.email } });
  });

  test('duplicate vendor email is a clear conflict', async () => {
    const admin = await createAdmin();
    const v = await provisionVendor(admin);
    const res = await http().post('/api/admin/vendors').set(bearer(admin.token)).send({
      name: 'Other', email: v.email, password: 'Password123', store: { storeName: 'Another', building: 'B' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });
});
