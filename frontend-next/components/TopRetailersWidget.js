'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, RefreshCw, ChevronRight, AlertCircle } from 'lucide-react';
import { authFetch } from '../app/admin/layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);

export default function TopRetailersWidget() {
  const [data, setData] = useState(null);
  const [period, setPeriod] = useState('quarter');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/reports/top-retailers?period=${period}&limit=5`
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
      data-testid="top-retailers-widget"
    >
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
            <Trophy size={16} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Top 5 B2B Retailers
            </h3>
            <p className="text-xs text-slate-500">
              {data?.period_label || '—'} · paid orders only
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            data-testid="top-retailers-period"
          >
            <option value="quarter">This Quarter</option>
            <option value="fy">This FY</option>
          </select>
          <Link
            href="/admin/b2b/reports"
            className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1"
          >
            Full report <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="animate-spin text-slate-400" size={20} />
        </div>
      ) : !data || data.top_retailers.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-8">
          No paid B2B orders in this period yet.
        </p>
      ) : (
        <div className="space-y-2">
          {data.top_retailers.map((r, idx) => (
            <Link
              key={r.retailer_id}
              href={`/admin/b2b/retailers/${r.retailer_id}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700"
              data-testid={`top-retailer-${idx}`}
            >
              <span className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 text-sm font-bold flex items-center justify-center">
                {idx + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-800 dark:text-white truncate">
                  {r.retailer_name}
                </p>
                <p className="text-xs text-slate-500">
                  {r.order_count} order{r.order_count === 1 ? '' : 's'}
                  {r.applied_milestone && (
                    <>
                      {' · '}
                      <span className="text-emerald-700 font-medium">
                        {r.applied_milestone.discount_percent}% bonus active
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-800 dark:text-white">
                  {formatCurrency(r.purchases_total)}
                </p>
                {r.is_close_to_next && r.next_milestone && (
                  <p
                    className="text-[11px] text-amber-600 flex items-center gap-1 justify-end"
                    title={`${formatCurrency(r.gap_to_next)} more for ${r.next_milestone.discount_percent}%`}
                  >
                    <AlertCircle size={10} />
                    {formatCurrency(r.gap_to_next)} → {r.next_milestone.discount_percent}%
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
