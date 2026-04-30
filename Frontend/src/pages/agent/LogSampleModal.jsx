import React, { useState, useEffect } from 'react';
import {
  X, User, Hash, Calendar, IndianRupee,
  Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';
import api from '../../api/axios';

const today = () => new Date().toISOString().split('T')[0];

const LogSampleModal = ({ onClose, onSuccess }) => {
  const [buyers, setBuyers]   = useState([]);
  const [buyersLoading, setBuyersLoading] = useState(true);

  const [form, setForm]       = useState({
    buyer:         '',
    design_number: '',
    date:          today(),
    rate:          '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  // Fetch agent's buyers for the dropdown
  useEffect(() => {
    api.get('accounts/agent/buyers/')
      .then(res => setBuyers(res.data?.results ?? res.data ?? []))
      .catch(() => setError('Failed to load buyers.'))
      .finally(() => setBuyersLoading(false));
  }, []);

  const set = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (!form.buyer) { setFieldErrors({ buyer: 'Please select a buyer.' }); return; }
    if (!form.design_number.trim()) { setFieldErrors({ design_number: 'Design number is required.' }); return; }
    if (!form.rate || parseFloat(form.rate) <= 0) { setFieldErrors({ rate: 'Enter a valid rate.' }); return; }

    setLoading(true);
    try {
      await api.post('orders/agent/sample-orders/', {
        buyer:         parseInt(form.buyer),
        design_number: form.design_number.trim(),
        date:          form.date,
        rate:          parseFloat(form.rate),
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
        setError('Failed to log sample. Please try again.');
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
            <h3 className="text-gray-900 dark:text-zinc-100 text-lg font-bold">Log New Sample</h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">Record a sample given to a buyer.</p>
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
              <h4 className="text-gray-900 dark:text-zinc-100 font-bold text-base mb-2">Sample Logged!</h4>
              <p className="text-gray-500 dark:text-zinc-400 text-sm mb-6">
                The sample has been recorded successfully.
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

              {/* Buyer dropdown */}
              <div>
                <label className="text-gray-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest block mb-1.5">
                  Buyer *
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
                  <select
                    value={form.buyer} onChange={set('buyer')}
                    disabled={buyersLoading}
                    className={`w-full bg-gray-50 dark:bg-zinc-800 border text-gray-900 dark:text-zinc-100 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors appearance-none ${
                      fieldErrors.buyer
                        ? 'border-red-300 dark:border-red-500/50'
                        : 'border-gray-200 dark:border-white/10 focus:border-accent'
                    }`}
                  >
                    <option value="">
                      {buyersLoading ? 'Loading buyers…' : 'Select a buyer'}
                    </option>
                    {buyers.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.company_name || b.full_name || b.email}
                      </option>
                    ))}
                  </select>
                </div>
                {fieldErrors.buyer && (
                  <p className="text-red-500 dark:text-red-400 text-sm mt-1">{fieldErrors.buyer}</p>
                )}
              </div>

              {/* Design Number */}
              <FormField
                icon={Hash} label="Design No. (D.No.) *"
                placeholder="e.g. 761"
                value={form.design_number} onChange={set('design_number')}
                error={fieldErrors.design_number}
              />

              {/* Date */}
              <FormField
                icon={Calendar} label="Date *" type="date"
                value={form.date} onChange={set('date')}
                error={fieldErrors.date}
              />

              {/* Rate */}
              <FormField
                icon={IndianRupee} label="Rate (₹) *" type="number"
                placeholder="e.g. 2500"
                value={form.rate} onChange={set('rate')}
                error={fieldErrors.rate}
                min="0" step="0.01"
              />

              <div className="flex items-center gap-3 pt-1">
                <button type="button" onClick={onClose}
                  className="flex-1 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-bold py-3 rounded-xl text-sm transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading || buyersLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors">
                  {loading ? <><Loader2 className="animate-spin w-4 h-4" /> Saving…</> : 'Log Sample'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

const FormField = ({ icon: Icon, label, type = 'text', placeholder, value, onChange, error, min, step }) => (
  <div>
    <label className="text-gray-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-widest block mb-1.5">{label}</label>
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
      <input
        type={type} value={value} onChange={onChange} placeholder={placeholder}
        min={min} step={step}
        className={`w-full bg-gray-50 dark:bg-zinc-800 border text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 rounded-xl pl-11 pr-4 py-3 text-sm focus:outline-none transition-colors ${
          error
            ? 'border-red-300 dark:border-red-500/50 focus:border-red-500'
            : 'border-gray-200 dark:border-white/10 focus:border-accent'
        }`}
      />
    </div>
    {error && <p className="text-red-500 dark:text-red-400 text-sm mt-1">{error}</p>}
  </div>
);

export default LogSampleModal;