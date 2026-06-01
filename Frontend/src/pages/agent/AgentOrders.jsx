import React, { useEffect, useState, useCallback } from 'react';
import { Package, Loader, ExternalLink, Pencil, Plus } from 'lucide-react';
import api from '../../api/axios';
import UpdateTrackingModal from '../../components/agent/UpdateTrackingModal';

const fmt = (val) =>
  `₹${parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLES = {
  PENDING:   'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20',
  APPROVED:  'bg-blue-50   dark:bg-blue-500/10   text-blue-700   dark:text-blue-400   border-blue-200   dark:border-blue-500/20',
  SHIPPED:   'bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-500/20',
  DELIVERED: 'bg-green-50  dark:bg-green-500/10  text-green-700  dark:text-green-400  border-green-200  dark:border-green-500/20',
  CANCELLED: 'bg-red-50    dark:bg-red-500/10    text-red-700    dark:text-red-400    border-red-200    dark:border-red-500/20',
};

const StatusPill = ({ status }) => (
  <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}>
    {status?.toLowerCase()}
  </span>
);

const TrackingCell = ({ order, onEdit }) => {
  if (!order.tracking_number) {
    return (
      <button
        onClick={() => onEdit(order)}
        className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-zinc-400 hover:text-accent border border-gray-200 dark:border-white/10 hover:border-accent/40 px-2.5 py-1.5 rounded-lg transition-colors"
      >
        <Plus className="w-3 h-3" /> Add Tracking
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="space-y-0.5 flex-1 min-w-0">
        {order.courier_name && (
          <p className="text-gray-500 dark:text-zinc-400 text-xs font-semibold">{order.courier_name}</p>
        )}
        {order.tracking_url ? (
          <a href={order.tracking_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline text-xs font-mono">
            {order.tracking_number}
            <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <p className="text-gray-700 dark:text-zinc-300 text-xs font-mono">{order.tracking_number}</p>
        )}
      </div>
      <button
        onClick={() => onEdit(order)}
        className="text-gray-400 dark:text-zinc-500 hover:text-accent transition-colors shrink-0 p-0.5"
        title="Edit tracking"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

const AgentOrders = () => {
  const [orders, setOrders]                         = useState([]);
  const [loading, setLoading]                       = useState(true);
  const [error, setError]                           = useState('');
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState(null);

  const fetchOrders = useCallback(() => {
    setLoading(true);
    api.get('orders/agent/orders/')
      .then(res => setOrders(res.data?.results ?? res.data ?? []))
      .catch(() => setError('Failed to load orders.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <p className="text-accent text-xs font-black uppercase tracking-widest mb-1">Agent Portal</p>
        <h1 className="text-2xl font-black text-gray-900 dark:text-zinc-100">Buyer Orders</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mt-1">
          {loading ? '—' : `${orders.length} order${orders.length !== 1 ? 's' : ''} from your buyers`}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/25 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-xl mb-6">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="animate-spin text-accent w-8 h-8" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Package className="w-12 h-12 text-gray-300 dark:text-zinc-700" />
            <p className="text-gray-500 dark:text-zinc-400 text-sm">No orders found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[750px]">
              <thead className="bg-gray-50 dark:bg-zinc-800/50 text-gray-500 dark:text-zinc-400 font-medium uppercase text-xs border-b border-gray-100 dark:border-white/5">
                <tr>
                  <th className="px-5 py-3.5">Order ID</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Buyer</th>
                  <th className="px-5 py-3.5">Total</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5">Tracking</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order, idx) => (
                  <tr key={order.id}
                    className={`border-b border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30 dark:bg-white/[0.01]'}`}>
                    <td className="px-5 py-4 font-mono font-bold text-accent">#{order.id}</td>
                    <td className="px-5 py-4 text-gray-600 dark:text-zinc-300 whitespace-nowrap">
                      {new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-gray-900 dark:text-zinc-100 font-semibold">{order.user || '—'}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-900 dark:text-zinc-100 font-bold whitespace-nowrap">
                      {fmt(order.total_amount)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusPill status={order.status} />
                    </td>
                    <td className="px-5 py-4">
                      <TrackingCell order={order} onEdit={setSelectedOrderForTracking} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedOrderForTracking && (
        <UpdateTrackingModal
          order={selectedOrderForTracking}
          onClose={() => setSelectedOrderForTracking(null)}
          onSuccess={() => {
            fetchOrders();
            setSelectedOrderForTracking(null);
          }}
        />
      )}
    </div>
  );
};

export default AgentOrders;