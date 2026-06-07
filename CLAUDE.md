# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — runs both the Express API (`server/index.js`, with `--watch`) and the Vite dev server (`127.0.0.1`) concurrently. Vite proxies `/api` requests to `http://127.0.0.1:3001`.
- `npm run dev:server` — run only the API server.
- `npm run dev:client` — run only the Vite dev server.
- `npm run build` — build the production client bundle into `dist/`.
- `npm start` — run the Express server in production mode (serves `dist/` as static files and the `/api` routes from one process).

There is no test suite or linter configured in this project.

## Architecture

This is a small full-stack app for collecting company ice cream orders: a single-page React form posts orders to an Express API, which persists them to a SQLite database and generates an Excel workbook report from it.

- **Client** (`src/main.jsx`): a single-file React app (`App` component) rendering an order form + live summary panel. The product catalog (`PRODUCTS`) is duplicated here and in the server (`products` in `server/index.js`) — keep both in sync when changing items or prices. Submits orders via `POST /api/orders` using a relative fetch path that Vite proxies to the API in dev (and that Express serves directly in production).
- **Server** (`server/index.js`): a single-file Express app that:
  - Exposes `GET /api/products`, `GET /api/orders`, `POST /api/orders`, and `GET /api/export` (downloads a freshly-built `.xlsx`).
  - Validates/normalizes incoming orders in `normalizeOrder` (requires name, company, and at least one valid item with positive integer quantity).
  - Persists orders to a SQLite database at `data/orders.db` using the built-in `node:sqlite` module (`DatabaseSync`) — an `orders` table plus a normalized `order_items` child table (each item row snapshots the product name/price at order time, so later catalog changes don't rewrite history). `getAllOrders`/`insertOrder` are the read/write entry points; `insertOrder` wraps the order + item inserts in a transaction. WAL journal mode is enabled for concurrent read/write safety.
  - Generates the Excel workbook at `data/icecream-orders.xlsx` fresh from the database on every write via `buildWorkbookFromOrders`/`regenerateWorkbook` — an "Orders" sheet (one row per order) and an "Item Summary" sheet (aggregated quantity/revenue per product), both rebuilt from scratch each time using `createWorkbook`/`refreshSummarySheet`. There is no incremental append-and-resave step (the workbook is never read back), which avoids `exceljs` read/write fragility entirely.
  - Serves the built client from `dist/` via `express.static` for production (`npm start`).
- **Data** (`data/`): `orders.db` (+ `-wal`/`-shm` sidecar files) and `icecream-orders.xlsx` are generated at runtime and gitignored — don't expect them to exist in a fresh checkout (the schema is created on first start). `orders.json` is a legacy artifact retained only as a migration backup; it is no longer read or written by the app (see `server/migrate-json-to-sqlite.mjs` for the one-time import that moved its data into SQLite).

## Notes

- Both client and server independently define the product catalog and prices; there's no shared module. When adding/removing/repricing items, update `PRODUCTS` in `src/main.jsx` and `products` in `server/index.js` together.
- `dev.log` / `dev.err.log` are runtime log files (gitignored), not source.
