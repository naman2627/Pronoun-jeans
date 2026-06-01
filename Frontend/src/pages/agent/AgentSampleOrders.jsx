import React, { useEffect, useState, useCallback } from 'react';
import { FileText, Loader, Plus } from 'lucide-react';
import api from '../../api/axios';
import LogSampleModal from '../../components/agent/LogSampleModal';

const fmt = (val) =>
  `₹${parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const AgentSampleOrders = () => {
  const [samples, setSamples]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchSamples = useCallback(() => {
    setLoading(true);
    api.get('orders/agent/sample-orders/')
      .then(res => setSamples(res.data?.results ?? res.data ?? []))
      .catch(() => setError('Failed to load sample orders.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);

  const handleSampleSuccess = () => {
    fetchSamples();
  };

  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-accent text-xs font-black uppercase tracking-widest mb-1">Agent Portal</p>
          <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">Sample Orders</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
            {loading ? '—' : `${samples.length} sample order${samples.length !== 1 ? 's' : ''} on record`}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-accent hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Log New Sample
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Table card */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-accent w-8 h-8" />
          </div>
        ) : samples.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <FileText className="w-12 h-12 text-gray-300 dark:text-zinc-700" />
            <p className="text-gray-500 dark:text-zinc-400 text-sm">No sample orders recorded yet.</p>
            <button onClick={() => setModalOpen(true)}
              className="text-accent text-sm font-semibold hover:underline">
              Log your first sample →
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[560px]">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 font-medium uppercase text-xs border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">D. No.</th>
                  <th className="px-5 py-3.5">Buyer</th>
                  <th className="px-5 py-3.5">Rate</th>
                </tr>
              </thead>
              <tbody>
                {samples.map((s, idx) => (
                  <tr key={s.id}
                    className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-white/[0.01]'}`}>
                    <td className="px-5 py-4 text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                      {new Date(s.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">{s.design_number}</span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-900 dark:text-zinc-100 font-semibold">{s.buyer_company || s.buyer_name || '—'}</p>
                      <p className="text-gray-400 dark:text-zinc-500 text-xs">{s.buyer_email}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-900 dark:text-zinc-100 font-bold whitespace-nowrap">
                      {fmt(s.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <LogSampleModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); handleSampleSuccess(); }}
        />
      )}
    </div>
  );
};

export default AgentSampleOrders;