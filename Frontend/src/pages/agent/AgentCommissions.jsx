import React, { useEffect, useState } from 'react';
import { IndianRupee, Loader, TrendingUp, CheckCircle2, Clock } from 'lucide-react';
import api from '../../api/axios';

const fmt = (val) =>
  `₹${parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const StatusPill = ({ status }) =>
  status === 'Paid' ? (
    <span className="inline-flex items-center bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/20 text-xs font-bold px-2.5 py-1 rounded-full">
      Paid
    </span>
  ) : (
    <span className="inline-flex items-center bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 text-xs font-bold px-2.5 py-1 rounded-full">
      Pending
    </span>
  );

const SummaryCard = ({ icon: Icon, label, value, iconBg, iconColor }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-white/5 p-5 shadow-sm flex items-center gap-4">
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
      <Icon className={`w-5 h-5 ${iconColor}`} />
    </div>
    <div>
      <p className="text-xl font-black text-gray-900 dark:text-zinc-100">{value}</p>
      <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest">{label}</p>
    </div>
  </div>
);

const AgentCommissions = () => {
  const [commissions, setCommissions] = useState([]);
  const [ledger, setLedger]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');

  useEffect(() => {
    Promise.all([
      api.get('orders/agent/commissions/'),
      api.get('orders/agent/ledger/'),
    ])
      .then(([commRes, ledgerRes]) => {
        setCommissions(commRes.data?.results ?? commRes.data ?? []);
        setLedger(ledgerRes.data);
      })
      .catch(() => setError('Failed to load commission data.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-accent text-xs font-black uppercase tracking-widest mb-1">Agent Portal</p>
        <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">My Commissions</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">Order-wise commission breakdown and payment status.</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      {/* Ledger summary */}
      {!loading && ledger && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <SummaryCard icon={TrendingUp}   label="Total Earned" value={fmt(ledger.total_earned)}
            iconBg="bg-green-50 dark:bg-green-500/10"   iconColor="text-green-600 dark:text-green-400" />
          <SummaryCard icon={CheckCircle2} label="Total Paid"   value={fmt(ledger.total_paid)}
            iconBg="bg-blue-50 dark:bg-blue-500/10"     iconColor="text-blue-600 dark:text-blue-400" />
          <SummaryCard icon={Clock}        label="Balance Due"  value={fmt(ledger.balance_due)}
            iconBg="bg-orange-50 dark:bg-orange-500/10" iconColor="text-orange-600 dark:text-orange-400" />
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-accent w-8 h-8" />
          </div>
        ) : commissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <IndianRupee className="w-12 h-12 text-gray-300 dark:text-zinc-700" />
            <p className="text-gray-500 dark:text-zinc-400 text-sm">No commissions recorded yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[700px]">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 font-medium uppercase text-xs border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="px-5 py-3.5">Order ID</th>
                  <th className="px-5 py-3.5">Buyer</th>
                  <th className="px-5 py-3.5">Order Total</th>
                  <th className="px-5 py-3.5">Commission %</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Paid Date</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c, idx) => (
                  <tr key={c.id}
                    className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-white/[0.01]'}`}>
                    <td className="px-5 py-4 font-mono font-bold text-accent">#{c.order_id}</td>
                    <td className="px-5 py-4">
                      <p className="text-gray-900 dark:text-zinc-100 font-semibold text-sm">{c.buyer_company || c.buyer_email}</p>
                      <p className="text-gray-400 dark:text-zinc-500 text-xs">{c.buyer_email}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-700 dark:text-zinc-300 font-semibold whitespace-nowrap">
                      {fmt(c.order_total)}
                    </td>
                    <td className="px-5 py-4 text-gray-600 dark:text-zinc-400">
                      {c.commission_percentage}%
                    </td>
                    <td className="px-5 py-4 text-gray-900 dark:text-zinc-100 font-black whitespace-nowrap">
                      {fmt(c.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="px-5 py-4 text-gray-500 dark:text-zinc-400 text-xs whitespace-nowrap">
                      {c.paid_at
                        ? new Date(c.paid_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentCommissions;