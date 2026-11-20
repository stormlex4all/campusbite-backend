'use strict';

const Subject = require('../../src/core/Subject');
const EventBus = require('../../src/core/EventBus');
const Config = require('../../src/config');
const Logger = require('../../src/core/Logger');
const ErrorFactory = require('../../src/core/errors/ErrorFactory');
const AppError = require('../../src/core/errors/AppError');

describe('Singleton', () => {
  test('Config, Logger and EventBus return one shared instance', () => {
    expect(Config.getInstance()).toBe(Config.getInstance());
    expect(Logger.getInstance()).toBe(Logger.getInstance());
    expect(EventBus.getInstance()).toBe(EventBus.getInstance());
  });

  test('Config is immutable and validated', () => {
    const cfg = Config.get();
    expect(Object.isFrozen(cfg)).toBe(true);
    expect(() => Config.getInstance({ JWT_ACCESS_SECRET: 'short' })).not.toThrow();
  });
});

describe('Observer (Subject / EventBus)', () => {
  test('exact, prefix and wildcard subscriptions all receive matching events', async () => {
    const s = new Subject();
    const seen = [];
    s.subscribe('reservation.created', (e) => seen.push(['exact', e.payload]));
    s.subscribe('reservation.*', (e) => seen.push(['prefix', e.payload]));
    s.subscribe('*', (e) => seen.push(['all', e.payload]));
    await s.notify({ name: 'reservation.created', payload: 1 });
    await s.notify({ name: 'admin.user.approved', payload: 2 });
    expect(seen.filter((x) => x[1] === 1).map((x) => x[0]).sort()).toEqual(['all', 'exact', 'prefix']);
    expect(seen.filter((x) => x[1] === 2).map((x) => x[0])).toEqual(['all']);
  });

  test('a failing observer does not stop the others and unsubscribe works', async () => {
    const s = new Subject();
    const ok = jest.fn();
    s.subscribe('x', () => {
      throw new Error('boom');
    });
    const off = s.subscribe('x', ok);
    const r = await s.notify({ name: 'x', payload: 'a' });
    expect(r).toEqual({ delivered: 1, failed: 1 });
    expect(ok).toHaveBeenCalledTimes(1);
    off();
    await s.notify({ name: 'x', payload: 'b' });
    expect(ok).toHaveBeenCalledTimes(1);
  });
});

describe('ErrorFactory', () => {
  test('creates AppErrors with status and code', () => {
    const e = ErrorFactory.notFound('Offer');
    expect(e).toBeInstanceOf(AppError);
    expect(e.statusCode).toBe(404);
    expect(ErrorFactory.conflict('x', { code: 'C' }).code).toBe('C');
    expect(ErrorFactory.unauthorized().statusCode).toBe(401);
    expect(ErrorFactory.forbidden().statusCode).toBe(403);
  });

  test('normalizes unknown errors to a safe 500', () => {
    const e = ErrorFactory.normalize(new Error('secret db detail'));
    expect(e.statusCode).toBe(500);
    expect(e.message).not.toMatch(/secret/);
  });
});
