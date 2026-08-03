'use client';

import { useEffect, useState, useCallback } from 'react';
import { Truck, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { titleCase } from '../lib/formHelpers';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const inr = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 0,
}).format(Number(n) || 0);

/**
 * B2B cart shipping input.
 * Retailer enters a 6-digit pincode → City + State auto-fill (read-only),
 * then we call `/api/retailer-dashboard/b2b/shipping-quote` for the
 * distance-based courier rate. `onQuote({shipping_charges, delivery_pincode})`
 * bubbles up to the parent so it can include it in the order calculation.
 */
export default function PincodeShippingInput({
  fetchWithAuth,
  items,
  onQuote,
  defaultPincode = '',
}) {
  const [pincode, setPincode] = useState(defaultPincode);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [quote, setQuote] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');

  const runLookupAndQuote = useCallback(async (pc) => {
    setError('');
    setLookingUp(true);
    try {
      // 1) Pincode → city + state (public endpoint)
      const pRes = await fetch(`${API_URL}/api/shipping/check-pincode?pincode=${pc}`);
      if (pRes.ok) {
        const pdata = await pRes.json();
        setCity(titleCase(pdata.city || ''));
        setState(titleCase(pdata.state || ''));
        if (!pdata.state) {
          setError('Unrecognised pincode. Please check and re-enter.');
        }
      } else {
        setError('Could not verify pincode.');
      }
    } catch {
      setError('Pincode lookup failed.');
    }
    setLookingUp(false);

    // 2) Shipping quote (needs items)
    if (!items || items.length === 0) return;
    setQuoting(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/shipping-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery_pincode: pc, items }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuote(data);
        onQuote?.({ delivery_pincode: pc, ...data });
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.detail || 'Shipping quote failed');
        setQuote(null);
        onQuote?.(null);
      }
    } catch {
      setError('Shipping quote failed');
    }
    setQuoting(false);
  }, [items, fetchWithAuth, onQuote]);

  useEffect(() => {
    if (pincode.length === 6 && /^\d{6}$/.test(pincode)) {
      runLookupAndQuote(pincode);
    } else {
      setCity(''); setState(''); setQuote(null);
      onQuote?.(null);
    }
    // Re-run when pincode length reaches 6 OR the item count changes.
  }, [pincode, items.length]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 space-y-3"
      data-testid="pincode-shipping-input">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
        <Truck size={16} className="text-indigo-600" /> Delivery Address
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            Pincode <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="e.g. 110089"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            data-testid="pincode-input"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            City (auto)
          </label>
          <input
            type="text"
            value={city}
            readOnly
            placeholder="—"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-not-allowed"
            data-testid="city-readonly"
          />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
            State (auto)
          </label>
          <input
            type="text"
            value={state}
            readOnly
            placeholder="—"
            className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 cursor-not-allowed"
            data-testid="state-readonly"
          />
        </div>
      </div>

      {error && (
        <div className="text-xs text-rose-600 dark:text-rose-400" data-testid="pincode-error">{error}</div>
      )}

      {(lookingUp || quoting) && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Loader2 size={12} className="animate-spin" /> {quoting ? 'Fetching shipping quote…' : 'Verifying pincode…'}
        </div>
      )}

      {quote && !quoting && (
        <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/40 rounded-lg p-3 text-sm"
          data-testid="shipping-quote-display">
          <div className="flex items-center justify-between">
            <span className="text-slate-700 dark:text-slate-300">
              <MapPin size={14} className="inline mr-1 text-indigo-600" />
              {quote.courier_name || 'Courier'} · ETD {quote.etd || '5-7 days'}
              {quote.fallback && <span className="ml-2 text-[10px] text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300 px-1.5 py-0.5 rounded">Fallback</span>}
            </span>
            <span className="font-bold text-slate-800 dark:text-white" data-testid="shipping-charges-value">
              {inr(quote.shipping_charges)}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cart weight ~ {quote.weight_kg} kg (with packaging overhead)
          </div>
        </div>
      )}
    </div>
  );
}
