'use strict';

// HTTP behaviour that must hold even before any database is connected.
const { http } = require('../helpers/api');

describe('API without a database connection', () => {
  test('unknown route returns a JSON 404 in the standard envelope', async () => {
    const res = await http().get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  test('unknown /api routes do not reveal themselves to anonymous callers', async () => {
    expect((await http().get('/api/nope')).status).toBe(401);
  });

  test('protected route without a token is 401 JSON', async () => {
    const res = await http().get('/api/vendors');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('validation runs before the database is touched', async () => {
    const res = await http().post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  test('public meta options feed the client dropdowns', async () => {
    const res = await http().get('/api/meta/options');
    expect(res.status).toBe(200);
    expect(res.body.data.roles).toEqual(['student', 'vendor', 'admin']);
    expect(res.body.data.schoolEmailDomains).toContain('rdpolytech.ca');
  });

  test('health reports 503 while the database is down; security headers are set', async () => {
    const res = await http().get('/api/health');
    expect(res.status).toBe(503);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
