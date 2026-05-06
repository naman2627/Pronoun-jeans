import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  ShoppingCart, PackageCheck, Loader, AlertCircle, CheckCircle2,
  ArrowRight, Tag, ReceiptText, Plus, Minus, Trash2,
  Truck, CreditCard, Building, ShieldCheck, Smartphone,
  X, Lock, Unlock, ChevronDown, ChevronUp, Copy, Check,
} from 'lucide-react';
import api from '../api/axios';

// ── Constants ─────────────────────────────────────────────────────────────────

const UPI_ID       = 'pronoun@kotak';
const BUSINESS_NAME = 'Pronoun Jeans';

// ── Razorpay loader ───────────────────────────────────────────────────────────

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const s  = document.createElement('script');
    s.src    = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload  = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt    = (n)  => parseFloat(n || 0).toFixed(2);
const round2 = (n)  => Math.round(n * 100) / 100;

const buildUpiUri = (amount, note = 'B2B Order') =>
  `upi://pay?pa=${UPI_ID}&pn=${encodeURIComponent(BUSINESS_NAME)}&am=${fmt(amount)}&cu=INR&tn=${encodeURIComponent(note)}`;

// ── Color Swatch ──────────────────────────────────────────────────────────────

const ColorSwatch = ({ hex, name }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className="w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-white/20 shrink-0"
      style={{ backgroundColor: hex || '#CCCCCC' }} title={name} />
    <span>{name}</span>
  </span>
);

// ── Toast ─────────────────────────────────────────────────────────────────────

const Toast = ({ message, type = 'success', onDone }) => {
  useEffect(() => { const t = setTimeout(onDone, 3200); return () => clearTimeout(t); }, [onDone]);
  const styles = type === 'success'
    ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/30 text-green-700 dark:text-green-400'
    : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl border text-sm font-semibold shadow-2xl ${styles}`}
      style={{ animation: 'slideUp .25s ease' }}>
      <Icon className="w-4 h-4 shrink-0" />{message}
    </div>
  );
};

// ── Qty Control ───────────────────────────────────────────────────────────────

const QtyControl = ({ value, saving, onDecrement, onIncrement, onDirectChange }) => (
  <div className="flex items-center rounded-xl overflow-hidden border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 w-fit">
    <button onClick={onDecrement} disabled={saving || value <= 1}
      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      <Minus className="w-3.5 h-3.5" />
    </button>
    <div className="relative w-12 h-8 flex items-center justify-center border-x border-gray-200 dark:border-white/10">
      {saving ? <Loader className="animate-spin w-3.5 h-3.5 text-accent" /> : (
        <input type="number" min={1} value={value}
          onChange={(e) => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) onDirectChange(v); }}
          className="w-full h-full text-center text-gray-900 dark:text-zinc-100 text-sm font-bold bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" />
      )}
    </div>
    <button onClick={onIncrement} disabled={saving}
      className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
      <Plus className="w-3.5 h-3.5" />
    </button>
  </div>
);

const useQtyUpdate = (showToast) => {
  const timerRef = useRef({});
  const [saving, setSaving] = useState({});
  const scheduleUpdate = useCallback((cartItemId, newQty) => {
    clearTimeout(timerRef.current[cartItemId]);
    timerRef.current[cartItemId] = setTimeout(async () => {
      setSaving(s => ({ ...s, [cartItemId]: true }));
      try { await api.patch(`orders/cart/items/${cartItemId}/`, { quantity: newQty }); }
      catch (err) { showToast(err.response?.data?.error || 'Failed to update quantity.', 'error'); }
      finally { setSaving(s => ({ ...s, [cartItemId]: false })); }
    }, 600);
  }, [showToast]);
  return { saving, scheduleUpdate };
};

// ── Cart Row ──────────────────────────────────────────────────────────────────

const CartRow = ({ item, index, onQtyChange, saving }) => {
  const { id, variation, quantity } = item;
  const price = parseFloat(variation?.b2b_price ?? 0);
  return (
    <tr className={`border-b border-gray-100 dark:border-white/5 ${index % 2 === 0 ? 'bg-gray-50/50 dark:bg-white/[0.015]' : 'bg-white dark:bg-transparent'}`}>
      <td className="px-6 py-4">
        <div className="flex items-start gap-3">
          <div>
            <p className="text-gray-900 dark:text-zinc-100 font-semibold text-sm leading-snug max-w-[220px]">{variation?.product_name ?? '—'}</p>
            <p className="text-gray-400 dark:text-zinc-500 text-xs font-mono mt-0.5">{variation?.sku ?? ''}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-gray-600 dark:text-zinc-300 text-sm">{variation?.size ?? '—'}</td>
      <td className="px-6 py-4 text-sm">
        <ColorSwatch hex={variation?.color_hex || '#CCCCCC'} name={variation?.color_name || variation?.color || '—'} />
      </td>
      <td className="px-6 py-4 text-accent font-bold text-sm whitespace-nowrap">₹{price.toFixed(2)}</td>
      <td className="px-6 py-4">
        <QtyControl value={quantity} saving={!!saving[id]}
          onDecrement={() => onQtyChange(id, quantity - 1)}
          onIncrement={() => onQtyChange(id, quantity + 1)}
          onDirectChange={(v) => onQtyChange(id, v)} />
      </td>
      <td className="px-6 py-4 text-gray-900 dark:text-zinc-100 font-bold text-sm whitespace-nowrap">₹{(price * quantity).toFixed(2)}</td>
      <td className="px-6 py-4">
        <button onClick={() => onQtyChange(id, 0)} className="text-gray-400 hover:text-red-500 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
};

// ── Address Card ──────────────────────────────────────────────────────────────

const AddressCard = ({ addr, selected, onSelect, type }) => {
  const Icon = type === 'shipping' ? Truck : Building;
  return (
    <div onClick={() => onSelect(addr.id)}
      className={`cursor-pointer rounded-xl border p-4 transition-all ${selected ? 'border-accent/60 bg-accent/5' : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-white/20'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${selected ? 'text-accent' : 'text-gray-400'}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${selected ? 'text-accent' : 'text-gray-500'}`}>
            {type === 'shipping' ? 'Shipping' : 'Billing'}
          </span>
        </div>
        {selected && <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />}
      </div>
      <p className="text-gray-900 dark:text-zinc-100 text-sm font-semibold">{addr.address_line_1}</p>
      {addr.address_line_2 && <p className="text-gray-500 text-xs">{addr.address_line_2}</p>}
      <p className="text-gray-500 text-xs">{addr.city}, {addr.state} — {addr.pincode}</p>
    </div>
  );
};

// ── Available Offers ──────────────────────────────────────────────────────────

const couponLabel = (c) => c.discount_type === 'percentage' ? `${c.discount_value}% Off` : `Flat ₹${parseFloat(c.discount_value).toFixed(0)} Off`;

const AvailableOffers = ({ coupons, cartTotal, appliedCoupon, onApply, onRemove }) => {
  const [expanded, setExpanded]           = useState(true);
  const [loading, setLoading]             = useState(null);
  const [manualCode, setManualCode]       = useState('');
  const [manualError, setManualError]     = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const handleApplyCode = async (code) => {
    setLoading(code);
    try { const res = await api.post('orders/cart/apply-coupon/', { coupon_code: code }); onApply(res.data); }
    catch { } finally { setLoading(null); }
  };

  const handleManualApply = async () => {
    if (!manualCode.trim()) return;
    setManualLoading(true); setManualError('');
    try { const res = await api.post('orders/cart/apply-coupon/', { coupon_code: manualCode.trim() }); onApply(res.data); setManualCode(''); }
    catch (err) { setManualError(err.response?.data?.error || 'Invalid coupon code.'); }
    finally { setManualLoading(false); }
  };

  return (
    <div className="border-t border-gray-100 dark:border-white/5 pt-4 space-y-3">
      <button onClick={() => setExpanded(e => !e)} className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-accent" />
          <p className="text-gray-900 dark:text-zinc-100 text-sm font-bold">Available Offers</p>
          {coupons.length > 0 && <span className="bg-accent/10 text-accent text-[10px] font-bold px-1.5 py-0.5 rounded-full">{coupons.length}</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="space-y-2">
          {appliedCoupon && (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl px-3 py-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-green-700 dark:text-green-400 text-sm font-bold">{appliedCoupon.coupon_code}</span>
                <span className="text-green-600 text-xs">saving ₹{parseFloat(appliedCoupon.discount_amount).toFixed(2)}</span>
              </div>
              <button onClick={onRemove}><X className="w-4 h-4 text-green-500 hover:text-red-500 transition-colors" /></button>
            </div>
          )}
          {coupons.map(c => {
            const minVal   = parseFloat(c.min_order_value);
            const unlocked = cartTotal >= minVal;
            const isApplied = appliedCoupon?.coupon_code === c.code;
            return (
              <div key={c.id} className={`rounded-xl border p-3 ${isApplied ? 'border-green-200 bg-green-50/50 dark:bg-green-500/5' : unlocked ? 'border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800' : 'border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-zinc-900/50'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 flex-1">
                    <div className={`mt-0.5 ${unlocked ? 'text-accent' : 'text-gray-300 dark:text-zinc-600'}`}>
                      {unlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-gray-900 dark:text-zinc-100">{c.code}</span>
                        <span className="text-accent text-xs font-bold">{couponLabel(c)}</span>
                      </div>
                      {!unlocked && <p className="text-yellow-600 text-xs mt-0.5">Add ₹{(minVal - cartTotal).toLocaleString('en-IN', { maximumFractionDigits: 0 })} more to unlock</p>}
                    </div>
                  </div>
                  {isApplied ? <span className="text-green-600 text-xs font-bold">Applied ✓</span> : (
                    <button onClick={() => unlocked && handleApplyCode(c.code)} disabled={!unlocked || !!appliedCoupon || loading === c.code}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-colors ${unlocked && !appliedCoupon ? 'bg-accent/10 text-accent hover:bg-accent hover:text-white border border-accent/20' : 'text-gray-300 dark:text-zinc-600 cursor-not-allowed'}`}>
                      {loading === c.code ? <Loader className="animate-spin w-3 h-3" /> : 'Apply'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <div className="pt-1 space-y-1.5">
            <div className="flex gap-2">
              <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && handleManualApply()} placeholder="Enter coupon code"
                className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-zinc-100 placeholder-gray-400 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent" />
              <button onClick={handleManualApply} disabled={manualLoading || !manualCode.trim()}
                className="px-4 py-2 bg-accent hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm">
                {manualLoading ? <Loader className="animate-spin w-4 h-4" /> : 'Apply'}
              </button>
            </div>
            {manualError && <p className="text-red-500 text-xs">{manualError}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Direct UPI Panel ──────────────────────────────────────────────────────────

const DirectUPIPanel = ({
  grandTotal, paymentPlan, setPaymentPlan,
  utrNumber, setUtrNumber,
  onConfirm, confirming,
}) => {
  const [copied, setCopied] = useState(false);

  const couponSubtotal = grandTotal; // grandTotal already has coupon discount applied
  const upiDiscount    = paymentPlan === 'full' ? round2(couponSubtotal * 0.01) : 0;
  const finalTotal     = round2(couponSubtotal - upiDiscount);
  const payableNow     = paymentPlan === 'advance' ? round2(finalTotal * 0.10) : finalTotal;

  const upiUri = buildUpiUri(payableNow, `Pronoun Jeans Order - ${paymentPlan === 'advance' ? '10% Advance' : 'Full Payment'}`);

  const isMobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent);

  const handleCopyUpi = () => {
    navigator.clipboard.writeText(UPI_ID);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Payment Plan Toggle */}
      <div>
        <p className="text-gray-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-widest mb-3">
          Choose Payment Plan
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 'advance', label: '10% Advance', sub: 'Pay 10% now, rest on delivery' },
            { value: 'full',    label: 'Full Payment', sub: 'Extra 1% off on full payment' },
          ].map(opt => (
            <label key={opt.value} onClick={() => setPaymentPlan(opt.value)}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all ${paymentPlan === opt.value ? 'border-accent bg-accent/5' : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 hover:border-gray-300 dark:hover:border-white/20'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${paymentPlan === opt.value ? 'border-accent' : 'border-gray-300 dark:border-zinc-600'}`}>
                  {paymentPlan === opt.value && <div className="w-2 h-2 rounded-full bg-accent" />}
                </div>
                <p className={`text-sm font-bold ${paymentPlan === opt.value ? 'text-accent' : 'text-gray-900 dark:text-zinc-100'}`}>{opt.label}</p>
              </div>
              <p className="text-gray-500 dark:text-zinc-400 text-xs pl-6">{opt.sub}</p>
            </label>
          ))}
        </div>
      </div>

      {/* Pricing Breakdown */}
      <div className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex items-center justify-between text-gray-500 dark:text-zinc-400">
          <span>Cart Total</span><span className="font-semibold text-gray-900 dark:text-zinc-100">₹{fmt(couponSubtotal)}</span>
        </div>
        {paymentPlan === 'full' && (
          <div className="flex items-center justify-between text-green-600 dark:text-green-400 font-semibold">
            <span>Full Payment Discount (1%)</span><span>−₹{fmt(upiDiscount)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-white/10 pt-2">
          <span className="text-gray-700 dark:text-zinc-300 font-semibold">Order Total</span>
          <span className="text-gray-900 dark:text-zinc-100 font-black">₹{fmt(finalTotal)}</span>
        </div>
        {paymentPlan === 'advance' && (
          <div className="flex items-center justify-between text-gray-500 dark:text-zinc-400">
            <span>Balance Due Later</span><span>₹{fmt(round2(finalTotal * 0.90))}</span>
          </div>
        )}
        <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-lg px-3 py-2 mt-1">
          <span className="text-accent font-bold text-sm uppercase tracking-widest">Pay Now</span>
          <span className="text-gray-900 dark:text-zinc-100 font-black text-lg">₹{fmt(payableNow)}</span>
        </div>
      </div>

      {/* QR Code */}
      <div className="flex flex-col items-center gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-white/10 rounded-2xl p-6">
        <p className="text-gray-700 dark:text-zinc-300 text-sm font-bold">Scan to Pay ₹{fmt(payableNow)}</p>
        <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100">
          <QRCodeSVG
            value={upiUri}
            size={200}
            level="H"
            includeMargin={false}
          />
        </div>

        {/* UPI ID copy */}
        <div className="flex items-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2 w-full justify-between">
          <div>
            <p className="text-gray-400 dark:text-zinc-500 text-[10px] uppercase tracking-widest">UPI ID</p>
            <p className="text-gray-900 dark:text-zinc-100 font-mono font-bold text-sm">{UPI_ID}</p>
          </div>
          <button onClick={handleCopyUpi}
            className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-red-700 transition-colors">
            {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
          </button>
        </div>

        {/* Mobile deep link */}
        {isMobile ? (
          <a href={upiUri}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm">
            <Smartphone className="w-4 h-4" />
            Pay ₹{fmt(payableNow)} via UPI App
          </a>
        ) : (
          <p className="text-gray-400 dark:text-zinc-500 text-xs text-center">
            On mobile, click "Pay via UPI App" to open PhonePe / GPay directly.
          </p>
        )}
      </div>

      {/* UTR Input */}
      <div className="space-y-2">
        <label className="block text-gray-700 dark:text-zinc-300 text-xs font-bold uppercase tracking-widest">
          UPI Transaction Reference (UTR) *
        </label>
        <input
          type="text"
          value={utrNumber}
          onChange={e => setUtrNumber(e.target.value.trim())}
          placeholder="e.g. 426813598234"
          className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-zinc-100 placeholder-gray-400 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors font-mono"
        />
        <p className="text-gray-400 dark:text-zinc-500 text-xs">
          After paying, enter the 12-digit UTR / transaction ID from your UPI app.
        </p>
      </div>

      {/* Confirm button */}
      <button onClick={onConfirm} disabled={confirming || !utrNumber.trim()}
        className="w-full flex items-center justify-center gap-2.5 bg-accent hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold px-6 py-3.5 rounded-xl transition-colors text-sm">
        {confirming ? <><Loader className="animate-spin w-4 h-4" /> Confirming…</> : <><PackageCheck className="w-4 h-4" /> Confirm Order</>}
      </button>
      <p className="text-gray-400 dark:text-zinc-500 text-xs text-center">
        Your order will be verified within 2 hours of payment confirmation.
      </p>
    </div>
  );
};

// ── Checkout Panel ────────────────────────────────────────────────────────────

const CheckoutPanel = ({
  items, addresses, shippingId, billingId,
  onShippingSelect, onBillingSelect,
  couponData, onCouponApply, onCouponRemove, availableCoupons,
  // UPI
  paymentPlan, setPaymentPlan, utrNumber, setUtrNumber,
  onUpiConfirm, upiConfirming,
  // Razorpay
  onRazorpayCheckout, razorpayChecking,
}) => {
  const [activeMethod, setActiveMethod] = useState('upi'); // 'upi' | 'razorpay'

  const subtotal   = items.reduce((s, i) => s + parseFloat(i.variation?.b2b_price ?? 0) * i.quantity, 0);
  const couponDisc = couponData ? parseFloat(couponData.discount_amount) : 0;
  const grandTotal = subtotal - couponDisc;
  const totalUnits = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="flex flex-col xl:flex-row gap-8 items-start">
      <div className="flex-1 min-w-0 space-y-6">

        {/* Shipping */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><Truck className="w-5 h-5 text-accent" /><h2 className="text-gray-900 dark:text-zinc-100 font-bold">Shipping Address</h2></div>
          {addresses.length === 0
            ? <p className="text-gray-500 text-sm">No addresses saved. <a href="/dashboard" className="text-accent underline">Add one.</a></p>
            : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{addresses.map(a => <AddressCard key={a.id} addr={a} type="shipping" selected={shippingId === a.id} onSelect={onShippingSelect} />)}</div>}
        </div>

        {/* Billing */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4"><Building className="w-5 h-5 text-accent" /><h2 className="text-gray-900 dark:text-zinc-100 font-bold">Billing Address</h2></div>
          {addresses.length === 0
            ? <p className="text-gray-500 text-sm">No addresses saved.</p>
            : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{addresses.map(a => <AddressCard key={a.id} addr={a} type="billing" selected={billingId === a.id} onSelect={onBillingSelect} />)}</div>}
        </div>

        {/* Payment Method Toggle */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5"><ShieldCheck className="w-5 h-5 text-accent" /><h2 className="text-gray-900 dark:text-zinc-100 font-bold">Payment Method</h2></div>

          {/* Method selector tabs */}
          <div className="flex gap-3 mb-6">
            {[
              { key: 'upi',      label: 'Direct UPI',  sub: 'Zero fees · Instant' },
              { key: 'razorpay', label: 'Razorpay',    sub: 'Card / UPI / NetBanking' },
            ].map(m => (
              <button key={m.key} onClick={() => setActiveMethod(m.key)}
                className={`flex-1 rounded-xl border p-3 text-left transition-all ${activeMethod === m.key ? 'border-accent bg-accent/5' : 'border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-800 hover:border-gray-300'}`}>
                <p className={`text-sm font-bold ${activeMethod === m.key ? 'text-accent' : 'text-gray-900 dark:text-zinc-100'}`}>{m.label}</p>
                <p className="text-gray-500 text-xs mt-0.5">{m.sub}</p>
              </button>
            ))}
          </div>

          {/* Direct UPI flow */}
          {activeMethod === 'upi' && (
            <DirectUPIPanel
              grandTotal={grandTotal}
              paymentPlan={paymentPlan}
              setPaymentPlan={setPaymentPlan}
              utrNumber={utrNumber}
              setUtrNumber={setUtrNumber}
              onConfirm={onUpiConfirm}
              confirming={upiConfirming}
            />
          )}

          {/* Razorpay flow */}
          {activeMethod === 'razorpay' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl px-4 py-3 text-blue-700 dark:text-blue-400 text-sm">
                You'll be redirected to Razorpay's secure payment page. Supports UPI, Cards, and NetBanking.
              </div>
              <button onClick={onRazorpayCheckout} disabled={razorpayChecking}
                className="w-full flex items-center justify-center gap-2.5 bg-[#2d63f5] hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-6 py-3.5 rounded-xl transition-colors text-sm">
                {razorpayChecking ? <><Loader className="animate-spin w-4 h-4" /> Opening…</> : <><CreditCard className="w-4 h-4" /> Pay ₹{fmt(grandTotal)} via Razorpay</>}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Order Summary */}
      <div className="w-full xl:w-80 shrink-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 space-y-5 sticky top-6 shadow-sm">
          <div className="flex items-center gap-2 pb-4 border-b border-gray-100 dark:border-white/5">
            <ReceiptText className="w-5 h-5 text-accent" />
            <h2 className="text-gray-900 dark:text-zinc-100 font-bold text-lg">Order Summary</h2>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between text-gray-500 dark:text-zinc-400"><span>SKU Lines</span><span className="text-gray-900 dark:text-zinc-100 font-semibold">{items.length}</span></div>
            <div className="flex justify-between text-gray-500 dark:text-zinc-400"><span>Total Units</span><span className="text-gray-900 dark:text-zinc-100 font-semibold">{totalUnits}</span></div>
            <div className="flex justify-between text-gray-500 dark:text-zinc-400 pt-2 border-t border-gray-100 dark:border-white/5"><span>Subtotal</span><span className="text-gray-900 dark:text-zinc-100 font-semibold">₹{fmt(subtotal)}</span></div>
            {couponData && couponDisc > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold">
                <span>Coupon ({couponData.coupon_code})</span><span>−₹{fmt(couponDisc)}</span>
              </div>
            )}
          </div>

          <AvailableOffers coupons={availableCoupons} cartTotal={subtotal}
            appliedCoupon={couponData} onApply={onCouponApply} onRemove={onCouponRemove} />

          <div className="flex items-center justify-between bg-accent/10 border border-accent/20 rounded-xl px-4 py-3">
            <span className="text-accent font-bold text-sm uppercase tracking-widest">Grand Total</span>
            <span className="text-gray-900 dark:text-zinc-100 font-extrabold text-xl">₹{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Cart ─────────────────────────────────────────────────────────────────

const Cart = () => {
  const navigate = useNavigate();
  const [items, setItems]                       = useState([]);
  const [addresses, setAddresses]               = useState([]);
  const [availableCoupons, setAvailableCoupons] = useState([]);
  const [shippingId, setShippingId]             = useState(null);
  const [billingId, setBillingId]               = useState(null);
  const [loading, setLoading]                   = useState(true);
  const [toast, setToast]                       = useState(null);
  const [couponData, setCouponData]             = useState(null);
  const [success, setSuccess]                   = useState(false);
  const [successMsg, setSuccessMsg]             = useState('');

  // UPI state
  const [paymentPlan, setPaymentPlan]     = useState('full');
  const [utrNumber, setUtrNumber]         = useState('');
  const [upiConfirming, setUpiConfirming] = useState(false);

  // Razorpay state
  const [razorpayChecking, setRazorpayChecking] = useState(false);

  const showToast  = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const { saving, scheduleUpdate } = useQtyUpdate(showToast);

  useEffect(() => {
    Promise.all([
      api.get('orders/cart/'),
      api.get('accounts/addresses/'),
      api.get('orders/coupons/active/'),
    ]).then(([cartRes, addrRes, couponRes]) => {
      setItems(cartRes.data?.items ?? []);
      setAddresses(addrRes.data ?? []);
      setAvailableCoupons(couponRes.data?.results ?? couponRes.data ?? []);
      const addrs = addrRes.data ?? [];
      const defShip = addrs.find(a => a.is_default_shipping);
      const defBill = addrs.find(a => a.is_default_billing);
      if (defShip) setShippingId(defShip.id);
      if (defBill) setBillingId(defBill.id);
    }).catch(() => showToast('Failed to load cart.', 'error'))
      .finally(() => setLoading(false));
  }, [showToast]);

  const handleQtyChange = useCallback((cartItemId, newQty) => {
    if (newQty <= 0) {
      setItems(prev => prev.filter(i => i.id !== cartItemId));
      scheduleUpdate(cartItemId, 0);
      setCouponData(null);
      return;
    }
    setItems(prev => prev.map(i => i.id === cartItemId ? { ...i, quantity: newQty } : i));
    scheduleUpdate(cartItemId, newQty);
    setCouponData(null);
  }, [scheduleUpdate]);

  // ── Direct UPI checkout ───────────────────────────────────────────────────
  const handleUpiConfirm = async () => {
    if (!shippingId) { showToast('Please select a shipping address.', 'error'); return; }
    if (!billingId)  { showToast('Please select a billing address.', 'error'); return; }
    if (!utrNumber.trim()) { showToast('Please enter your UPI Transaction Reference ID.', 'error'); return; }

    setUpiConfirming(true);
    try {
      const res = await api.post('orders/upi/checkout/', {
        shipping_address_id: shippingId,
        billing_address_id:  billingId,
        payment_plan:        paymentPlan,
        utr_number:          utrNumber.trim(),
        coupon_code:         couponData?.coupon_code || '',
      });
      setItems([]);
      setCouponData(null);
      setUtrNumber('');
      setSuccess(true);
      setSuccessMsg(`Order #${res.data.order_id} placed! We'll verify your payment within 2 hours.`);
      setTimeout(() => navigate('/history'), 3500);
    } catch (err) {
      showToast(err.response?.data?.error || 'Order failed. Please try again.', 'error');
    } finally {
      setUpiConfirming(false);
    }
  };

  // ── Razorpay checkout ─────────────────────────────────────────────────────
  const handleRazorpayCheckout = async () => {
    if (!shippingId) { showToast('Please select a shipping address.', 'error'); return; }
    if (!billingId)  { showToast('Please select a billing address.', 'error'); return; }

    setRazorpayChecking(true);
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      showToast('Failed to load payment gateway. Check your connection.', 'error');
      setRazorpayChecking(false);
      return;
    }

    let orderData;
    try {
      const res = await api.post('orders/razorpay/create/', {
        shipping_address_id: shippingId,
        billing_address_id:  billingId,
        coupon_code:         couponData?.coupon_code || '',
      });
      orderData = res.data;
    } catch (err) {
      showToast(err.response?.data?.error || 'Failed to initiate payment.', 'error');
      setRazorpayChecking(false);
      return;
    }

    const options = {
      key:         orderData.key_id,
      amount:      orderData.amount,
      currency:    orderData.currency,
      name:        'Pronoun Jeans',
      description: 'B2B Wholesale Order',
      order_id:    orderData.razorpay_order_id,
      prefill:     { name: orderData.name, email: orderData.email, contact: orderData.contact },
      theme:       { color: '#dc2626' },
      handler: async (response) => {
        try {
          await api.post('orders/razorpay/verify/', {
            razorpay_order_id:   response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature:  response.razorpay_signature,
          });
          setItems([]);
          setCouponData(null);
          setSuccess(true);
          setSuccessMsg('Payment successful! Order confirmed.');
          setTimeout(() => navigate('/history'), 2400);
        } catch (err) {
          showToast(err.response?.data?.error || 'Verification failed. Contact support.', 'error');
        } finally {
          setRazorpayChecking(false);
        }
      },
      modal: { ondismiss: () => { showToast('Payment cancelled.', 'error'); setRazorpayChecking(false); } },
    };

    const rzp = new window.Razorpay(options);
    rzp.on('payment.failed', () => { showToast('Payment failed.', 'error'); setRazorpayChecking(false); });
    rzp.open();
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const Spinner = () => <div className="flex items-center justify-center py-28"><Loader className="animate-spin text-accent w-9 h-9" /></div>;
  const EmptyCart = () => (
    <div className="flex flex-col items-center justify-center py-28 gap-4">
      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center">
        <ShoppingCart className="w-9 h-9 text-gray-400 dark:text-zinc-600" />
      </div>
      <p className="text-gray-900 dark:text-zinc-100 text-xl font-bold">Your cart is empty</p>
      <button onClick={() => navigate('/catalog')} className="mt-2 bg-accent hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-xl text-sm transition-colors">
        Browse Catalog
      </button>
    </div>
  );

  return (
    <div className="bg-gray-50 dark:bg-zinc-950 min-h-screen p-6 lg:p-12">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart className="w-7 h-7 text-accent" />
          <h1 className="text-gray-900 dark:text-zinc-100 text-3xl font-bold">Your Cart</h1>
          {!loading && items.length > 0 && (
            <span className="ml-1 bg-accent/15 border border-accent/25 text-accent text-xs font-bold px-2.5 py-1 rounded-full">
              {items.length} SKU{items.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Success screen */}
        {success && (
          <div className="flex flex-col items-center justify-center py-28 gap-5">
            <div className="w-20 h-20 rounded-full bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 flex items-center justify-center">
              <PackageCheck className="w-9 h-9 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-gray-900 dark:text-zinc-100 text-2xl font-bold text-center">{successMsg}</p>
            <p className="text-gray-500 dark:text-zinc-400 text-sm">Redirecting to your orders…</p>
            <Loader className="animate-spin text-accent w-5 h-5 mt-1" />
          </div>
        )}

        {!success && loading  && <Spinner />}
        {!success && !loading && items.length === 0 && <EmptyCart />}

        {!success && !loading && items.length > 0 && (
          <div className="space-y-8">
            {/* Desktop table */}
            <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden shadow-sm">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5">
                <h2 className="text-gray-900 dark:text-zinc-100 font-bold text-lg">Cart Items</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 dark:text-zinc-400 text-xs uppercase tracking-widest border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-zinc-800/50">
                      <th className="text-left px-6 py-4">Product</th>
                      <th className="text-left px-6 py-4">Size</th>
                      <th className="text-left px-6 py-4">Color</th>
                      <th className="text-left px-6 py-4">B2B Price</th>
                      <th className="text-left px-6 py-4">Quantity</th>
                      <th className="text-left px-6 py-4">Subtotal</th>
                      <th className="px-6 py-4" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <CartRow key={item.id} item={item} index={idx} onQtyChange={handleQtyChange} saving={saving} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {items.map(item => (
                <div key={item.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-4 shadow-sm">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-gray-900 dark:text-zinc-100 font-semibold text-sm">{item.variation?.product_name}</p>
                    <button onClick={() => handleQtyChange(item.id, 0)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-gray-400 text-xs font-mono mb-1">{item.variation?.sku}</p>
                  <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
                    <span>{item.variation?.size}</span><span>/</span>
                    <ColorSwatch hex={item.variation?.color_hex || '#CCCCCC'} name={item.variation?.color_name || item.variation?.color || '—'} />
                  </div>
                  <div className="flex items-center justify-between">
                    <QtyControl value={item.quantity} saving={!!saving[item.id]}
                      onDecrement={() => handleQtyChange(item.id, item.quantity - 1)}
                      onIncrement={() => handleQtyChange(item.id, item.quantity + 1)}
                      onDirectChange={(v) => handleQtyChange(item.id, v)} />
                    <span className="text-gray-900 dark:text-zinc-100 font-bold">
                      ₹{(parseFloat(item.variation?.b2b_price ?? 0) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <CheckoutPanel
              items={items} addresses={addresses}
              shippingId={shippingId} billingId={billingId}
              onShippingSelect={setShippingId} onBillingSelect={setBillingId}
              couponData={couponData} onCouponApply={setCouponData} onCouponRemove={() => setCouponData(null)}
              availableCoupons={availableCoupons}
              paymentPlan={paymentPlan} setPaymentPlan={setPaymentPlan}
              utrNumber={utrNumber} setUtrNumber={setUtrNumber}
              onUpiConfirm={handleUpiConfirm} upiConfirming={upiConfirming}
              onRazorpayCheckout={handleRazorpayCheckout} razorpayChecking={razorpayChecking}
            />
          </div>
        )}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDone={clearToast} />}
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
};

export default Cart;