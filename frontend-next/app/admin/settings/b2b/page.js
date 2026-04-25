'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase, Save, Plus, Trash2, RefreshCw, Power } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminB2BSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [cashDiscount, setCashDiscount] = useState(1.5);
  const [kycRequired, setKycRequired] = useState(false);
  const [grandfathering, setGrandfathering] = useState(false);
  const [products, setProducts] = useState([]);
  const [savingTiersFor, setSavingTiersFor] = useState(null);

  const grandfatherKYC = async () => {
    if (
      !confirm(
        'Mark every existing retailer as KYC-verified (GST + PAN + Aadhaar)?\n\n' +
          'Use this once before flipping the KYC gate ON, so legacy retailers ' +
          'are not blocked at checkout. Idempotent — safe to re-run.'
      )
    ) {
      return;
    }
    setGrandfathering(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/retailers/bulk-grandfather-kyc`,
        { method: 'POST' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Migration failed');
      toast.success(
        `Grandfathered ${data.modified} retailer${data.modified === 1 ? '' : 's'}` +
          (data.matched !== data.modified
            ? ` (${data.matched - data.modified} already verified)`
            : '')
      );
    } catch (e) {
      toast.error(e.message || 'Migration failed');
    } finally {
      setGrandfathering(false);
    }
  };

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b-settings`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
      setCashDiscount(Number(data.cash_discount_percent) || 1.5);
      setKycRequired(Boolean(data.kyc_required_for_orders));
      setProducts(
        (data.products || []).map((p) => ({
          ...p,
          pricing_tiers: p.pricing_tiers || [],
        }))
      );
    } catch (e) {
      toast.error('Failed to load B2B settings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveCore = async (next) => {
    setSaving(true);
    try {
      const payload = {
        enabled: next.enabled ?? enabled,
        cash_discount_percent: next.cashDiscount ?? cashDiscount,
        kyc_required_for_orders:
          next.kycRequired !== undefined ? next.kycRequired : kycRequired,
      };
      const res = await authFetch(`${API_URL}/api/admin/b2b-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Save failed');
      }
      const data = await res.json();
      setEnabled(Boolean(data.enabled));
      setCashDiscount(Number(data.cash_discount_percent));
      setKycRequired(Boolean(data.kyc_required_for_orders));
      toast.success('B2B settings saved');
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const togglePortal = async () => {
    await saveCore({ enabled: !enabled });
  };

  const updateTier = (productId, idx, key, value) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const tiers = [...p.pricing_tiers];
        tiers[idx] = { ...tiers[idx], [key]: value };
        return { ...p, pricing_tiers: tiers };
      })
    );
  };

  const addTier = (productId) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? {
              ...p,
              pricing_tiers: [
                ...p.pricing_tiers,
                { min_boxes: 1, discount_percent: 0 },
              ],
            }
          : p
      )
    );
  };

  const removeTier = (productId, idx) => {
    setProducts((prev) =>
      prev.map((p) =>
        p.id === productId
          ? { ...p, pricing_tiers: p.pricing_tiers.filter((_, i) => i !== idx) }
          : p
      )
    );
  };

  const saveTiers = async (product) => {
    setSavingTiersFor(product.id);
    try {
      const tiers = product.pricing_tiers.map((t) => ({
        min_boxes: Number(t.min_boxes),
        discount_percent: Number(t.discount_percent),
      }));
      const res = await authFetch(
        `${API_URL}/api/admin/b2b-settings/pricing-tiers/${product.id}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tiers }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Save failed');
      }
      toast.success(`Tiers saved for ${product.name} (${product.net_weight})`);
    } catch (e) {
      toast.error(e.message || 'Failed to save tiers');
    } finally {
      setSavingTiersFor(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-b2b-settings-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/settings"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            data-testid="back-to-settings"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Briefcase size={22} /> B2B Portal Settings
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Toggle the retailer portal, edit online-payment discount, and
              configure quantity-tiered wholesale pricing.
            </p>
          </div>
        </div>
        <Link
          href="/admin/settings/b2b/loyalty"
          className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 hover:bg-amber-100 text-sm font-medium flex items-center gap-2"
          data-testid="link-loyalty-settings"
        >
          Loyalty Milestones →
        </Link>
      </div>

      {/* Kill-switch */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Power
                size={18}
                className={enabled ? 'text-green-600' : 'text-slate-400'}
              />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                B2B Retailer Portal
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  enabled
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
                data-testid="b2b-enabled-status"
              >
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              When disabled, retailer login and the entire B2B catalog/ordering
              API return 403. Public users cannot access any part of the B2B
              portal. Turn on only when you are ready to onboard GST-verified
              retailers.
            </p>
          </div>
          <button
            onClick={togglePortal}
            disabled={saving}
            className={`px-5 py-2.5 rounded-lg font-medium text-white min-w-[140px] ${
              enabled
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-green-600 hover:bg-green-700'
            } disabled:opacity-50`}
            data-testid="toggle-b2b-portal"
          >
            {enabled ? 'Disable Portal' : 'Enable Portal'}
          </button>
        </div>
      </section>

      {/* KYC Gate */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6" data-testid="kyc-gate-section">
        <div className="flex items-start justify-between gap-6 flex-col md:flex-row">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Power
                size={18}
                className={kycRequired ? 'text-emerald-600' : 'text-slate-400'}
              />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                KYC Gate · GST + PAN + Aadhaar
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  kycRequired
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}
                data-testid="kyc-gate-status"
              >
                {kycRequired ? 'On — orders gated' : 'Off — anyone can order'}
              </span>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
              When ON, retailers cannot place a B2B order until all three
              verifications are complete on their record (<b>gst_verified</b>,
              <b> pan_verified</b>, <b>aadhaar_verified</b>). Existing retailers
              who have not been KYC&apos;d will be blocked at checkout — make sure
              you onboard them via the KYC widget before flipping this on.
            </p>
          </div>
          <button
            onClick={() => saveCore({ kycRequired: !kycRequired })}
            disabled={saving}
            className={`px-5 py-2.5 rounded-lg font-medium text-white min-w-[160px] ${
              kycRequired
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            } disabled:opacity-50`}
            data-testid="toggle-kyc-gate"
          >
            {kycRequired ? 'Disable KYC Gate' : 'Enable KYC Gate'}
          </button>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            <b>Grandfather existing retailers</b> · One-click sets every
            current retailer&apos;s GST + PAN + Aadhaar as verified. Run this
            <i> before</i> enabling the gate so legacy retailers aren&apos;t
            blocked. Idempotent.
          </p>
          <button
            onClick={grandfatherKYC}
            disabled={grandfathering}
            className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white inline-flex items-center gap-2"
            data-testid="grandfather-kyc-button"
          >
            {grandfathering ? 'Grandfathering…' : 'Grandfather all retailers'}
          </button>
        </div>
      </section>

      {/* Cash Discount */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
          Pay-Now Online Discount
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-xl">
          Additional discount a retailer gets when they choose to pay online at
          checkout. Applied on subtotal before GST. Mutually exclusive with
          retailer vouchers.
        </p>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Discount percent
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="20"
                value={cashDiscount}
                onChange={(e) => setCashDiscount(e.target.value)}
                className="w-28 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                data-testid="cash-discount-input"
              />
              <span className="text-slate-500">%</span>
            </div>
          </div>
          <button
            onClick={() => saveCore({ cashDiscount: Number(cashDiscount) })}
            disabled={saving}
            className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center gap-2"
            data-testid="save-cash-discount"
          >
            <Save size={16} /> Save
          </button>
        </div>
      </section>

      {/* Quantity-Tiered Pricing per product */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
          Quantity-Tier Wholesale Pricing
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 max-w-2xl">
          Optional: add quantity tiers per product. Discount is applied to the
          line total at checkout. For a given quantity of boxes, the tier with
          the highest <strong>min boxes</strong> less-or-equal to the quantity
          wins. No tiers = no quantity discount.
        </p>

        <div className="space-y-4">
          {products.map((product) => (
            <div
              key={product.id}
              className="border border-slate-200 dark:border-slate-700 rounded-lg p-4"
              data-testid={`tier-block-${product.id}`}
            >
              <div className="flex items-center justify-between mb-3 gap-3">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {product.name}{' '}
                    <span className="text-slate-500 font-normal">
                      ({product.net_weight})
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    ₹{product.price_per_box}/box · {product.units_per_box}{' '}
                    units per box
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => addTier(product.id)}
                    className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 flex items-center gap-1"
                    data-testid={`add-tier-${product.id}`}
                  >
                    <Plus size={14} /> Add tier
                  </button>
                  <button
                    onClick={() => saveTiers(product)}
                    disabled={savingTiersFor === product.id}
                    className="px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-50 flex items-center gap-1"
                    data-testid={`save-tier-${product.id}`}
                  >
                    <Save size={14} /> Save tiers
                  </button>
                </div>
              </div>

              {product.pricing_tiers.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No tiers — retailers pay the configured box price.
                </p>
              ) : (
                <div className="space-y-2">
                  {product.pricing_tiers.map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-3"
                      data-testid={`tier-row-${product.id}-${idx}`}
                    >
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-500">
                          Min boxes
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          value={tier.min_boxes}
                          onChange={(e) =>
                            updateTier(
                              product.id,
                              idx,
                              'min_boxes',
                              e.target.value
                            )
                          }
                          className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-500">
                          Discount %
                        </label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={tier.discount_percent}
                          onChange={(e) =>
                            updateTier(
                              product.id,
                              idx,
                              'discount_percent',
                              e.target.value
                            )
                          }
                          className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => removeTier(product.id, idx)}
                        className="ml-auto p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        data-testid={`remove-tier-${product.id}-${idx}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
