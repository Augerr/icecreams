// One-time migration: import orders from the legacy data/orders.json flat file
// into the SQLite database (data/orders.db). Run manually once during cutover:
//   node server/migrate-json-to-sqlite.mjs
import { mkdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const jsonFile = path.join(dataDir, 'orders.json');
const dbFile = path.join(dataDir, 'orders.db');

mkdirSync(dataDir, { recursive: true });
const db = new DatabaseSync(dbFile);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id            TEXT PRIMARY KEY,
    submitted_at  TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    company       TEXT NOT NULL,
    total_items   INTEGER NOT NULL,
    total_cost    REAL NOT NULL,
    paid          INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id  TEXT NOT NULL,
    name        TEXT NOT NULL,
    price       REAL NOT NULL,
    quantity    INTEGER NOT NULL,
    total       REAL NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`);

const existingCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
if (existingCount > 0) {
  console.error(`Aborting: orders.db already contains ${existingCount} order(s). Migration only runs against an empty database.`);
  db.close();
  process.exit(1);
}

const insertOrderStmt = db.prepare(`
  INSERT INTO orders (id, submitted_at, customer_name, company, total_items, total_cost, paid)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertItemStmt = db.prepare(`
  INSERT INTO order_items (order_id, product_id, name, price, quantity, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);

function insertOrder(order) {
  db.exec('BEGIN');
  try {
    insertOrderStmt.run(
      order.id,
      order.submittedAt,
      order.customer.name,
      order.customer.company,
      order.totalItems,
      order.totalCost,
      order.paid ? 1 : 0
    );

    for (const item of order.items) {
      insertItemStmt.run(order.id, item.id, item.name, item.price, item.quantity, item.total);
    }

    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

const orders = JSON.parse(await readFile(jsonFile, 'utf8'));
for (const order of orders) {
  insertOrder(order);
}

console.log(`Migrated ${orders.length} order(s) from orders.json into orders.db`);
db.close();
