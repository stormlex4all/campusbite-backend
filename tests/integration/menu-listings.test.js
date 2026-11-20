'use strict';

const fs = require('fs');
const path = require('path');
const { startDb, stopDb, clearDb } = require('../helpers/db');
const { http, bearer, registerStudent, createAdmin, provisionVendor } = require('../helpers/api');

beforeAll(startDb);
afterAll(stopDb);
beforeEach(clearDb);

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 2)]);
const hours = (h) => new Date(Date.now() + h * 3600 * 1000).toISOString();

async function setup() {
  const admin = await createAdmin();
  const vendor = await provisionVendor(admin);
  const other = await provisionVendor(admin);
  const student = await registerStudent();
  return { admin, vendor, other, student };
}
const createItem = (v, body = {}) =>
  http().post('/api/vendor/menu-items').set(bearer(v.token)).send({ name: 'Butter Chicken Wrap', description: 'Spicy', defaultPrice: 6.5, ...body });
const upload = (v, id, buf = PNG, name = 'a.png', alt = 'A wrap') =>
  http().post(`/api/vendor/menu-items/${id}/images`).set(bearer(v.token)).field('alt', alt).attach('image', buf, name);
const uploadedFiles = () => (fs.existsSync(process.env.UPLOAD_DIR) ? fs.readdirSync(process.env.UPLOAD_DIR) : []);

describe('menu items', () => {
  test('vendor creates, lists, updates; duplicates and other vendors are handled', async () => {
    const { vendor, other, student } = await setup();
    const c = await createItem(vendor);
    expect(c.status).toBe(201);
    expect(c.body.data).toMatchObject({ name: 'Butter Chicken Wrap', defaultPrice: 6.5, status: 'active', images: [] });

    expect((await createItem(vendor, { name: '  butter chicken WRAP ' })).status).toBe(409);
    expect((await createItem(other)).status).toBe(201); // same name, different vendor is fine

    const list = await http().get('/api/vendor/menu-items').set(bearer(vendor.token));
    expect(list.body.data).toHaveLength(1);

    const up = await http().patch(`/api/vendor/menu-items/${c.body.data.id}`).set(bearer(vendor.token)).send({ defaultPrice: 7 });
    expect(up.body.data.defaultPrice).toBe(7);
    expect((await http().patch(`/api/vendor/menu-items/${c.body.data.id}`).set(bearer(vendor.token)).send({})).status).toBe(400);

    expect((await http().get(`/api/vendor/menu-items/${c.body.data.id}`).set(bearer(other.token))).status).toBe(404);
    expect((await http().get('/api/vendor/menu-items').set(bearer(student.token))).status).toBe(403);
    expect((await http().get('/api/vendor/menu-items')).status).toBe(401);
  });

  test('archive hides from default list and blocks use; restore brings it back', async () => {
    const { vendor } = await setup();
    const id = (await createItem(vendor)).body.data.id;
    expect((await http().post(`/api/vendor/menu-items/${id}/archive`).set(bearer(vendor.token))).body.data.status).toBe('archived');
    expect((await http().get('/api/vendor/menu-items').set(bearer(vendor.token))).body.data).toHaveLength(0);
    expect((await http().get('/api/vendor/menu-items?status=all').set(bearer(vendor.token))).body.data).toHaveLength(1);
    const blocked = await http().post('/api/vendor/listings').set(bearer(vendor.token))
      .send({ source: 'menu_item', menuItemId: id, quantityTotal: 3, pickupStart: hours(1), pickupEnd: hours(2) });
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('MENU_ITEM_ARCHIVED');
    expect((await http().post(`/api/vendor/menu-items/${id}/restore`).set(bearer(vendor.token))).body.data.status).toBe('active');
  });
});

describe('menu item photos', () => {
  test('uploads png/jpg, serves them, enforces limit, deletes files on removal', async () => {
    const { vendor } = await setup();
    const id = (await createItem(vendor)).body.data.id;
    const a = await upload(vendor, id, PNG, 'a.png', 'Front view');
    expect(a.status).toBe(201);
    expect(a.body.data.images[0]).toMatchObject({ alt: 'Front view' });
    expect(a.body.data.images[0].url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    expect(uploadedFiles()).toHaveLength(1);

    const served = await http().get(a.body.data.images[0].url);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toMatch(/image\/png/);

    expect((await upload(vendor, id, JPG, 'b.jpg')).status).toBe(201);
    await upload(vendor, id, JPG, 'c.jpg');
    const fourth = await upload(vendor, id, JPG, 'd.jpg');
    expect(fourth.body.data.images).toHaveLength(4);
    const fifth = await upload(vendor, id, JPG, 'e.jpg');
    expect(fifth.status).toBe(409);
    expect(fifth.body.error.code).toBe('IMAGE_LIMIT_REACHED');
    expect(uploadedFiles()).toHaveLength(4); // rejected upload left no orphan

    const imgId = fourth.body.data.images[0].id;
    const del = await http().delete(`/api/vendor/menu-items/${id}/images/${imgId}`).set(bearer(vendor.token));
    expect(del.status).toBe(200);
    expect(del.body.data.images).toHaveLength(3);
    expect(uploadedFiles()).toHaveLength(3);
  });

  test('rejects fake types by content, missing file, oversize, and other vendors', async () => {
    const { vendor, other } = await setup();
    const id = (await createItem(vendor)).body.data.id;
    const fake = await upload(vendor, id, Buffer.from('<?php echo 1; ?> not an image at all'), 'x.png');
    expect(fake.status).toBe(422);
    expect(fake.body.error.code).toBe('UNSUPPORTED_IMAGE_TYPE');

    const none = await http().post(`/api/vendor/menu-items/${id}/images`).set(bearer(vendor.token));
    expect(none.status).toBe(400);

    const big = await upload(vendor, id, Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]), 'big.png');
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('IMAGE_TOO_LARGE');

    expect((await upload(other, id)).status).toBe(404);
    expect(uploadedFiles()).toHaveLength(0);
  });
});

describe('listings', () => {
  test('from a menu item: copies details and photos, defaults price, survives menu edits and photo removal', async () => {
    const { vendor, student } = await setup();
    const id = (await createItem(vendor)).body.data.id;
    const withImg = await upload(vendor, id);
    const imgId = withImg.body.data.images[0].id;

    const res = await http().post('/api/vendor/listings').set(bearer(vendor.token))
      .send({ source: 'menu_item', menuItemId: id, quantityTotal: 5, pickupStart: hours(1), pickupEnd: hours(3) });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ source: 'menu_item', title: 'Butter Chicken Wrap', price: 6.5, quantityAvailable: 5, state: 'live' });
    expect(res.body.data.images).toHaveLength(1);

    await http().patch(`/api/vendor/menu-items/${id}`).set(bearer(vendor.token)).send({ name: 'Renamed', defaultPrice: 9 });
    const mine = await http().get(`/api/vendor/listings/${res.body.data.id}`).set(bearer(vendor.token));
    expect(mine.body.data).toMatchObject({ title: 'Butter Chicken Wrap', price: 6.5 });

    // removing the photo from the menu item keeps the file because the listing still uses it
    await http().delete(`/api/vendor/menu-items/${id}/images/${imgId}`).set(bearer(vendor.token));
    expect(uploadedFiles()).toHaveLength(1);
    expect((await http().get(res.body.data.images[0].url)).status).toBe(200);

    const override = await http().post('/api/vendor/listings').set(bearer(vendor.token))
      .send({ source: 'menu_item', menuItemId: id, price: 3, quantityTotal: 2, pickupStart: hours(1), pickupEnd: hours(2) });
    expect(override.body.data.price).toBe(3);
    expect(student).toBeTruthy();
  });

  test('one-off listing, validation and window rules', async () => {
    const { vendor } = await setup();
    const ok = await http().post('/api/vendor/listings').set(bearer(vendor.token))
      .send({ source: 'one_off', title: 'Leftover soup', price: 2, quantityTotal: 4, pickupStart: hours(1), pickupEnd: hours(2) });
    expect(ok.status).toBe(201);
    expect(ok.body.data).toMatchObject({ source: 'one_off', menuItemId: null, images: [] });

    const post = (b) => http().post('/api/vendor/listings').set(bearer(vendor.token)).send(b);
    const base = { source: 'one_off', title: 'Soup', price: 2, quantityTotal: 4 };
    expect((await post({ ...base, pickupStart: hours(2), pickupEnd: hours(1) })).status).toBe(400);
    expect((await post({ ...base, pickupStart: hours(1), pickupEnd: hours(20) })).status).toBe(400);
    expect((await post({ ...base, pickupStart: hours(-3), pickupEnd: hours(-2) })).body.error.code).toBe('PICKUP_WINDOW_IN_PAST');
    expect((await post({ ...base, source: 'bogus', pickupStart: hours(1), pickupEnd: hours(2) })).status).toBe(400);
    expect((await post({ source: 'menu_item', menuItemId: 'nope', quantityTotal: 1, pickupStart: hours(1), pickupEnd: hours(2) })).status).toBe(400);
  });

  test('cannot use another vendor\'s menu item; close/reopen; students see only live listings', async () => {
    const { vendor, other, student } = await setup();
    const id = (await createItem(other)).body.data.id;
    const win = { quantityTotal: 2, pickupStart: hours(1), pickupEnd: hours(2) };
    expect((await http().post('/api/vendor/listings').set(bearer(vendor.token)).send({ source: 'menu_item', menuItemId: id, ...win })).status).toBe(404);

    const l = await http().post('/api/vendor/listings').set(bearer(vendor.token)).send({ source: 'one_off', title: 'Soup', price: 2, ...win });
    const pub = () => http().get(`/api/vendors/${vendor.vendorId}/listings`).set(bearer(student.token));
    expect((await pub()).body.data).toHaveLength(1);

    expect((await http().post(`/api/vendor/listings/${l.body.data.id}/close`).set(bearer(vendor.token))).body.data.status).toBe('closed');
    expect((await pub()).body.data).toHaveLength(0);
    expect((await http().get('/api/vendor/listings').set(bearer(vendor.token))).body.data).toHaveLength(0);
    expect((await http().get('/api/vendor/listings?status=closed').set(bearer(vendor.token))).body.data).toHaveLength(1);
    expect((await http().post(`/api/vendor/listings/${l.body.data.id}/reopen`).set(bearer(vendor.token))).body.data.status).toBe('active');
    expect((await pub()).body.data).toHaveLength(1);

    expect((await http().get(`/api/vendors/${vendor.vendorId}/listings`)).status).toBe(401);
    expect((await http().get('/api/vendor/listings/' + l.body.data.id).set(bearer(other.token))).status).toBe(404);
    expect((await http().get('/api/vendors/000000000000000000000000/listings').set(bearer(student.token))).status).toBe(404);
  });
});
