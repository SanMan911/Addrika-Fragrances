'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, BarChart3, RefreshCw, Calendar, Users, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatCurrency = (v) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);

const formatDate = (s) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
};

export default function AdminB2BReportsPage() {
  const [period, setPeriod] = useState('quarter');
  const [groupBy, setGroupBy] = useState('retailer');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period, group_by: groupBy });
      if (period === 'custom') {
        if (!fromDate || !toDate) {
          toast.error('Pick a date range');
          setLoading(false);
          return;
        }
        params.set('from_date', fromDate);
        params.set('to_date', toDate);
      }
      const res = await authFetch(`${API_URL}/api/admin/b2b/reports/sales?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed');
      }
      setReport(await res.json());
    } catch (e) {
      toast.error(e.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  }, [period, groupBy, fromDate, toDate]);

  useEffect(() => {
    if (period !== 'custom') fetchReport();
  }, [period, groupBy, fetchReport]);

  const exportCsv = () => {
    if (!report?.breakdown?.length) return;
    const cols =
      groupBy === 'retailer'
        ? ['key', 'label', 'email', 'order_count', 'purchases_total', 'gst_total']
        : ['key', 'label', 'order_count', 'purchases_total', 'gst_total'];
    const header = cols.join(',');
    const rows = report.breakdown.map((r) =>
      cols
        .map((c) => {
          const v = r[c] ?? '';
          return /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
        })
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `b2b-sales-${report.period_label}-${groupBy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="admin-b2b-reports">
      <div className="flex items-center gap-3">
        <Link
          href="/admin/b2b"
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart3 size={22} /> B2B Sales Report
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Tracked over calendar quarters; FY view sums Apr 1 → Mar 31. Pick a
            custom range for any other window.
          </p>
        </div>
      </div>

      {/* Filters */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Period</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              data-testid="reports-period"
            >
              <option value="quarter">This Quarter</option>
              <option value="fy">This FY</option>
              <option value="custom">Custom range</option>
            </select>
          </div>
          {period === 'custom' && (
            <>
              <div>
                <label className="block text-xs text-slate-500 mb-1">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  data-testid="reports-from"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  data-testid="reports-to"
                />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Group by</label>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              data-testid="reports-group-by"
            >
              <option value="retailer">Retailer</option>
              <option value="quarter">Quarter</option>
              <option value="month">Month</option>
            </select>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
            data-testid="reports-apply"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Apply
          </button>
          <button
            onClick={exportCsv}
            disabled={!report?.breakdown?.length}
            className="ml-auto px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-1"
            data-testid="reports-export"
          >
            <FileSpreadsheet size={14} /> Export CSV
          </button>
        </div>
        {report && (
          <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
            <Calendar size={12} /> {report.period_label} ·{' '}
            {formatDate(report.from)} → {formatDate(report.to)}
          </p>
        )}
      </section>

      {/* Combined */}
      {report && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat title="Total Sales" value={formatCurrency(report.combined.purchases_total)} />
          <Stat title="GST Collected" value={formatCurrency(report.combined.gst_total)} />
          <Stat title="Orders" value={report.combined.order_count} />
          <Stat title="Active Retailers" value={report.combined.unique_retailer_count} icon={Users} />
        </section>
      )}

      {/* Breakdown */}
      {report && (
        <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3 text-left">{groupBy === 'retailer' ? 'Retailer' : groupBy === 'quarter' ? 'Quarter' : 'Month'}</th>
                {groupBy === 'retailer' && (
                  <th className="px-4 py-3 text-left">Email</th>
                )}
                <th className="px-4 py-3 text-center">Orders</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3 text-right">Total Purchases</th>
              </tr>
            </thead>
            <tbody>
              {report.breakdown.length === 0 ? (
                <tr>
                  <td colSpan={groupBy === 'retailer' ? 5 : 4} className="px-4 py-8 text-center text-slate-400">
                    No data in this period.
                  </td>
                </tr>
              ) : (
                report.breakdown.map((row) => (
                  <tr key={row.key} className="border-t border-slate-100 dark:border-slate-700" data-testid={`report-row-${row.key}`}>
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                      {groupBy === 'retailer' ? (
                        <Link href={`/admin/b2b/retailers/${row.key}`} className="hover:underline">
                          {row.label}
                        </Link>
                      ) : (
                        row.label
                      )}
                    </td>
                    {groupBy === 'retailer' && (
                      <td className="px-4 py-3 text-slate-500 text-xs">{row.email || '—'}</td>
                    )}
                    <td className="px-4 py-3 text-center">{row.order_count}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatCurrency(row.gst_total)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(row.purchases_total)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function Stat({ title, value, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{title}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-white mt-1 flex items-center gap-2">
        {Icon && <Icon size={18} className="text-amber-600" />}
        {value}
      </p>
    </div>
  );
}
