import React, { useState } from 'react';
import {
  X, Truck, Hash, Link, Loader2,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import api from '../../api/axios';

const UpdateTrackingModal = ({ order, onClose, onSuccess }) => {
  const [form, setForm]   = useState({
    courier_name:    order.courier_name    || '',
    tracking_number: order.tracking_number || '',
    tracking_url:    order.tracking_url    || '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!form.courier_name.trim() && !form.tracking_number.trim()) {
      setError('Please enter at least a courier name or tracking number.');
      return;
    }

    setLoading(true);
    try {
      await api.patch(`orders/agent/orders/${order.id}/tracking/`, {
        courier_name:    form.courier_name.trim()    || null,
        tracking_number: form.tracking_number.trim() || null,
        tracking_url:    form.tracking_url.trim()    || null,
      });
      setSuccess(true);
      onSuccess();
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        const fe = {};
        Object.entries(data).forEach(([k, v]) => { fe[k] = Array.isArray(v) ? v[0] : v; });
        setFieldErrors(fe);
      } else {
        setError('Failed to update tracking. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/5">
          <div>
            <h3 className="text-gray-900 dark:text-zinc-100 text-lg font-bold">
              {order.tracking_number ? 'Edit Tracking' : 'Add Tracking'}
            </h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
              Order <span className="font-mono font-bold text-accent">#{order.id}</span>
              {order.user && <span className="ml-1">— {order.user}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full bg-green-50 dark:bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-7 h-7 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-gray-900 dark:text-zinc-100 font-bold text-base mb-2">Tracking Updated!</h4>
              <p className="text-gray-500 dark:text-zinc-400 text-sm mb-6">
                The tracking information has been saved successfully.
              </p>
              <button onClick={onClose}
                className="w-full bg-accent hover:bg-red-700 text-white font-bold py-3 rounded-xl text-sm transition-colors">
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <TrackingField
                icon={Truck} label="Courier Name"
                placeholder="e.g. Delhivery, BlueDart, DTDC"
                value={form.courier_name} onChange={set('courier_name')}
                error={fieldErrors.courier_name}
              />
              <TrackingField
                icon={Hash} label="Tracking Number"
                placeholder="e.g. 1234567890"
                value={form.tracking_number} onChange={set('tracking_number')}
                error={fieldErrors.tracking_number}
              />
              <TrackingField
                icon={Link} label="Tracking URL (optional)"
                type="url"
                placeholder="https://www.delhivery.com/track/..."
                value={form.tracking_url} onChange={set('tracking_url')}
                error={fieldErrors.tracking_url}
                hint="Buyers will see a clickable link to track their shipment."
              />

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-bold py-3 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors">
                  {loading
                    ? <><Loader2 className="animate-spin w-4 h-4" /> Saving…</>
                    : order.tracking_number ? 'Update Tracking' : 'Save Tracking'
                  }
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const TrackingField = ({ icon: Icon, label, type = 'text', placeholder, value, onChange, error, hint }) => (
  <div>
    <label className="text-gray-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest block mb-1.5">{label}</label>
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        className={`w-full bg-gray-50 dark:bg-zinc-800 border text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors ${
          error
            ? 'border-red-300 dark:border-red-500/50 focus:border-red-500'
            : 'border-gray-200 dark:border-white/10 focus:border-accent'
        }`}
      />
    </div>
    {hint && !error && <p className="text-gray-400 dark:text-zinc-500 text-xs mt-1">{hint}</p>}
    {error && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{error}</p>}
  </div>
);

export default UpdateTrackingModal;