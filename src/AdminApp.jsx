import { useEffect, useState } from 'react';
import { Ban, Check, IceCreamBowl, LogOut, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';

const emptyProductForm = { nameEn: '', nameFr: '', noteEn: '', noteFr: '', price: '' };

async function api(path, options) {
  const response = await fetch(path, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Something went wrong.');
  }

  return payload;
}

function productToForm(product) {
  return {
    nameEn: product.name.en,
    nameFr: product.name.fr,
    noteEn: product.note.en,
    noteFr: product.note.fr,
    price: String(product.price)
  };
}

function formToPayload(form) {
  return {
    name: { en: form.nameEn.trim(), fr: form.nameFr.trim() },
    note: { en: form.noteEn.trim(), fr: form.noteFr.trim() },
    price: Number.parseFloat(form.price)
  };
}

function LoginScreen({ onLoggedIn }) {
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus({ type: 'submitting', message: '' });

    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password }) });
      onLoggedIn();
    } catch (error) {
      setStatus({ type: 'error', message: error.message });
    }
  }

  return (
    <main className="admin-shell">
      <section className="form-panel login-card">
        <div className="brand-row">
          <div className="brand-mark">
            <IceCreamBowl size={28} />
          </div>
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Catalog management</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            <span>Admin password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </label>

          <div className="action-row">
            <button type="submit" className="primary-button" disabled={status.type === 'submitting'}>
              <Check size={18} />
              Log in
            </button>
          </div>

          {status.type === 'error' && <p className="status error">{status.message}</p>}
        </form>
      </section>
    </main>
  );
}

function ProductForm({ initial, submitLabel, onCancel, onSubmit }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await onSubmit(formToPayload(form));
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      <div className="admin-form-grid">
        <label>
          <span>Name (English)</span>
          <input value={form.nameEn} onChange={(event) => update('nameEn', event.target.value)} required />
        </label>
        <label>
          <span>Name (French)</span>
          <input value={form.nameFr} onChange={(event) => update('nameFr', event.target.value)} required />
        </label>
        <label>
          <span>Note (English)</span>
          <input value={form.noteEn} onChange={(event) => update('noteEn', event.target.value)} />
        </label>
        <label>
          <span>Note (French)</span>
          <input value={form.noteFr} onChange={(event) => update('noteFr', event.target.value)} />
        </label>
        <label>
          <span>Price (CAD)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={form.price}
            onChange={(event) => update('price', event.target.value)}
            required
          />
        </label>
      </div>

      <div className="action-row">
        <button type="button" className="secondary-button" onClick={onCancel}>
          <X size={18} />
          Cancel
        </button>
        <button type="submit" className="primary-button" disabled={submitting}>
          <Check size={18} />
          {submitLabel}
        </button>
      </div>

      {error && <p className="status error">{error}</p>}
    </form>
  );
}

function ProductsPanel({ products, onCreate, onUpdate, onDelete, onToggleActive }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  return (
    <section className="form-panel admin-panel">
      <div className="admin-panel-header">
        <h2>Products</h2>
        {!adding && (
          <button type="button" className="secondary-button" onClick={() => setAdding(true)}>
            <Plus size={18} />
            Add product
          </button>
        )}
      </div>

      {adding && (
        <ProductForm
          initial={emptyProductForm}
          submitLabel="Add product"
          onCancel={() => setAdding(false)}
          onSubmit={async (payload) => {
            await onCreate(payload);
            setAdding(false);
          }}
        />
      )}

      <div className="admin-table">
        <div className="admin-table-row admin-table-head">
          <span>Name</span>
          <span>Note</span>
          <span>Price</span>
          <span className="admin-table-actions">Actions</span>
        </div>

        {products.map((product) =>
          editingId === product.id ? (
            <div className="admin-table-row admin-table-edit-row" key={product.id}>
              <ProductForm
                initial={productToForm(product)}
                submitLabel="Save changes"
                onCancel={() => setEditingId(null)}
                onSubmit={async (payload) => {
                  await onUpdate(product.id, payload);
                  setEditingId(null);
                }}
              />
            </div>
          ) : (
            <div className={`admin-table-row${product.active ? '' : ' admin-table-row-inactive'}`} key={product.id}>
              <span>
                <strong>{product.name.en}</strong>
                <span className="admin-secondary-text">{product.name.fr}</span>
                {!product.active && <span className="admin-badge admin-badge-inactive">Out of stock</span>}
              </span>
              <span>
                <span className="admin-secondary-text">{product.note.en}</span>
                <span className="admin-secondary-text">{product.note.fr}</span>
              </span>
              <span>${product.price.toFixed(2)}</span>
              <span className="admin-table-actions">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={product.active ? `Mark ${product.name.en} out of stock` : `Mark ${product.name.en} in stock`}
                  onClick={() => onToggleActive(product.id, !product.active)}
                >
                  {product.active ? <Ban size={16} /> : <RotateCcw size={16} />}
                </button>
                <button type="button" className="icon-button" aria-label={`Edit ${product.name.en}`} onClick={() => setEditingId(product.id)}>
                  <Pencil size={16} />
                </button>
                {pendingDeleteId === product.id ? (
                  <>
                    <button
                      type="button"
                      className="icon-button admin-danger-button"
                      aria-label={`Confirm delete ${product.name.en}`}
                      onClick={async () => {
                        await onDelete(product.id);
                        setPendingDeleteId(null);
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Cancel delete"
                      onClick={() => setPendingDeleteId(null)}
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Delete ${product.name.en}`}
                    onClick={() => setPendingDeleteId(product.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </span>
            </div>
          )
        )}

        {products.length === 0 && <p className="empty-state">No products yet — add one above.</p>}
      </div>
    </section>
  );
}

function CompaniesPanel({ companies, onCreate, onUpdate, onDelete }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  async function handleAdd(event) {
    event.preventDefault();
    setError('');

    try {
      await onCreate(name.trim());
      setName('');
    } catch (addError) {
      setError(addError.message);
    }
  }

  async function handleSave(company) {
    setError('');

    try {
      await onUpdate(company.id, editingName.trim());
      setEditingId(null);
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  return (
    <section className="form-panel admin-panel">
      <div className="admin-panel-header">
        <h2>Companies</h2>
      </div>

      <form className="admin-inline-form" onSubmit={handleAdd}>
        <label>
          <span>New company name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <button type="submit" className="primary-button">
          <Plus size={18} />
          Add company
        </button>
      </form>

      {error && <p className="status error">{error}</p>}

      <div className="admin-table admin-table-companies">
        {companies.map((company) => (
          <div className="admin-table-row" key={company.id}>
            {editingId === company.id ? (
              <>
                <input value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                <span className="admin-table-actions">
                  <button type="button" className="icon-button" aria-label="Save company" onClick={() => handleSave(company)}>
                    <Check size={16} />
                  </button>
                  <button type="button" className="icon-button" aria-label="Cancel edit" onClick={() => setEditingId(null)}>
                    <X size={16} />
                  </button>
                </span>
              </>
            ) : (
              <>
                <span>{company.name}</span>
                <span className="admin-table-actions">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Edit ${company.name}`}
                    onClick={() => {
                      setEditingId(company.id);
                      setEditingName(company.name);
                    }}
                  >
                    <Pencil size={16} />
                  </button>
                  {pendingDeleteId === company.id ? (
                    <>
                      <button
                        type="button"
                        className="icon-button admin-danger-button"
                        aria-label={`Confirm delete ${company.name}`}
                        onClick={async () => {
                          await onDelete(company.id);
                          setPendingDeleteId(null);
                        }}
                      >
                        <Check size={16} />
                      </button>
                      <button type="button" className="icon-button" aria-label="Cancel delete" onClick={() => setPendingDeleteId(null)}>
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Delete ${company.name}`}
                      onClick={() => setPendingDeleteId(company.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </span>
              </>
            )}
          </div>
        ))}

        {companies.length === 0 && <p className="empty-state">No companies yet — add one above.</p>}
      </div>
    </section>
  );
}

function Dashboard({ onLoggedOut }) {
  const [products, setProducts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loadError, setLoadError] = useState('');

  async function reload() {
    try {
      const [productsPayload, companiesPayload] = await Promise.all([
        api('/api/admin/products'),
        api('/api/admin/companies')
      ]);
      setProducts(productsPayload.products);
      setCompanies(companiesPayload.companies);
    } catch (error) {
      setLoadError(error.message);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleLogout() {
    await api('/api/admin/logout', { method: 'POST' });
    onLoggedOut();
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div className="brand-row">
          <div className="brand-mark">
            <IceCreamBowl size={28} />
          </div>
          <div>
            <p className="eyebrow">Admin</p>
            <h1>Catalog management</h1>
          </div>
          <button type="button" className="secondary-button" onClick={handleLogout}>
            <LogOut size={18} />
            Log out
          </button>
        </div>
      </header>

      {loadError && <p className="status error">{loadError}</p>}

      <ProductsPanel
        products={products}
        onCreate={async (payload) => {
          await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
          await reload();
        }}
        onUpdate={async (id, payload) => {
          await api(`/api/admin/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
          await reload();
        }}
        onDelete={async (id) => {
          await api(`/api/admin/products/${id}`, { method: 'DELETE' });
          await reload();
        }}
        onToggleActive={async (id, active) => {
          await api(`/api/admin/products/${id}/active`, { method: 'PATCH', body: JSON.stringify({ active }) });
          await reload();
        }}
      />

      <CompaniesPanel
        companies={companies}
        onCreate={async (name) => {
          await api('/api/admin/companies', { method: 'POST', body: JSON.stringify({ name }) });
          await reload();
        }}
        onUpdate={async (id, name) => {
          await api(`/api/admin/companies/${id}`, { method: 'PUT', body: JSON.stringify({ name }) });
          await reload();
        }}
        onDelete={async (id) => {
          await api(`/api/admin/companies/${id}`, { method: 'DELETE' });
          await reload();
        }}
      />
    </main>
  );
}

export default function AdminApp() {
  const [authState, setAuthState] = useState('checking');

  useEffect(() => {
    let cancelled = false;

    api('/api/admin/session')
      .then((payload) => {
        if (!cancelled) {
          setAuthState(payload.authenticated ? 'authenticated' : 'anonymous');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthState('anonymous');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === 'checking') {
    return (
      <main className="admin-shell">
        <p className="status idle">Loading…</p>
      </main>
    );
  }

  if (authState === 'authenticated') {
    return <Dashboard onLoggedOut={() => setAuthState('anonymous')} />;
  }

  return <LoginScreen onLoggedIn={() => setAuthState('authenticated')} />;
}
