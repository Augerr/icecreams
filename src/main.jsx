import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Check, IceCreamBowl, Minus, Plus, ReceiptText, RotateCcw } from 'lucide-react';
import { LANGUAGES, PRODUCT_TRANSLATIONS, detectInitialLanguage, translations } from './translations.js';
import './styles.css';

const PRODUCTS = [
  { id: 'vanilla_cup', price: 3.5 },
  { id: 'chocolate_cup', price: 3.5 },
  { id: 'strawberry_cup', price: 3.5 },
  { id: 'mint_chip', price: 4 },
  { id: 'sandwich', price: 4.25 },
  { id: 'fudge_bar', price: 3.75 }
];

const initialQuantities = Object.fromEntries(PRODUCTS.map((product) => [product.id, 0]));

const CURRENCY_LOCALES = { en: 'en-CA', fr: 'fr-CA' };

function currency(value, language) {
  return new Intl.NumberFormat(CURRENCY_LOCALES[language], {
    style: 'currency',
    currency: 'CAD'
  }).format(value);
}

function App() {
  const [language, setLanguage] = useState(detectInitialLanguage);
  const [customer, setCustomer] = useState({ name: '', company: '' });
  const [quantities, setQuantities] = useState(initialQuantities);
  const [status, setStatus] = useState({ type: 'idle', message: '' });

  const t = translations[language];

  useEffect(() => {
    window.localStorage.setItem('language', language);
    document.documentElement.lang = language;
  }, [language]);

  const localizedProducts = useMemo(
    () => PRODUCTS.map((product) => ({ ...product, ...PRODUCT_TRANSLATIONS[product.id][language] })),
    [language]
  );

  const orderLines = useMemo(
    () =>
      localizedProducts
        .map((product) => ({
          ...product,
          quantity: quantities[product.id],
          total: quantities[product.id] * product.price
        }))
        .filter((line) => line.quantity > 0),
    [localizedProducts, quantities]
  );

  const totalItems = orderLines.reduce((sum, line) => sum + line.quantity, 0);
  const totalCost = orderLines.reduce((sum, line) => sum + line.total, 0);
  const canSubmit = customer.name.trim() && customer.company.trim() && totalItems > 0;

  function updateQuantity(productId, nextValue) {
    const parsed = Number.parseInt(nextValue, 10);
    const safeValue = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 99);
    setQuantities((current) => ({ ...current, [productId]: safeValue }));
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!canSubmit) {
      setStatus({ type: 'error', message: t.incompleteError });
      return;
    }

    setStatus({ type: 'saving', message: t.saving });

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer,
        items: orderLines.map(({ id, quantity }) => ({ id, quantity }))
      })
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus({ type: 'error', message: payload.error || t.genericError });
      return;
    }

    setCustomer({ name: '', company: '' });
    setQuantities(initialQuantities);
    setStatus({ type: 'success', message: t.success });
  }

  return (
    <main className="app-shell">
      <section className="form-panel">
        <div className="brand-row">
          <div className="brand-mark">
            <IceCreamBowl size={28} />
          </div>
          <div>
            <p className="eyebrow">{t.eyebrow}</p>
            <h1>{t.title}</h1>
          </div>
          <div className="language-switch" role="group" aria-label="Language">
            {LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                className={`language-button ${language === code ? 'active' : ''}`}
                aria-pressed={language === code}
                onClick={() => setLanguage(code)}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submitOrder}>
          <div className="identity-grid">
            <label>
              <span>{t.nameLabel}</span>
              <input
                value={customer.name}
                onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))}
                autoComplete="name"
                required
              />
            </label>
            <label>
              <span>{t.companyLabel}</span>
              <select
                value={customer.company}
                onChange={(event) => setCustomer((current) => ({ ...current, company: event.target.value }))}
                autoComplete="organization"
                required
              >
                <option value="" disabled>
                  {t.selectCompany}
                </option>
                <option value="Agropur">Agropur</option>
                <option value="Company B">Company B</option>
                <option value="Company C">Company C</option>
              </select>
            </label>
          </div>

          <div className="order-grid" aria-label={t.menuLabel}>
            <div className="grid-heading item-heading">{t.itemHeading}</div>
            <div className="grid-heading price-heading">{t.priceHeading}</div>
            <div className="grid-heading quantity-heading">{t.qtyHeading}</div>
            <div className="grid-heading line-heading">{t.lineHeading}</div>

            {localizedProducts.map((product) => (
              <React.Fragment key={product.id}>
                <div className="item-cell">
                  <strong>{product.name}</strong>
                  <span>{product.note}</span>
                </div>
                <div className="price-cell">{currency(product.price, language)}</div>
                <div className="quantity-cell">
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t.decreaseLabel(product.name)}
                    onClick={() => updateQuantity(product.id, quantities[product.id] - 1)}
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    aria-label={t.quantityLabel(product.name)}
                    value={quantities[product.id]}
                    inputMode="numeric"
                    onChange={(event) => updateQuantity(product.id, event.target.value)}
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t.increaseLabel(product.name)}
                    onClick={() => updateQuantity(product.id, quantities[product.id] + 1)}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <div className="line-cell">{currency(quantities[product.id] * product.price, language)}</div>
              </React.Fragment>
            ))}
          </div>

          <div className="action-row">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setQuantities(initialQuantities);
                setStatus({ type: 'idle', message: '' });
              }}
            >
              <RotateCcw size={18} />
              {t.reset}
            </button>
            <button type="submit" className="primary-button" disabled={!canSubmit || status.type === 'saving'}>
              <Check size={18} />
              {t.submit}
            </button>
          </div>

          {status.message && <p className={`status ${status.type}`}>{status.message}</p>}
        </form>
      </section>

      <aside className="summary-panel">
        <div className="summary-header">
          <ReceiptText size={22} />
          <h2>{t.orderSummary}</h2>
        </div>

        <div className="summary-lines">
          {orderLines.length === 0 ? (
            <p className="empty-state">{t.emptyState}</p>
          ) : (
            orderLines.map((line) => (
              <div className="summary-line" key={line.id}>
                <span>{line.name}</span>
                <strong>
                  {line.quantity} x {currency(line.price, language)}
                </strong>
              </div>
            ))
          )}
        </div>

        <div className="total-row">
          <span>{t.itemsCount(totalItems)}</span>
          <strong>{currency(totalCost, language)}</strong>
        </div>
      </aside>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
