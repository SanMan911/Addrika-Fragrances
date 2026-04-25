'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, RefreshCw, X } from 'lucide-react';
import { authFetch } from '../app/admin/layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Banner that polls the Zoho error log and surfaces unresolved sync
 * failures to the admin. Compact + dismissible per session.
 */
export default function ZohoErrorsBanner() {
  const [errors, setErrors] = useState([]);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/zoho/errors`);
      if (!res.ok) return;
      const json = await res.json();
      setErrors(json.errors || []);
    } catch {
      /* ignored */
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000); // refresh every minute
    return () => clearInterval(id);
  }, [load]);

  const resolve = async (eid) => {
    await authFetch(`${API_URL}/api/admin/zoho/errors/${eid}/resolve`, {
      method: 'POST',
    });
    load();
  };

  const resync = async (orderId) => {
    if (!orderId) return;
    await authFetch(`${API_URL}/api/admin/zoho/resync/${orderId}`, {
      method: 'POST',
    });
    load();
  };

  if (dismissed || errors.length === 0) return null;

  return (
    <div
      data-testid="zoho-errors-banner"
      className="mb-4 rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 rounded-lg bg-red-600 text-white shrink-0">
            <AlertTriangle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-800 dark:text-red-200 truncate">
              Zoho Books sync failed for {errors.length} item{errors.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-red-700/80 dark:text-red-300/80">
              Unresolved sync errors need attention. You can retry or mark resolved.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setExpanded((x) => !x)}
            className="text-xs px-3 py-1.5 rounded-md bg-red-600 text-white hover:bg-red-700"
            data-testid="zoho-errors-toggle"
          >
            {expanded ? 'Hide' : 'View'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 text-red-700 hover:text-red-900 dark:text-red-300"
            aria-label="Dismiss"
            data-testid="zoho-errors-dismiss"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {expanded && (
        <ul className="border-t border-red-200 dark:border-red-800 max-h-64 overflow-auto divide-y divide-red-100 dark:divide-red-900">
          {errors.slice(0, 20).map((e) => (
            <li
              key={e.id}
              className="px-4 py-2 flex items-center justify-between gap-3 text-xs"
              data-testid={`zoho-error-${e.id}`}
            >
              <div className="min-w-0">
                <p className="font-medium text-red-900 dark:text-red-200 truncate">
                  <span className="uppercase">{e.op}</span>
                  {e.order_id && (
                    <>
                      {' · '}
                      <Link
                        className="underline decoration-dotted"
                        href={`/admin/b2b/retailers/${e.retailer_id || ''}`}
                      >
                        {e.order_id}
                      </Link>
                    </>
                  )}
                </p>
                <p className="text-red-700/80 dark:text-red-300/80 truncate">
                  {e.error_message}
                </p>
                <p className="text-red-600/70 dark:text-red-400/70 text-[10px] mt-0.5">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {e.order_id && (
                  <button
                    onClick={() => resync(e.order_id)}
                    className="text-[11px] px-2 py-1 rounded bg-white border border-red-300 text-red-800 hover:bg-red-100 inline-flex items-center gap-1"
                    data-testid={`zoho-error-retry-${e.id}`}
                  >
                    <RefreshCw size={12} /> Retry
                  </button>
                )}
                <button
                  onClick={() => resolve(e.id)}
                  className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 inline-flex items-center gap-1"
                  data-testid={`zoho-error-resolve-${e.id}`}
                >
                  <CheckCircle2 size={12} /> Resolve
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
