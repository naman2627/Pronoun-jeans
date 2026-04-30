import React, { useEffect, useState, useCallback } from 'react';
import { Users, Loader, UserPlus, Search, X } from 'lucide-react';
import api from '../../api/axios';
import OnboardBuyerModal from '../../components/agent/OnboardBuyerModal';

const StatusPill = ({ verified }) =>
  verified ? (
    <span className="inline-flex items-center bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 text-xs font-bold px-2.5 py-1 rounded-full">
      Verified
    </span>
  ) : (
    <span className="inline-flex items-center bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/20 text-xs font-bold px-2.5 py-1 rounded-full">
      Pending
    </span>
  );

const AgentBuyers = () => {
  const [buyers, setBuyers]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [search, setSearch]       = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchBuyers = useCallback(() => {
    setLoading(true);
    api.get('accounts/agent/buyers/')
      .then(res => setBuyers(res.data?.results ?? res.data ?? []))
      .catch(() => setError('Failed to load buyers.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchBuyers(); }, [fetchBuyers]);

  const handleOnboardSuccess = () => {
    // Re-fetch buyers so new entry appears immediately
    fetchBuyers();
  };

  const filtered = buyers.filter(b => {
    const q = search.toLowerCase();
    return (
      b.email?.toLowerCase().includes(q) ||
      b.company_name?.toLowerCase().includes(q) ||
      b.full_name?.toLowerCase().includes(q) ||
      b.phone_number?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <p className="text-accent text-xs font-black uppercase tracking-widest mb-1">Agent Portal</p>
          <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">My Assigned Buyers</h1>
          <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
            {loading ? '—' : `${buyers.length} buyer${buyers.length !== 1 ? 's' : ''} assigned to you`}
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 bg-accent hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-colors shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Onboard New Buyer
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

        {/* Search */}
        <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-zinc-500 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search buyers…"
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-white/10 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl pl-9 pr-8 py-2 text-sm focus:outline-none focus:border-accent transition-colors" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-zinc-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {search && (
            <span className="text-xs text-gray-400 dark:text-zinc-500">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-accent w-8 h-8" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Users className="w-12 h-12 text-gray-300 dark:text-zinc-700" />
            <p className="text-gray-500 dark:text-zinc-400 text-sm">
              {search ? `No buyers match "${search}"` : 'No buyers assigned yet.'}
            </p>
            {!search && (
              <button onClick={() => setModalOpen(true)}
                className="text-accent text-sm font-semibold hover:underline">
                Onboard your first buyer →
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 font-medium uppercase text-xs border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="px-5 py-3.5">Name</th>
                  <th className="px-5 py-3.5">Company</th>
                  <th className="px-5 py-3.5">Email</th>
                  <th className="px-5 py-3.5">Phone</th>
                  <th className="px-5 py-3.5">GST</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((buyer, idx) => (
                  <tr key={buyer.id}
                    className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-white/[0.01]'}`}>
                    <td className="px-5 py-4">
                      <p className="text-gray-900 dark:text-zinc-100 font-semibold">{buyer.full_name || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-zinc-300">{buyer.company_name || '—'}</td>
                    <td className="px-5 py-4 text-gray-500 dark:text-zinc-400 font-mono text-xs">{buyer.email}</td>
                    <td className="px-5 py-4 text-gray-500 dark:text-zinc-400">{buyer.phone_number || '—'}</td>
                    <td className="px-5 py-4 text-gray-400 dark:text-zinc-500 font-mono text-xs">{buyer.gst_number || '—'}</td>
                    <td className="px-5 py-4"><StatusPill verified={buyer.is_verified_b2b} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <OnboardBuyerModal
          onClose={() => setModalOpen(false)}
          onSuccess={handleOnboardSuccess}
        />
      )}
    </div>
  );
};

export default AgentBuyers;