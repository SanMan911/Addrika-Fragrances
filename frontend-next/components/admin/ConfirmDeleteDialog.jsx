'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

/**
 * Permanent-delete gate: the admin must retype `confirmValue` exactly.
 * `onConfirm` receives the typed value and should throw to keep the dialog open.
 */
export default function ConfirmDeleteDialog({
  open,
  title,
  description,
  confirmValue,
  confirmLabel = 'Delete permanently',
  onConfirm,
  onClose,
  testId = 'confirm-delete',
}) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const matches = typed.trim().toLowerCase() === String(confirmValue || '').trim().toLowerCase();

  const close = () => {
    if (busy) return;
    setTyped('');
    onClose();
  };

  const run = async () => {
    if (!matches || busy) return;
    setBusy(true);
    try {
      await onConfirm(typed.trim());
      setTyped('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm"
      data-testid={`${testId}-overlay`}
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white">{title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{description}</p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
            data-testid={`${testId}-close`}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Type <span className="font-mono font-bold text-red-600 dark:text-red-400">{confirmValue}</span> to confirm
          </label>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder={confirmValue}
            className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            data-testid={`${testId}-input`}
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={close}
              disabled={busy}
              className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50"
              data-testid={`${testId}-cancel`}
            >
              Cancel
            </button>
            <button
              onClick={run}
              disabled={!matches || busy}
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              data-testid={`${testId}-submit`}
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
