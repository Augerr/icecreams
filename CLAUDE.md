# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — runs both the Express API (`server/index.js`, with `--watch`) and the Vite dev server (`127.0.0.1`) concurrently. Vite proxies `/api` requests to `http://127.0.0.1:3001`.
- `npm run dev:server` — run only the API server.
- `npm run dev:client` — run only the Vite dev server.
- `npm run build` — build the production client bundle into `dist/`.
- `npm start` — run the Express server in production mode (serves `dist/` as static files and the `/api` routes from one process).

There is no test suite or linter configured in this project.

### Environment variables

- `ADMIN_PASSWORD` — shared password for the `/admin` catalog-management area (see below). Required for admin login to succeed; set it via `fly secrets set ADMIN_PASSWORD=...` in production and in your shell/`.env` for local dev. If unset, admin login always fails (no default).
- `PORT` — listen port (defaults to `3001`; the Dockerfile sets it to `8080` to match `fly.toml`'s `internal_port`).
- `DATA_DIR` — overrides where `orders.db`/`icecream-orders.xlsx` are stored (defaults to `data/`).

## Architecture

This is a small full-stack app for collecting company ice cream orders: a single-page React form posts orders to an Express API, which persists them to a SQLite database and generates an Excel workbook report from it. A separate `/admin` area lets one admin manage the product and company catalog at runtime.

- **Client** (`src/main.jsx`): a single-file React app (`App` component) rendering the order form + live summary panel for regular users. It fetches the product catalog and company list from `GET /api/products` / `GET /api/companies` on mount (no more hardcoded `PRODUCTS`/company list — both now live in the database, see below) and renders them localized via `product.name[language]`/`product.note[language]`. Submits orders via `POST /api/orders` using a relative fetch path that Vite proxies to the API in dev (and that Express serves directly in production).
- **Admin client** (`src/AdminApp.jsx`): rendered instead of `App` when the URL path starts with `/admin` (plain `window.location.pathname` check in `main.jsx` — no router library). Shows a password login screen (`POST /api/admin/login`, session restored via `GET /api/admin/session`), then CRUD panels for products (bilingual name/note + price) and companies, calling the `/api/admin/*` endpoints below. `src/translations.js` only covers the public order-form strings — the admin UI is English-only by design (single internal admin).
- **Server** (`server/index.js`): a single-file Express app that:
  - Exposes public `GET /api/products`, `GET /api/companies`, `GET /api/orders`, `POST /api/orders`, and `GET /api/export` (downloads a freshly-built `.xlsx`).
  - Exposes admin-only endpoints behind the `requireAdmin` session-cookie middleware: `POST /api/admin/login`, `POST /api/admin/logout`, `GET /api/admin/session`, and full CRUD (`GET`/`POST`/`PUT`/`DELETE`) at `/api/admin/products[/:id]` and `/api/admin/companies[/:id]`. Sessions are random tokens kept in an in-memory `Map` (`sessions`) with a 12h TTL and an `httpOnly`/`sameSite=strict` cookie (`admin_session`) — they reset on server restart, which is fine for a single-admin tool.
  - Validates/normalizes incoming orders in `normalizeOrder` (requires name, company, and at least one valid item with positive integer quantity, looked up via `getProductById`).
  - Persists orders to a SQLite database at `data/orders.db` using the built-in `node:sqlite` module (`DatabaseSync`) — an `orders` table, a normalized `order_items` child table (each item row snapshots the product's English name/price at order time, so later catalog changes don't rewrite history), plus `products` and `companies` catalog tables (seeded once from `seedProducts`/`seedCompanies` if empty on first start). `getAllOrders`/`insertOrder`, `getAllProducts`/`getProductById`, and `getAllCompanies` are the read entry points; `insertOrder` wraps the order + item inserts in a transaction. WAL journal mode is enabled for concurrent read/write safety.
  - Generates the Excel workbook at `data/icecream-orders.xlsx` fresh from the database on every write via `buildWorkbookFromOrders`/`regenerateWorkbook` — an "Orders" sheet (one row per order, columns built dynamically from the *current* product list) and an "Item Summary" sheet (aggregated quantity/revenue per product), both rebuilt from scratch each time using `createWorkbook`/`refreshSummarySheet`. There is no incremental append-and-resave step (the workbook is never read back), which avoids `exceljs` read/write fragility entirely. Because the catalog can change at runtime, these functions re-fetch `getAllProducts()` on each call rather than closing over a static list.
  - Serves the built client from `dist/` via `express.static`, then a catch-all `GET` route serves `dist/index.html` for any non-`/api` path (SPA fallback so `/admin` works on direct navigation/refresh in production; Vite's dev server already does this itself).
- **Data** (`data/`): `orders.db` (+ `-wal`/`-shm` sidecar files) and `icecream-orders.xlsx` are generated at runtime and gitignored — don't expect them to exist in a fresh checkout (the schema, including `products`/`companies` seeding, runs on first start). `orders.json` is a legacy artifact retained only as a migration backup; it is no longer read or written by the app (see `server/migrate-json-to-sqlite.mjs` for the one-time import that moved its data into SQLite).

## Notes

- The product catalog and company list now live solely in the database (`products`/`companies` tables), managed via the `/admin` UI — there is no longer a static catalog to keep in sync between client and server. Each product has bilingual `name`/`note` fields (`name_en`/`name_fr`/`note_en`/`note_fr`) so the language switcher keeps working for admin-added items.
- `dev.log` / `dev.err.log` are runtime log files (gitignored), not source.
