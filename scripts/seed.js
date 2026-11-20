'use strict';

/**
 * Seed script.
 *   npm run seed        creates the administrator account (idempotent)
 *   npm run seed:demo   also creates demo vendors, and a demo student (not for production)
 */
require('dotenv').config({ quiet: true });

const Config = require('../src/config');
const Database = require('../src/core/Database');
const UserFactory = require('../src/factories/UserFactory');
const User = require('../src/modules/users/user.model');
const Vendor = require('../src/modules/vendors/vendor.model');
const { ROLES } = require('../src/constants');

const DEMO_PASSWORD = 'Password123!';

async function ensureUser(role, input) {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) return { user: existing, created: false };
  const user = await UserFactory.create(role, input);
  await user.save();
  return { user, created: true };
}

async function seedAdmin() {
  const config = Config.get();
  const email = process.env.ADMIN_EMAIL || 'admin@campusbite.local';
  const password = process.env.ADMIN_PASSWORD;
  if (config.isProduction && !password) throw new Error('Set ADMIN_PASSWORD to seed an administrator in production.');
  const { created } = await ensureUser(ROLES.ADMIN, {
    name: process.env.ADMIN_NAME || 'CampusBite Admin',
    email,
    password: password || 'ChangeMe123!',
  });
  console.log(created ? `Created administrator ${email}` : `Administrator ${email} already exists`);
}

async function seedDemo() {
  if (Config.get().isProduction) throw new Error('Refusing to seed demo data in production.');

  const stores = [
    {
      account: { name: 'Campus Cafe Manager', email: 'cafe@campusbite.local' },
      store: {
        storeName: 'Campus Cafe',
        description: 'Coffee, sandwiches and baked goods on the main concourse.',
        building: 'Main Building',
        counterLocation: 'Main concourse, counter 2',
        pickupInstructions: 'Show your pickup code at the till.',
        openingHours: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((day) => ({ day, opens: '07:30', closes: '17:00' })),
      },
    },
    {
      account: { name: 'Polytech Grill Manager', email: 'grill@campusbite.local' },
      store: {
        storeName: 'Polytech Grill',
        description: 'Hot lunches and bowls.',
        building: 'Student Centre',
        counterLocation: 'Food court, window B',
        pickupInstructions: 'Ask for CampusBite pickups at window B.',
      },
    },
  ];

  for (const entry of stores) {
    const { user } = await ensureUser(ROLES.VENDOR, { ...entry.account, password: DEMO_PASSWORD, status: 'active' });
    let vendor = await Vendor.findOne({ owner: user._id });
    if (!vendor) vendor = await Vendor.create({ owner: user._id, ...entry.store, isActive: true });
    console.log(`Demo vendor ${entry.account.email} ready (${vendor.storeName})`);
  }

  const domain = Config.get().auth.schoolEmailDomains[0];
  const student = await ensureUser(ROLES.STUDENT, { name: 'Demo Student', email: `student@${domain}`, password: DEMO_PASSWORD });
  console.log(`Demo student student@${domain} ${student.created ? 'created' : 'already exists'}`);
  console.log(`Demo password for demo accounts: ${DEMO_PASSWORD}`);
}

async function main() {
  const db = Database.getInstance();
  await db.connect();
  try {
    await seedAdmin();
    if (process.argv.includes('--demo')) await seedDemo();
  } finally {
    await db.disconnect();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
