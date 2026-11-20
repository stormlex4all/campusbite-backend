# CampusBite – Node.js backend API

REST API for **CampusBite**, a surplus-food marketplace for students and vendors of Red Deer Polytechnic.
It is the single backend for the **React web app** and **React Native (Expo) app** that will be completed later, and can optionally serve the built React app itself.

> **Current scope (step 1 of the build): features 1, 2, 12 and 13 only** – accounts and roles, vendor store profiles, clear validation, and the admin panel. Listings, reservations, notifications, QR pickup and the vendor summary (features 3–11, 14) are added in later steps.

Stack: Node.js 22 · Express 4 · MongoDB (Mongoose 8) · Zod · JWT · Jest + Supertest.

## Quick start

```bash
npm install
npm run seed                # creates the first admin (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run seed:demo           # optional: two demo vendors and a student (password Password123!)
npm run dev                 # http://localhost:4000/api/health
```

You need a MongoDB: local `mongod`, Docker, or MongoDB Atlas (we will use Atlas for now).
For multi-document transactions use a replica set (Atlas already is one; locally, a single-node replica set is enough).
On a standalone `mongod` the API still works: stock is protected by atomic conditional updates with compensation. `USE_TRANSACTIONS=auto` detects which mode applies.

## Scripts

| Script | What it does |
|---|---|
| `npm start` / `npm run dev` | run the API (dev uses nodemon) |
| `npm run seed`, `npm run seed:demo` | create the admin / demo data |
| `npm test` | all tests (needs MongoDB, see below) |
| `npm run test:unit` | unit tests only, no database needed |

Integration tests need a running MongoDB. Put its address in `TEST_MONGODB_URI`.

## Environment variables

See `.env.example` (every variable is documented there and validated at startup by `src/config`). Important ones: `MONGODB_URI`, `JWT_ACCESS_SECRET` (required, 16+ chars, in production), `SCHOOL_EMAIL_DOMAINS` (students must register with one of these), `CORS_ORIGINS`, `CLIENT_BUILD_DIR` (optionally serve the React build).

## Response format

```jsonc
// success
{ "success": true, "data": { ... }, "meta": { "page": 1, "limit": 20, "total": 57, "totalPages": 3 } }
// failure (same shape for every error; show error.message to users, branch on error.code)
{ "success": false, "error": { "code": "SOLD_OUT", "message": "Sorry, this offer has sold out...", "details": [ { "field": "quantity", "message": "..." } ] } }
```

Validation is enforced on the server for every request (`400 VALIDATION_ERROR` with per-field `details`).

## Authentication flow (web and mobile)

1. `POST /api/auth/register` (students) or `POST /api/auth/login` → `{ user, tokens: { accessToken, refreshToken } }`.
2. Send `Authorization: Bearer <accessToken>` (15 min lifetime).
3. On `401` from an expired access token call `POST /api/auth/refresh { refreshToken }`. Refresh tokens **rotate**: store the new pair every time. Re-using an old refresh token revokes the whole session family.
4. `POST /api/auth/logout { refreshToken }` revokes it. On React Native keep tokens in `expo-secure-store`; on the web prefer memory plus the refresh token in storage you are comfortable with.

Suspending a user takes effect immediately (the user is re-loaded on every request) and their refresh tokens are revoked.

## Endpoints (all under `/api`)

**Public:** `GET /health` · `GET /meta/options` (roles, statuses, weekdays, school email domains, password rules) · `POST /auth/register` (students) · `POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout`

**Any signed-in user:** `GET/PATCH /auth/me` · `POST /auth/change-password` · `GET /vendors?q=` and `GET /vendors/:id` (only stores whose owner account is active)

**Vendor:** `GET /vendor/profile` · `PATCH /vendor/profile` (storeName, description, building, counterLocation, openingHours, pickupInstructions)

**Vendor menu items (recurring items):** `GET/POST /vendor/menu-items` · `GET/PATCH /vendor/menu-items/:id` · `POST /vendor/menu-items/:id/archive|restore` · `POST /vendor/menu-items/:id/images` (multipart: `image` file + `alt` text; JPEG/PNG/WebP, checked by content, up to `MAX_IMAGES_PER_ITEM`) · `DELETE /vendor/menu-items/:id/images/:imageId`

**Vendor listings:** `POST /vendor/listings` with `source: "menu_item"` (+ `menuItemId`, optional `price`) or `source: "one_off"` (+ `title`, `description`, `price`), plus `quantityTotal`, `pickupStart`, `pickupEnd` (max 12 h) · `GET /vendor/listings?status=active|closed|all` · `GET /vendor/listings/:id` · `POST /vendor/listings/:id/close|reopen`

**Students see:** `GET /vendors/:id/listings` (live listings only: open, not ended, portions left). Photos are served as `/uploads/<file>`.

**Admin:** `GET /admin/users?role=&status=&q=` · `GET /admin/users/:id` · `POST /admin/vendors` (provision a vendor account + store) · `POST /admin/users/:id/approve` · `POST /admin/users/:id/suspend {reason}` · `POST /admin/users/:id/reactivate` · `GET /admin/audit-logs?action=&target=`

## Features in this step

| # | Feature | Code |
|---|---|---|
| 1 | Student/vendor accounts with roles | `modules/auth`, `modules/users`, `factories/UserFactory`, `middleware/authenticate|authorize` |
| 2 | Vendor store profiles | `modules/vendors` |
| 12 | Clear validation and consistent errors | Zod validators + `middleware/validate`, `core/errors/ErrorFactory`, `middleware/errorHandler` (every error: `{success:false, error:{code, message, details:[{field,message}]}}`) |
| – | Recurring menu items with photos, and listings (from a menu item or one-off) | `modules/menu`, `modules/listings`, `storage/` (StorageFactory), `middleware/uploadImage`, `utils/imageType` |
| 13 | Admin panel (approve, suspend, reactivate, audit log) | `modules/admin`, `observers/AuditObserver` |

## Design patterns

* **Singleton** – `Config`, `Logger`, `Database`, `EventBus` (`getInstance()`, `reset()` for tests).
* **Factory** – `ErrorFactory` (typed API errors) and `UserFactory` (student/vendor/admin creation rules).
* **Observer** – `core/Subject` (exact, `prefix.*` and `*` subscriptions; a failing observer never breaks a request) → `EventBus`. Admin services publish domain events (`admin.vendor.provisioned`, `admin.user.suspended`, …); `AuditObserver` records them without the services knowing about it. Later steps add more observers (e.g. notifications).

## Structure

```
src/
  config/        Config singleton (validated env)
  core/          Logger, Database, Subject/EventBus, errors, http helpers
  factories/     UserFactory
  observers/     AuditObserver, registerObservers()
  middleware/    authenticate, authorize, validate, errorHandler, rateLimiters
  modules/       auth, users, vendors, admin, meta
                 (each: model, validators, service, controller, routes)
scripts/seed.js  admin + demo data
tests/           unit/ and integration/
```

Layering: routes → validators → controller (HTTP only) → service (business rules) → model. Controllers contain no business logic and services never touch `req`/`res`.

## Notes for the React and React Native clients

* CORS is an allow-list (`CORS_ORIGINS`); native apps are not affected by CORS. For a phone on your LAN use your machine's IP as the API base URL, not `localhost`.
* `GET /api/meta/options` lets both clients build forms from server-side lists so they never drift.
* Show `error.message` to users; use `error.details[].field` to mark the matching form field and `error.code` for logic.

## Menu items, photos and listings

* A **menu item** is a recurring product the vendor saves once (name, usual price, up to 4 photos). A **listing** is one offer for one pickup window. It is created from a menu item (name, description, price and photos are **copied**, so later edits never change an existing listing) or as a one-off.
* Photos: stored on disk under `UPLOAD_DIR` with random names (`MAX_IMAGE_MB`, default 2 MB). The file type is read from the file's first bytes, not from its name or the browser's type. Storage sits behind `StorageFactory`, so a cloud driver can replace the local one. The per-item limit is enforced atomically in the database; a file whose database update fails is removed again. Removing a photo from a menu item keeps the file while a listing still uses it.
