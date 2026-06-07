import cors from 'cors';
import ExcelJS from 'exceljs';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'orders.db');
const workbookFile = path.join(dataDir, 'icecream-orders.xlsx');
const port = process.env.PORT || 3001;

const products = [
  { id: 'vanilla_cup', name: 'Vanilla Cup', price: 3.5 },
  { id: 'chocolate_cup', name: 'Chocolate Cup', price: 3.5 },
  { id: 'strawberry_cup', name: 'Strawberry Cup', price: 3.5 },
  { id: 'mint_chip', name: 'Mint Chip', price: 4 },
  { id: 'sandwich', name: 'Ice Cream Sandwich', price: 4.25 },
  { id: 'fudge_bar', name: 'Fudge Bar', price: 3.75 }
];

const productById = new Map(products.map((product) => [product.id, product]));

const app = express();

app.use(cors());
app.use(express.json());

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

const insertOrderStmt = db.prepare(`
  INSERT INTO orders (id, submitted_at, customer_name, company, total_items, total_cost, paid)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const insertItemStmt = db.prepare(`
  INSERT INTO order_items (order_id, product_id, name, price, quantity, total)
  VALUES (?, ?, ?, ?, ?, ?)
`);
const selectOrdersStmt = db.prepare('SELECT * FROM orders ORDER BY submitted_at ASC');
const selectItemsForOrderStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');

function rowToOrder(orderRow) {
  const items = selectItemsForOrderStmt.all(orderRow.id).map((itemRow) => ({
    id: itemRow.product_id,
    quantity: itemRow.quantity,
    name: itemRow.name,
    price: itemRow.price,
    total: itemRow.total
  }));

  return {
    id: orderRow.id,
    submittedAt: orderRow.submitted_at,
    customer: { name: orderRow.customer_name, company: orderRow.company },
    items,
    totalItems: orderRow.total_items,
    totalCost: orderRow.total_cost,
    paid: Boolean(orderRow.paid)
  };
}

function getAllOrders() {
  return selectOrdersStmt.all().map(rowToOrder);
}

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

function getItemQuantities(order) {
  const itemQuantities = Object.fromEntries(products.map((product) => [product.id, 0]));
  for (const item of order.items) {
    itemQuantities[item.id] = item.quantity;
  }

  return itemQuantities;
}

const ordersColumns = [
  { header: 'Name', key: 'name', width: 24 },
  { header: 'Company', key: 'company', width: 24 },
  ...products.map((product) => ({ header: product.name, key: product.id, width: 18 })),
  { header: 'Total Items', key: 'totalItems', width: 14 },
  { header: 'Amount Due', key: 'totalCost', width: 14 },
  { header: 'Paid', key: 'paid', width: 10 }
];

const summaryColumns = [
  { header: 'Item', key: 'name', width: 28 },
  { header: 'Quantity', key: 'quantity', width: 14 },
  { header: 'Revenue', key: 'revenue', width: 14 }
];

function createWorkbook() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ice Cream Orders';
  workbook.created = new Date();

  const ordersSheet = workbook.addWorksheet('Orders');
  ordersSheet.columns = ordersColumns;
  ordersSheet.getRow(1).font = { bold: true };
  ordersSheet.getColumn('totalCost').numFmt = '$0.00';

  const summarySheet = workbook.addWorksheet('Item Summary');
  summarySheet.columns = summaryColumns;
  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getColumn('revenue').numFmt = '$0.00';

  return workbook;
}

function refreshSummarySheet(workbook, orders) {
  const existingSheet = workbook.getWorksheet('Item Summary');
  if (existingSheet) {
    workbook.removeWorksheet(existingSheet.id);
  }

  const summarySheet = workbook.addWorksheet('Item Summary');
  summarySheet.columns = [
    { header: 'Item', key: 'name', width: 28 },
    { header: 'Quantity', key: 'quantity', width: 14 },
    { header: 'Revenue', key: 'revenue', width: 14 }
  ];

  for (const product of products) {
    const quantity = orders.reduce((sum, order) => {
      const item = order.items.find((orderItem) => orderItem.id === product.id);
      return sum + (item?.quantity || 0);
    }, 0);

    summarySheet.addRow({
      name: product.name,
      quantity,
      revenue: quantity * product.price
    });
  }

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getColumn('revenue').numFmt = '$0.00';
}

function buildWorkbookFromOrders(orders) {
  const workbook = createWorkbook();
  const ordersSheet = workbook.getWorksheet('Orders');

  for (const order of orders) {
    ordersSheet.addRow({
      name: order.customer.name,
      company: order.customer.company,
      ...getItemQuantities(order),
      totalItems: order.totalItems,
      totalCost: order.totalCost,
      paid: order.paid ? 'Yes' : 'No'
    });
  }

  refreshSummarySheet(workbook, orders);
  workbook.modified = new Date();
  return workbook;
}

async function regenerateWorkbook() {
  const workbook = buildWorkbookFromOrders(getAllOrders());
  await workbook.xlsx.writeFile(workbookFile);
}

function normalizeOrder(body) {
  const name = String(body?.customer?.name || '').trim();
  const company = String(body?.customer?.company || '').trim();
  const requestedItems = Array.isArray(body?.items) ? body.items : [];

  const items = requestedItems
    .map((item) => ({
      id: String(item.id || ''),
      quantity: Number.parseInt(item.quantity, 10)
    }))
    .filter((item) => productById.has(item.id) && Number.isInteger(item.quantity) && item.quantity > 0)
    .map((item) => ({
      ...item,
      name: productById.get(item.id).name,
      price: productById.get(item.id).price,
      total: item.quantity * productById.get(item.id).price
    }));

  if (!name || !company) {
    return { error: 'Name and company are required.' };
  }

  if (items.length === 0) {
    return { error: 'Select at least one item.' };
  }

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalCost = items.reduce((sum, item) => sum + item.total, 0);

  return {
    id: randomUUID(),
    submittedAt: new Date().toISOString(),
    customer: { name, company },
    items,
    totalItems,
    totalCost,
    paid: false
  };
}

app.get('/api/products', (_request, response) => {
  response.json({ products });
});

app.get('/api/orders', (_request, response, next) => {
  try {
    response.json({ orders: getAllOrders() });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  try {
    const order = normalizeOrder(request.body);

    if (order.error) {
      response.status(400).json({ error: order.error });
      return;
    }

    insertOrder(order);
    await regenerateWorkbook();

    response.status(201).json({ order });
  } catch (error) {
    next(error);
  }
});

app.get('/api/export', async (_request, response, next) => {
  try {
    const workbook = buildWorkbookFromOrders(getAllOrders());
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="icecream-orders.xlsx"');
    await workbook.xlsx.write(response);
    response.end();
  } catch (error) {
    next(error);
  }
});

app.use(express.static(path.join(rootDir, 'dist')));

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => {
  console.log(`Ice Cream Orders API listening on http://localhost:${port}`);
});
