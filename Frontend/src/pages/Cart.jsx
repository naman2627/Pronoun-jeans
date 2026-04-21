import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  PackageCheck,
  Loader,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  Tag,
  ReceiptText,
  Plus,
  Minus,
  Trash2,
} from 'lucide-react';
import api from '../api/axios';

const Toast = ({ message, type = 'success', onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [onDone]);

  const styles =
    type === 'success'
      ? 'bg-green-500/10 border-green-500/30 text-green-400'
      : 'bg-red-500/10 border-red-500/30 text-red-400';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-semibold shadow-2xl ${styles}`}
      style={{ animation: 'slideUp 0.25s ease' }}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {message}
    </div>
  );
};

const Spinner = () => (
  <div className="flex items-center justify-center py-28">
    <Loader className="animate-spin text-accent w-9 h-9" />
  </div>
);

const EmptyCart = () => (
  <div className="flex flex-col items-center justify-center py-28 gap-4">
    <div className="w-20 h-20 rounded-full bg-secondary border border-white/5 flex items-center justify-center">
      <ShoppingCart className="w-9 h-9 text-gray-600" />
    </div>
    <p className="text-white text-xl font-bold">Your cart is empty</p>
    <p className="text-gray-500 text-sm">Add products from the catalogue to get started.</p>
  </div>
);

const QtyControl = ({ value, saving, onDecrement, onIncrement, onDirectChange }) => (
  <div className="flex items-center rounded-xl overflow-hidden border border-white/10 bg-primary w-fit">
    <button
      onClick={onDecrement}
      disabled={saving || value <= 1}
      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>

    <div className="relative w-12 h-8 flex items-center justify-center border-x border-white/10">
      {saving ? (
        <Loader className="animate-spin w-3.5 h-3.5 text-accent" />
      ) : (
        <input
          type="number"
          min={1}
          value={value}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v) && v >= 1) onDirectChange(v);
          }}
          className="w-full h-full text-center text-white text-sm font-bold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      )}
    </div>

    <button
      onClick={onIncrement}
      disabled={saving}
      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
    >
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);

const useQtyUpdate = (showToast) => {
  const timerRef = useRef({});
  const [saving, setSaving] = useState({});

  const scheduleUpdate = useCallback(
    (cartItemId, newQty) => {
      clearTimeout(timerRef.current[cartItemId]);
      timerRef.current[cartItemId] = setTimeout(async () => {
        setSaving((s) => ({ ...s, [cartItemId]: true }));
        try {
          await api.patch(`orders/cart/items/${cartItemId}/`, { quantity: newQty });
        } catch (err) {
          showToast(
            err.response?.data?.error || err.response?.data?.detail || 'Failed to update quantity.',
            'error'
          );
        } finally {
          setSaving((s) => ({ ...s, [cartItemId]: false }));
        }
      }, 600);
    },
    [showToast]
  );

  return { saving, scheduleUpdate };
};

const CartRow = ({ item, index, onQtyChange, saving }) => {
  const { id, variation, quantity } = item;
  const colourLabel = variation?.size         ?? '—';
  const sizeLabel   = variation?.color        ?? '—';
  const productName = variation?.product_name ?? '—';
  const price       = parseFloat(variation?.b2b_price ?? 0);
  const subtotal    = (price * quantity).toFixed(2);

  return (
    <tr className={`border-b border-white/5 ${index % 2 === 0 ? 'bg-white/[0.015]' : ''}`}>
      <td className="px-6 py-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
            <Tag className="w-4 h-4 text-gray-600" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-snug max-w-[220px]">{productName}</p>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{variation?.sku ?? ''}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-gray-300 text-sm">{colourLabel}</td>
      <td className="px-6 py-4 text-gray-300 text-sm font-mono">{sizeLabel}</td>
      <td className="px-6 py-4 text-accent font-bold text-sm whitespace-nowrap">₹{price.toFixed(2)}</td>
      <td className="px-6 py-4">
        <QtyControl
          value={quantity}
          saving={!!saving[id]}
          onDecrement={() => onQtyChange(id, quantity - 1)}
          onIncrement={() => onQtyChange(id, quantity + 1)}
          onDirectChange={(v) => onQtyChange(id, v)}
        />
      </td>
      <td className="px-6 py-4 text-white font-bold text-sm whitespace-nowrap">₹{subtotal}</td>
      <td className="px-6 py-4">
        <button
          onClick={() => onQtyChange(id, 0)}
          className="text-gray-600 hover:text-red-400 transition-colors"
          title="Remove item"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

const CartCard = ({ item, onQtyChange, saving }) => {
  const { id, variation, quantity } = item;
  const colourLabel = variation?.size         ?? '—';
  const sizeLabel   = variation?.color        ?? '—';
  const productName = variation?.product_name ?? '—';
  const price       = parseFloat(variation?.b2b_price ?? 0);
  const subtotal    = (price * quantity).toFixed(2);

  return (
    <div className="bg-secondary rounded-2xl border border-white/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 text-gray-600" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-snug">{productName}</p>
            <p className="text-gray-500 text-xs font-mono mt-0.5">{variation?.sku ?? ''}</p>
          </div>
        </div>
        <button onClick={() => onQtyChange(id, 0)} className="text-gray-600 hover:text-red-400 transition-colors shrink-0">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-primary rounded-xl px-3 py-2">
          <p className="text-gray-500 uppercase tracking-widest font-bold text-[10px] mb-0.5">Colour</p>
          <p className="text-gray-200 font-semibold">{colourLabel}</p>
        </div>
        <div className="bg-primary rounded-xl px-3 py-2">
          <p className="text-gray-500 uppercase tracking-widest font-bold text-[10px] mb-0.5">Size</p>
          <p className="text-gray-200 font-semibold font-mono">{sizeLabel}</p>
        </div>
        <div className="bg-primary rounded-xl px-3 py-2">
          <p className="text-gray-500 uppercase tracking-widest font-bold text-[10px] mb-0.5">B2B Price</p>
          <p className="text-accent font-bold">₹{price.toFixed(2)}</p>
        </div>
        <div className="bg-primary rounded-xl px-3 py-2">
          <p className="text-gray-500 uppercase tracking-widest font-bold text-[10px] mb-2">Quantity</p>
          <QtyControl
            value={quantity}
            saving={!!saving[id]}
            onDecrement={() => onQtyChange(id, quantity - 1)}
            onIncrement={() => onQtyChange(id, quantity + 1)}
            onDirectChange={(v) => onQtyChange(id, v)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Subtotal</span>
        <span className="text-white font-bold">₹{subtotal}</span>
      </div>
    </div>
  );
};

const OrderSummary = ({ items, onCheckout, checking }) => {
  const grandTotal = items.reduce((s, i) => s + parseFloat(i.variation?.b2b_price ?? 0) * i.quantity, 0).toFixed(2);
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="bg-secondary rounded-2xl border border-white/5 p-6 space-y-5 sticky top-6">
      <div className="flex items-center gap-2 pb-4 border-b border-white/5">
        <ReceiptText className="w-5 h-5 text-accent" />
        <h2 className="text-white font-bold text-lg">Order Summary</h2>
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between text-gray-400">
          <span>SKU Lines</span>
          <span className="text-white font-semibold">{items.length}</span>
        </div>
        <div className="flex items-center justify-between text-gray-400">
          <span>Total Units</span>
          <span className="text-white font-semibold">{totalUnits}</span>
        </div>
        <div className="flex items-center justify-between text-gray-400 pt-2 border-t border-white/5">
          <span>Subtotal (excl. GST)</span>
          <span className="text-white font-semibold">₹{grandTotal}</span>
        </div>
      </div>

      <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
        <span className="text-accent font-bold text-sm uppercase tracking-widest">Grand Total</span>
        <span className="text-white font-extrabold text-xl">₹{grandTotal}</span>
      </div>

      <button
        onClick={onCheckout}
        disabled={checking}
        className="w-full flex items-center justify-center gap-2.5 bg-accent hover:bg-accent/80 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl transition-colors text-sm"
      >
        {checking ? (
          <><Loader className="animate-spin w-4 h-4" /> Placing Order…</>
        ) : (
          <><PackageCheck className="w-4 h-4" /> Submit Bulk Order <ArrowRight className="w-4 h-4" /></>
        )}
      </button>

      <p className="text-gray-600 text-xs text-center leading-relaxed">
        By submitting, you confirm this is a B2B bulk purchase order.
      </p>
    </div>
  );
};

const Cart = () => {
  const navigate = useNavigate();
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [checking, setChecking] = useState(false);
  const [success, setSuccess]   = useState(false);
  const [toast, setToast]       = useState(null);

  const showToast  = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const { saving, scheduleUpdate } = useQtyUpdate(showToast);

  useEffect(() => {
    api.get('orders/cart/')
      .then((res) => setItems(res.data?.items ?? []))
      .catch(() => showToast('Failed to load cart.', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleQtyChange = useCallback(
    (cartItemId, newQty) => {
      if (newQty <= 0) {
        setItems((prev) => prev.filter((i) => i.id !== cartItemId));
        scheduleUpdate(cartItemId, 0);
        return;
      }
      setItems((prev) =>
        prev.map((i) => (i.id === cartItemId ? { ...i, quantity: newQty } : i))
      );
      scheduleUpdate(cartItemId, newQty);
    },
    [scheduleUpdate]
  );

  const handleCheckout = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await api.post('orders/checkout/');
      setItems([]);
      setSuccess(true);
      showToast('Bulk order placed successfully!', 'success');
      setTimeout(() => navigate('/dashboard'), 2400);
    } catch (err) {
      showToast(
        err.response?.data?.error || err.response?.data?.detail || 'Checkout failed.',
        'error'
      );
    } finally {
      setChecking(false);
    }
  };

  const grandTotal = items
    .reduce((s, i) => s + parseFloat(i.variation?.b2b_price ?? 0) * i.quantity, 0)
    .toFixed(2);

  return (
    <div className="bg-primary min-h-screen p-6 lg:p-12">
      <div className="max-w-7xl mx-auto">

        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart className="w-7 h-7 text-accent" />
          <h1 className="text-white text-3xl font-bold">Your Cart</h1>
          {!loading && items.length > 0 && (
            <span className="ml-1 bg-accent/15 border border-accent/25 text-accent text-xs font-bold px-2.5 py-1 rounded-full">
              {items.length} SKU{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {success && (
          <div className="flex flex-col items-center justify-center py-28 gap-5">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <PackageCheck className="w-9 h-9 text-green-400" />
            </div>
            <p className="text-white text-2xl font-bold">Order Placed!</p>
            <p className="text-gray-400 text-sm">Redirecting to your dashboard…</p>
            <Loader className="animate-spin text-accent w-5 h-5 mt-1" />
          </div>
        )}

        {!success && loading && <Spinner />}
        {!success && !loading && items.length === 0 && <EmptyCart />}

        {!success && !loading && items.length > 0 && (
          <div className="flex flex-col xl:flex-row gap-8 items-start">

            <div className="flex-1 min-w-0 space-y-4">
              <div className="hidden md:block bg-secondary rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-6 py-5 border-b border-white/5">
                  <h2 className="text-white font-bold text-lg">Cart Items</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase tracking-widest border-b border-white/5">
                        <th className="text-left px-6 py-4">Product</th>
                        <th className="text-left px-6 py-4">Colour</th>
                        <th className="text-left px-6 py-4">Size</th>
                        <th className="text-left px-6 py-4">B2B Price</th>
                        <th className="text-left px-6 py-4">Quantity</th>
                        <th className="text-left px-6 py-4">Subtotal</th>
                        <th className="px-6 py-4" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, idx) => (
                        <CartRow
                          key={item.id}
                          item={item}
                          index={idx}
                          onQtyChange={handleQtyChange}
                          saving={saving}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-end gap-6 px-6 py-4 border-t border-white/5 bg-white/[0.02]">
                  <span className="text-gray-400 text-sm font-semibold uppercase tracking-widest">Grand Total</span>
                  <span className="text-white text-xl font-extrabold">₹{grandTotal}</span>
                </div>
              </div>

              <div className="md:hidden space-y-3">
                {items.map((item) => (
                  <CartCard key={item.id} item={item} onQtyChange={handleQtyChange} saving={saving} />
                ))}
                <div className="flex items-center justify-between bg-secondary rounded-2xl border border-accent/20 px-5 py-4">
                  <span className="text-gray-400 text-sm font-semibold uppercase tracking-widest">Grand Total</span>
                  <span className="text-white text-xl font-extrabold">₹{grandTotal}</span>
                </div>
              </div>
            </div>

            <div className="w-full xl:w-80 shrink-0">
              <OrderSummary items={items} onCheckout={handleCheckout} checking={checking} />
            </div>
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={clearToast} />}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default Cart;