import React, { useEffect, useState } from 'react';
import { X, MapPin, Clock, Loader, Package, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../api/axios';

const fmt = (ts) => {
  if (!ts) return '';
  try {
    const [datePart, timePart] = ts.split(' ');
    const [dd, mm, yyyy]       = datePart.split('-');
    const iso                  = `${yyyy}-${mm}-${dd}T${timePart}`;
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    });
  } catch {
    return ts;
  }
};

const TrackingTimelineModal = ({ order, isOpen, onClose, isAgent = false }) => {
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!isOpen || !order) return;
    setLoading(true);
    setError('');
    setTimeline([]);

    const endpoint = isAgent
      ? `orders/agent/orders/${order.id}/track-timeline/`
      : `orders/orders/${order.id}/track-timeline/`;

    api.get(endpoint)
      .then(res => setTimeline(res.data?.timeline ?? []))
      .catch((err) => {
        const msg = err.response?.data?.error || 'Failed to fetch tracking details. Please try again.';
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [isOpen, order?.id, isAgent]);

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl border border-gray-200 dark:border-white/5 shadow-xl flex flex-col max-h-[85vh]">

        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100 dark:border-white/5 shrink-0">
          <div>
            <h3 className="text-gray-900 dark:text-zinc-100 text-lg font-bold">Package Tracking</h3>
            <p className="text-gray-500 dark:text-zinc-400 text-sm mt-0.5">
              Order <span className="font-mono font-bold text-accent">#{order.id}</span>
              {order.tracking_number && (
                <span className="ml-2 text-xs font-mono text-gray-400 dark:text-zinc-500">
                  AWB: {order.tracking_number}
                </span>
              )}
            </p>
            {order.courier_name && (
              <span className="inline-block mt-1.5 text-xs font-bold bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 px-2.5 py-0.5 rounded-full">
                {order.courier_name}
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors p-1 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader className="animate-spin text-accent w-8 h-8" />
              <p className="text-gray-500 dark:text-zinc-400 text-sm">Fetching tracking details…</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <AlertCircle className="w-10 h-10 text-red-400" />
              <p className="text-red-600 dark:text-red-400 text-sm text-center">{error}</p>
            </div>
          ) : timeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Package className="w-10 h-10 text-gray-300 dark:text-zinc-700" />
              <p className="text-gray-500 dark:text-zinc-400 text-sm">No tracking events available yet.</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-accent/30" />
              <div className="space-y-6">
                {timeline.map((event, idx) => (
                  <div key={idx} className="flex gap-4 relative">
                    <div className="w-6 h-6 rounded-full border-2 bg-accent border-accent flex items-center justify-center shrink-0 mt-0.5 z-10">
                      <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">
                        {event.message || event.status || 'Update'}
                      </p>
                      {event.status && (
                        <span className="inline-block mt-1 text-[10px] font-semibold bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 px-2 py-0.5 rounded-full">
                          {event.status}
                        </span>
                      )}
                      <div className="flex flex-wrap items-center gap-3 mt-1.5">
                        {event.location && (
                          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-zinc-500 text-xs">
                            <MapPin className="w-3 h-3" />{event.location}
                          </span>
                        )}
                        {event.timestamp && (
                          <span className="inline-flex items-center gap-1 text-gray-400 dark:text-zinc-500 text-xs">
                            <Clock className="w-3 h-3" />{fmt(event.timestamp)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 dark:border-white/5 shrink-0">
          <button onClick={onClose}
            className="w-full border border-gray-200 dark:border-white/10 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 font-bold py-2.5 rounded-xl text-sm transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrackingTimelineModal;