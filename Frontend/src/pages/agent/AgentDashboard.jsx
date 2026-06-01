import React, { useEffect, useState } from 'react';
import { IndianRupee, TrendingUp, CheckCircle2, Clock, Loader, Trophy, Wallet, Star } from 'lucide-react';
import api from '../../api/axios';
import { useAuthStore } from '../../store/useAuthStore';

const fmt = (val) =>
  `₹${parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const MetricCard = ({ icon: Icon, label, value, sub, iconBg, iconColor, loading, children }) => (
  <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
    <div className="flex items-start justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
    </div>
    {loading ? (
      <div className="space-y-2 animate-pulse">
        <div className="h-7 w-28 bg-gray-200 dark:bg-zinc-700 rounded" />
        <div className="h-3 w-20 bg-gray-100 dark:bg-zinc-800 rounded" />
      </div>
    ) : (
      <>
        <p className="text-2xl font-black text-gray-900 dark:text-zinc-100">{value}</p>
        <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-widest mt-1">{label}</p>
        {sub && <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{sub}</p>}
        {children}
      </>
    )}
  </div>
);

const BonusProgressCard = ({ ledger, loading }) => {
  const threshold = parseFloat(ledger?.bonus_threshold || 500000);
  const sales     = parseFloat(ledger?.total_delivered_sales || 0);
  const pct       = Math.min((sales / threshold) * 100, 100);
  const unlocked  = ledger?.bonus_unlocked;
  const remaining = Math.max(threshold - sales, 0);

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm col-span-1 md:col-span-2 xl:col-span-3">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${unlocked ? 'bg-yellow-50 dark:bg-yellow-500/10' : 'bg-gray-100 dark:bg-zinc-800'}`}>
            <Trophy className={`w-5 h-5 ${unlocked ? 'text-yellow-500' : 'text-gray-400 dark:text-zinc-500'}`} />
          </div>
          <div>
            <p className="text-gray-900 dark:text-zinc-100 font-bold text-sm">Performance Bonus</p>
            <p className="text-gray-400 dark:text-zinc-500 text-xs">Earn ₹5,000 bonus on ₹5,00,000 in delivered sales</p>
          </div>
        </div>
        {unlocked && (
          <span className="flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-3 py-1.5 rounded-full">
            <Star className="w-3.5 h-3.5" /> Bonus Unlocked!
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2 animate-pulse">
          <div className="h-3 w-full bg-gray-200 dark:bg-zinc-700 rounded-full" />
          <div className="h-3 w-32 bg-gray-100 dark:bg-zinc-800 rounded" />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-zinc-400 mb-2">
            <span>{fmt(sales)} delivered sales</span>
            <span>{pct.toFixed(1)}% of ₹5,00,000</span>
          </div>
          <div className="w-full h-3 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${unlocked ? 'bg-yellow-400' : 'bg-accent'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {!unlocked && (
            <p className="text-gray-400 dark:text-zinc-500 text-xs mt-2">
              Add <span className="text-gray-900 dark:text-zinc-100 font-bold">{fmt(remaining)}</span> more in delivered sales to unlock ₹5,000 bonus
            </p>
          )}
          {unlocked && ledger?.bonus_earned > 0 && (
            <p className="text-yellow-600 dark:text-yellow-400 text-xs font-semibold mt-2">
              ₹5,000 bonus has been added to your ledger 🎉
            </p>
          )}
        </>
      )}
    </div>
  );
};

const AgentDashboard = () => {
  const { user } = useAuthStore();
  const [ledger, setLedger]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    api.get('orders/agent/ledger/')
      .then(res => setLedger(res.data))
      .catch(() => setError('Failed to load ledger data.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <p className="text-accent text-xs font-black uppercase tracking-widest mb-1">Agent Portal</p>
        <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">
          Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
          Here's your commission summary at a glance.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        <MetricCard
          icon={TrendingUp}
          label="Total Delivered Sales"
          value={loading ? '' : fmt(ledger?.total_delivered_sales)}
          sub="Sum of all delivered orders"
          iconBg="bg-blue-50 dark:bg-blue-500/10"
          iconColor="text-blue-600 dark:text-blue-400"
          loading={loading}
        />
        <MetricCard
          icon={IndianRupee}
          label="Total Earned"
          value={loading ? '' : fmt(ledger?.total_earned)}
          sub={loading ? '' : ledger?.bonus_earned > 0 ? `Includes ₹${parseFloat(ledger.bonus_earned).toFixed(2)} bonus` : 'Commissions only'}
          iconBg="bg-green-50 dark:bg-green-500/10"
          iconColor="text-green-600 dark:text-green-400"
          loading={loading}
        />
        <MetricCard
          icon={CheckCircle2}
          label="Amount Received"
          value={loading ? '' : fmt(ledger?.total_paid_out)}
          sub="Paid out by admin"
          iconBg="bg-purple-50 dark:bg-purple-500/10"
          iconColor="text-purple-600 dark:text-purple-400"
          loading={loading}
        />
        <MetricCard
          icon={Clock}
          label="Outstanding Balance"
          value={loading ? '' : fmt(ledger?.outstanding_balance)}
          sub="Earned minus received"
          iconBg="bg-orange-50 dark:bg-orange-500/10"
          iconColor="text-orange-600 dark:text-orange-400"
          loading={loading}
        />
        <MetricCard
          icon={Wallet}
          label="Commission Rate"
          value={loading ? '' : `${parseFloat(ledger?.commission_percentage || 0).toFixed(1)}%`}
          sub="On all delivered orders"
          iconBg="bg-accent/10"
          iconColor="text-accent"
          loading={loading}
        />

        <BonusProgressCard ledger={ledger} loading={loading} />
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 p-6 shadow-sm">
        <h2 className="text-gray-900 dark:text-zinc-100 font-bold text-sm mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'My Buyers',     to: '/agent/buyers'      },
            { label: 'Orders',        to: '/agent/orders'      },
            { label: 'Commissions',   to: '/agent/commissions' },
            { label: 'Sample Orders', to: '/agent/samples'     },
          ].map(({ label, to }) => (
            <a key={to} href={to}
              className="flex items-center justify-center text-center text-sm font-semibold text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 hover:bg-gray-100 dark:hover:bg-zinc-700 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 transition-colors">
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AgentDashboard;