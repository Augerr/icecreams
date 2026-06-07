import cookieParser from 'cookie-parser';
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
const dataDir = process.env.DATA_DIR || path.join(rootDir, 'data');
const dbFile = path.join(dataDir, 'orders.db');
const workbookFile = path.join(dataDir, 'icecream-orders.xlsx');
const port = process.env.PORT || 3001;
const adminPassword = process.env.ADMIN_PASSWORD || '';

const seedProducts = [
  { id: 'vanilla_cup', nameEn: 'Vanilla Cup', nameFr: 'Coupe vanille', noteEn: 'Classic vanilla, single-serve cup', noteFr: 'Vanille classique, format individuel', price: 3.5 },
  { id: 'chocolate_cup', nameEn: 'Chocolate Cup', nameFr: 'Coupe chocolat', noteEn: 'Rich chocolate, single-serve cup', noteFr: 'Chocolat riche, format individuel', price: 3.5 },
  { id: 'strawberry_cup', nameEn: 'Strawberry Cup', nameFr: 'Coupe fraise', noteEn: 'Strawberry cream, single-serve cup', noteFr: 'Crème à la fraise, format individuel', price: 3.5 },
  { id: 'mint_chip', nameEn: 'Mint Chip', nameFr: 'Menthe et brisures', noteEn: 'Mint ice cream with chocolate chips', noteFr: 'Crème glacée à la menthe avec brisures de chocolat', price: 4 },
  { id: 'sandwich', nameEn: 'Ice Cream Sandwich', nameFr: 'Sandwich glacé', noteEn: 'Vanilla center with cookie wafers', noteFr: 'Centre à la vanille entre deux gaufrettes', price: 4.25 },
  { id: 'fudge_bar', nameEn: 'Fudge Bar', nameFr: 'Barre fudge', noteEn: 'Chocolate fudge frozen bar', noteFr: 'Barre glacée au fudge au chocolat', price: 3.75 }
];

const seedCompanies = ['Agropur', 'Company B', 'Company C'];

const app = express();

app.use(cors());
app.use(express.json());
app.use(cookieParser());

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

  CREATE TABLE IF NOT EXISTS products (
    id        TEXT PRIMARY KEY,
    name_en   TEXT NOT NULL,
    name_fr   TEXT NOT NULL,
    note_en   TEXT NOT NULL DEFAULT '',
    note_fr   TEXT NOT NULL DEFAULT '',
    price     REAL NOT NULL,
    position  INTEGER NOT NULL,
    active    INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS companies (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT NOT NULL UNIQUE
  );
`);

const productColumns = db.prepare('PRAGMA table_info(products)').all();
if (!productColumns.some((column) => column.name === 'active')) {
  db.exec('ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1');
}

if (db.prepare('SELECT COUNT(*) AS count FROM products').get().count === 0) {
  const insertSeedProduct = db.prepare(`
    INSERT INTO products (id, name_en, name_fr, note_en, note_fr, price, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  seedProducts.forEach((product, index) => {
    insertSeedProduct.run(product.id, product.nameEn, product.nameFr, product.noteEn, product.noteFr, product.price, index);
  });
}

if (db.prepare('SELECT COUNT(*) AS count FROM companies').get().count === 0) {
  const insertSeedCompany = db.prepare('INSERT INTO companies (name) VALUES (?)');
  for (const name of seedCompanies) {
    insertSeedCompany.run(name);
  }
}

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

function rowToProduct(row) {
  return {
    id: row.id,
    name: { en: row.name_en, fr: row.name_fr },
    note: { en: row.note_en, fr: row.note_fr },
    price: row.price,
    active: Boolean(row.active)
  };
}

function getAllProducts() {
  return db.prepare('SELECT * FROM products ORDER BY position ASC, rowid ASC').all().map(rowToProduct);
}

function getProductById(id) {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return row ? rowToProduct(row) : undefined;
}

function getAllCompanies() {
  return db.prepare('SELECT * FROM companies ORDER BY name ASC').all().map((row) => ({ id: row.id, name: row.name }));
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function generateProductId(nameEn) {
  const base = slugify(nameEn) || 'item';
  let candidate = base;
  let suffix = 2;
  while (db.prepare('SELECT 1 FROM products WHERE id = ?').get(candidate)) {
    candidate = `${base}_${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function normalizeProductInput(body) {
  const nameEn = String(body?.name?.en || '').trim();
  const nameFr = String(body?.name?.fr || '').trim();
  const noteEn = String(body?.note?.en || '').trim();
  const noteFr = String(body?.note?.fr || '').trim();
  const price = Number(body?.price);

  if (!nameEn || !nameFr) {
    return { error: 'English and French names are required.' };
  }

  if (!Number.isFinite(price) || price <= 0) {
    return { error: 'Price must be a positive number.' };
  }

  return { nameEn, nameFr, noteEn, noteFr, price };
}

function normalizeCompanyInput(body) {
  const name = String(body?.name || '').trim();

  if (!name) {
    return { error: 'Company name is required.' };
  }

  return { name };
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

function getItemQuantities(order, products) {
  const itemQuantities = Object.fromEntries(products.map((product) => [product.id, 0]));
  for (const item of order.items) {
    if (item.id in itemQuantities) {
      itemQuantities[item.id] = item.quantity;
    }
  }

  return itemQuantities;
}

function createWorkbook(products) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Ice Cream Orders';
  workbook.created = new Date();

  const ordersSheet = workbook.addWorksheet('Orders');
  ordersSheet.columns = [
    { header: 'Name', key: 'name', width: 24 },
    { header: 'Company', key: 'company', width: 24 },
    ...products.map((product) => ({ header: product.name.en, key: product.id, width: 18 })),
    { header: 'Total Items', key: 'totalItems', width: 14 },
    { header: 'Amount Due', key: 'totalCost', width: 14 },
    { header: 'Paid', key: 'paid', width: 10 }
  ];
  ordersSheet.getRow(1).font = { bold: true };
  ordersSheet.getColumn('totalCost').numFmt = '$0.00';

  return workbook;
}

function refreshSummarySheet(workbook, orders, products) {
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
      name: product.name.en,
      quantity,
      revenue: quantity * product.price
    });
  }

  summarySheet.getRow(1).font = { bold: true };
  summarySheet.getColumn('revenue').numFmt = '$0.00';
}

function buildWorkbookFromOrders(orders) {
  const products = getAllProducts();
  const workbook = createWorkbook(products);
  const ordersSheet = workbook.getWorksheet('Orders');

  for (const order of orders) {
    ordersSheet.addRow({
      name: order.customer.name,
      company: order.customer.company,
      ...getItemQuantities(order, products),
      totalItems: order.totalItems,
      totalCost: order.totalCost,
      paid: order.paid ? 'Yes' : 'No'
    });
  }

  refreshSummarySheet(workbook, orders, products);
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
      quantity: Number.parseInt(item.quantity, 10),
      product: getProductById(String(item.id || ''))
    }))
    .filter((item) => item.product?.active && Number.isInteger(item.quantity) && item.quantity > 0)
    .map((item) => ({
      id: item.id,
      quantity: item.quantity,
      name: item.product.name.en,
      price: item.product.price,
      total: item.quantity * item.product.price
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

const SESSION_COOKIE = 'admin_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map();

function createSession() {
  const token = randomUUID();
  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return token;
}

function isSessionValid(token) {
  if (!token || !sessions.has(token)) {
    return false;
  }

  const expiresAt = sessions.get(token);
  if (Date.now() > expiresAt) {
    sessions.delete(token);
    return false;
  }

  sessions.set(token, Date.now() + SESSION_TTL_MS);
  return true;
}

function setSessionCookie(response, token) {
  response.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_TTL_MS
  });
}

function requireAdmin(request, response, next) {
  if (isSessionValid(request.cookies[SESSION_COOKIE])) {
    next();
    return;
  }

  response.status(401).json({ error: 'Admin authentication required.' });
}

app.post('/api/admin/login', (request, response) => {
  const password = String(request.body?.password || '');

  if (!adminPassword || password !== adminPassword) {
    response.status(401).json({ error: 'Incorrect password.' });
    return;
  }

  const token = createSession();
  setSessionCookie(response, token);
  response.json({ ok: true });
});

app.post('/api/admin/logout', (request, response) => {
  const token = request.cookies[SESSION_COOKIE];
  if (token) {
    sessions.delete(token);
  }
  response.clearCookie(SESSION_COOKIE);
  response.json({ ok: true });
});

app.get('/api/admin/session', (request, response) => {
  response.json({ authenticated: isSessionValid(request.cookies[SESSION_COOKIE]) });
});

app.get('/api/admin/products', requireAdmin, (_request, response) => {
  response.json({ products: getAllProducts() });
});

app.post('/api/admin/products', requireAdmin, (request, response) => {
  const result = normalizeProductInput(request.body);
  if (result.error) {
    response.status(400).json({ error: result.error });
    return;
  }

  const id = generateProductId(result.nameEn);
  const position = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM products').get().next;
  db.prepare(`
    INSERT INTO products (id, name_en, name_fr, note_en, note_fr, price, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, result.nameEn, result.nameFr, result.noteEn, result.noteFr, result.price, position);

  response.status(201).json({ product: getProductById(id) });
});

app.put('/api/admin/products/:id', requireAdmin, (request, response) => {
  const existing = getProductById(request.params.id);
  if (!existing) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }

  const result = normalizeProductInput(request.body);
  if (result.error) {
    response.status(400).json({ error: result.error });
    return;
  }

  db.prepare(`
    UPDATE products SET name_en = ?, name_fr = ?, note_en = ?, note_fr = ?, price = ?
    WHERE id = ?
  `).run(result.nameEn, result.nameFr, result.noteEn, result.noteFr, result.price, request.params.id);

  response.json({ product: getProductById(request.params.id) });
});

app.patch('/api/admin/products/:id/active', requireAdmin, (request, response) => {
  const existing = getProductById(request.params.id);
  if (!existing) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }

  db.prepare('UPDATE products SET active = ? WHERE id = ?').run(request.body?.active ? 1 : 0, request.params.id);
  response.json({ product: getProductById(request.params.id) });
});

app.delete('/api/admin/products/:id', requireAdmin, (request, response) => {
  const existing = getProductById(request.params.id);
  if (!existing) {
    response.status(404).json({ error: 'Product not found.' });
    return;
  }

  db.prepare('DELETE FROM products WHERE id = ?').run(request.params.id);
  response.json({ ok: true });
});

app.get('/api/admin/companies', requireAdmin, (_request, response) => {
  response.json({ companies: getAllCompanies() });
});

app.post('/api/admin/companies', requireAdmin, (request, response) => {
  const result = normalizeCompanyInput(request.body);
  if (result.error) {
    response.status(400).json({ error: result.error });
    return;
  }

  try {
    const info = db.prepare('INSERT INTO companies (name) VALUES (?)').run(result.name);
    response.status(201).json({ company: { id: Number(info.lastInsertRowid), name: result.name } });
  } catch {
    response.status(409).json({ error: 'A company with that name already exists.' });
  }
});

app.put('/api/admin/companies/:id', requireAdmin, (request, response) => {
  const id = Number.parseInt(request.params.id, 10);
  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!existing) {
    response.status(404).json({ error: 'Company not found.' });
    return;
  }

  const result = normalizeCompanyInput(request.body);
  if (result.error) {
    response.status(400).json({ error: result.error });
    return;
  }

  try {
    db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(result.name, id);
    response.json({ company: { id, name: result.name } });
  } catch {
    response.status(409).json({ error: 'A company with that name already exists.' });
  }
});

app.delete('/api/admin/companies/:id', requireAdmin, (request, response) => {
  const id = Number.parseInt(request.params.id, 10);
  const existing = db.prepare('SELECT * FROM companies WHERE id = ?').get(id);
  if (!existing) {
    response.status(404).json({ error: 'Company not found.' });
    return;
  }

  db.prepare('DELETE FROM companies WHERE id = ?').run(id);
  response.json({ ok: true });
});

app.get('/api/products', (_request, response) => {
  response.json({ products: getAllProducts().filter((product) => product.active) });
});

app.get('/api/companies', (_request, response) => {
  response.json({ companies: getAllCompanies() });
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

app.get(/^(?!\/api\/).*/, (_request, response) => {
  response.sendFile(path.join(rootDir, 'dist', 'index.html'));
});

app.use((error, _request, response, _next) => {
  console.error(error);
  response.status(500).json({ error: 'Unexpected server error.' });
});

app.listen(port, () => {
  console.log(`Ice Cream Orders API listening on http://localhost:${port}`);
});
