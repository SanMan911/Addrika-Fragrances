'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Mail, ChevronDown, ChevronUp, Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminNotifyMePage() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [detailEmails, setDetailEmails] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/notify-me`);
      if (res.ok) {
        setGroups(await res.json());
      }
    } catch (err) {
      toast.error('Failed to load notify-me data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = async (productId) => {
    if (expandedProduct === productId) {
      setExpandedProduct(null);
      return;
    }
    setExpandedProduct(productId);
    setDetailLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/notify-me/${productId}`);
      if (res.ok) {
        setDetailEmails(await res.json());
      }
    } catch (err) {
      toast.error('Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const totalSignups = groups.reduce((sum, g) => sum + g.count, 0);

  return (
    <div className="space-y-6" data-testid="admin-notify-me-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Bell size={24} className="text-amber-400" />
          Notify Me Signups
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {totalSignups} email{totalSignups !== 1 ? 's' : ''} collected across {groups.length} product{groups.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-3xl font-bold text-amber-400">{totalSignups}</p>
          <p className="text-xs text-slate-400">Total Signups</p>
        </div>
        <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20">
          <p className="text-3xl font-bold text-purple-400">{groups.length}</p>
          <p className="text-xs text-slate-400">Products Tracked</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-700/50 border border-slate-700">
          <p className="text-3xl font-bold text-white">
            {groups.length > 0 ? Math.max(...groups.map(g => g.count)) : 0}
          </p>
          <p className="text-xs text-slate-400">Most Popular</p>
        </div>
      </div>

      {/* Product Groups */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Mail size={48} className="mx-auto mb-3 opacity-30" />
          <p>No notify-me signups yet</p>
          <p className="text-xs mt-1">Signups will appear here when customers request notifications for Coming Soon products</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groups.map(group => (
            <div
              key={group.product_id}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden"
              data-testid={`notify-group-${group.product_id}`}
            >
              <button
                onClick={() => toggleExpand(group.product_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <Package size={18} className="text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{group.product_name || group.product_id}</h3>
                    <p className="text-xs text-slate-400">Latest signup: {group.latest ? new Date(group.latest).toLocaleDateString() : '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-sm font-semibold">
                    {group.count} email{group.count !== 1 ? 's' : ''}
                  </span>
                  {expandedProduct === group.product_id ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
                </div>
              </button>

              {expandedProduct === group.product_id && (
                <div className="border-t border-slate-700/50 p-4">
                  {detailLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {detailEmails.map((entry, i) => (
                        <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-slate-700/30">
                          <span className="text-sm text-slate-300 flex items-center gap-2">
                            <Mail size={14} className="text-slate-500" />
                            {entry.email}
                          </span>
                          <span className="text-xs text-slate-500">
                            {entry.created_at ? new Date(entry.created_at).toLocaleString() : '—'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
