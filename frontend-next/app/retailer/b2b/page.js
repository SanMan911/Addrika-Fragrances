'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, ShoppingCart, Package,
  Percent, CreditCard, FileText, CheckCircle, Loader2,
  Info, History, ChevronUp, ChevronDown
} from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
import RetailerFirstLoginTour from '../../../components/RetailerFirstLoginTour';
import RewardsBalanceCard from '../../../components/RewardsBalanceCard';
import RewardsRedeemToggle from '../../../components/RewardsRedeemToggle';
import PincodeShippingInput from '../../../components/PincodeShippingInput';
import B2BKycGate from '../../../components/b2b/B2BKycGate';
import B2BCatalogueTable from '../../../components/b2b/B2BCatalogueTable';
import B2BOrderSummary from '../../../components/b2b/B2BOrderSummary';
import { getTierPerks } from '../../../lib/tierPerks';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};

export default function RetailerB2BPage() {
  const [catalog, setCatalog] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [applyCashDiscount, setApplyCashDiscount] = useState(false);
  const [voucherCode, setVoucherCode] = useState('');
  const [creditNoteCode, setCreditNoteCode] = useState('');
  const [orderSummary, setOrderSummary] = useState(null);
  const [retailerInfo, setRetailerInfo] = useState(null);
  const [cashDiscountPercent, setCashDiscountPercent] = useState(1.5);
  const [loyalty, setLoyalty] = useState(null);
  const [activeTab, setActiveTab] = useState('order');
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [kycGate, setKycGate] = useState(null); // { gate_enabled, fully_kyc_verified, missing, can_order, retailer_id }
  const [showKycCard, setShowKycCard] = useState(false);
  const [shippingQuote, setShippingQuote] = useState(null); // { shipping_charges, delivery_pincode, courier_name, etd, ... }
  const [redeemAmount, setRedeemAmount] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const { fetchWithAuth, retailer: authRetailer } = useRetailerAuth();

  // If the URL contains #kyc (deep link from the recovery email), auto-expand
  // the KYC self-service section on mount.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#kyc') {
      setShowKycCard(true);
      setTimeout(() => {
        const el = document.getElementById('kyc-self-service');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400);
    }
  }, []);
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      // Run catalog fetch and KYC-gate fetch in parallel
      const [response, kycRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/catalog`),
        fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/kyc-gate`).catch(() => null),
      ]);
      if (kycRes && kycRes.ok) {
        const k = await kycRes.json();
        setKycGate(k);
      }
      if (response.ok) {
        const data = await response.json();
        setCatalog(data.products || []);
        setRetailerInfo({
          gst: data.retailer_gst,
          address: data.retailer_address
        });
        setCashDiscountPercent(data.cash_discount_percent || 1.5);
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
      toast.error('Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [fetchWithAuth]);
  const fetchLoyalty = useCallback(async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/loyalty`);
      if (response.ok) setLoyalty(await response.json());
    } catch {
      /* non-fatal */
    }
  }, [fetchWithAuth]);
  useEffect(() => {
    fetchCatalog();
    fetchLoyalty();
  }, [fetchCatalog, fetchLoyalty]);
  useEffect(() => {
    if (activeTab === 'history') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  // Mobile → Web cart hydration. When the Aaroviah shell deep-links to
  // /retailer/b2b?cart=<b64>&from=mobile, decode the payload and pre-fill
  // the quantities map with only SKUs that exist in the retailer's current
  // catalogue (so retired SKUs don't ghost-populate). Runs once, ONLY
  // after `catalog` is loaded, and strips the `cart`/`from` params from
  // the URL so a refresh doesn't replay the import.
  const cartHydratedRef = useRef(false);
  useEffect(() => {
    if (cartHydratedRef.current) return;
    if (!catalog || catalog.length === 0) return;
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const cartParam = params.get('cart');
    const from = params.get('from');
    if (!cartParam || (from !== 'mobile' && from !== 'mobile-share')) return;

    cartHydratedRef.current = true;

    let payload;
    try {
      // URLSearchParams.get() already decodes once; the mobile side
      // encodes exactly once. A second decode here would corrupt
      // payloads containing literal '%'.
      payload = JSON.parse(cartParam);
    } catch {
      toast.error('Could not read the cart from your phone — please re-add items.');
      return;
    }
    if (!Array.isArray(payload)) return;

    const validIds = new Set(catalog.map((p) => p.id));
    const next = {};
    let dropped = 0;
    for (const line of payload) {
      const id = line?.productId || line?.product_id;
      const qty = Number(line?.quantity_boxes ?? line?.quantity ?? 0);
      if (!id || qty <= 0) continue;
      if (!validIds.has(id)) { dropped += 1; continue; }
      next[id] = qty;
    }

    // Strip cart+from from URL — handoff is already stripped by
    // RetailerAuthContext. Preserves other params (e.g. #kyc hash) so the
    // KYC deep-link still works even alongside a cart hand-off.
    params.delete('cart');
    params.delete('from');
    const nextSearch = params.toString();
    try {
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}${nextSearch ? '?' + nextSearch : ''}${window.location.hash}`,
      );
    } catch { /* non-fatal */ }

    if (Object.keys(next).length > 0) {
      setQuantities(next);
      // Give the UI a beat to render before toasting so the user sees
      // both the numbers and the confirmation at the same time.
      setTimeout(() => {
        const label = from === 'mobile-share' ? 'shared with you' : 'from your phone';
        toast.success(
          `Cart ${label} — ${Object.keys(next).length} SKU${Object.keys(next).length === 1 ? '' : 's'} loaded${dropped > 0 ? ` (${dropped} unavailable)` : ''}`,
        );
      }, 60);
    } else if (dropped > 0) {
      toast.info(`Cart from mobile had ${dropped} SKU${dropped === 1 ? '' : 's'} that aren't in your current catalogue.`);
    }
  }, [catalog]);

  const handleQuantityChange = (productId, delta) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newVal = Math.max(0, current + delta * 0.5);
      return { ...prev, [productId]: newVal };
    });
    setOrderSummary(null);
  };
  const calculateOrder = async () => {
    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        product_id: productId,
        quantity_boxes: qty
      }));
    if (items.length === 0) {
      toast.error('Please add at least one item to your order');
      return;
    }
    setCalculating(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          apply_cash_discount: applyCashDiscount && !voucherCode,
          voucher_code: voucherCode || null,
          credit_note_code: creditNoteCode || null,
          delivery_pincode: shippingQuote?.delivery_pincode || null,
          include_shipping: !!shippingQuote?.delivery_pincode,
          redeem_rewards_inr: redeemAmount || null,
        })
      });
      if (response.ok) {
        const data = await response.json();
        setOrderSummary(data);
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Calculation failed');
      }
    } catch (error) {
      toast.error('Failed to calculate order');
    } finally {
      setCalculating(false);
    }
  };
  const submitOrder = async () => {
    const items = Object.entries(quantities)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        product_id: productId,
        quantity_boxes: qty
      }));
    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          apply_cash_discount: applyCashDiscount && !voucherCode,
          voucher_code: voucherCode || null,
          credit_note_code: creditNoteCode || null,
          delivery_pincode: shippingQuote?.delivery_pincode || null,
          include_shipping: !!shippingQuote?.delivery_pincode,
          redeem_rewards_inr: redeemAmount || null,
        })
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Order ${data.order_id} placed successfully!`);
        resetOrderForm();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to place order');
      }
    } catch (error) {
      toast.error('Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };
  const resetOrderForm = () => {
    setQuantities({});
    setOrderSummary(null);
    setVoucherCode('');
    setCreditNoteCode('');
    setApplyCashDiscount(false);
    setActiveTab('history');
    fetchOrders();
  };
  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-6">
      {/* First-login tour (auto-skips if already completed) */}
      <RetailerFirstLoginTour retailer={authRetailer} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">B2B Wholesale Orders</h1>
          <p className="text-gray-500 mt-1">Place bulk orders at wholesale prices</p>
        </div>
        {totalItems > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#D4AF37] text-white">
            <ShoppingCart size={18} />
            <span className="font-semibold">{totalItems} boxes</span>
          </div>
        )}
      </div>

      {/* Compact Patron Progress — same source as the /rewards page card,
          so retailers see their next milestone every time they shop. */}
      <CompactPatronProgress fetchWithAuth={fetchWithAuth} />
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('order')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'order' 
              ? 'bg-white shadow-md border-2 border-[#D4AF37] text-[#2B3A4A]' 
              : 'bg-transparent hover:bg-white/50 text-gray-500'
          }`}
          data-testid="tab-order"
        >
          <Package size={18} />
          Place Order
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'history' 
              ? 'bg-white shadow-md border-2 border-[#D4AF37] text-[#2B3A4A]' 
              : 'bg-transparent hover:bg-white/50 text-gray-500'
          }`}
          data-testid="tab-history"
        >
          <History size={18} />
          Order History
        </button>
      </div>
      {activeTab === 'order' ? (
        <>
          {/* Fragrance Rewards Balance snapshot — always visible above the fold */}
          <RewardsBalanceCard fetchWithAuth={fetchWithAuth} />

          {/* KYC gate nudge — sticky on scroll with per-step progress chips */}
          <B2BKycGate
            kycGate={kycGate}
            showKycCard={showKycCard}
            onToggle={() => setShowKycCard(!showKycCard)}
            onComplete={fetchCatalog}
          />

          {/* GST Info Banner */}
          {retailerInfo && (
            <div className="rounded-xl p-4 bg-blue-50 border border-blue-200 flex items-start gap-3">
              <FileText className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-sm font-medium text-blue-800">
                  GST: {retailerInfo.gst || 'Not registered'}
                </p>
                <p className="text-xs text-blue-600 mt-1">
                  {retailerInfo.address?.business_name}, {retailerInfo.address?.city}, {retailerInfo.address?.state} - {retailerInfo.address?.pincode}
                </p>
              </div>
            </div>
          )}
          {/* Loyalty Progress Bar */}
          {loyalty && loyalty.milestones && loyalty.milestones.length > 0 && (
            <div
              className="rounded-xl p-4 bg-gradient-to-r from-amber-50 to-white border border-amber-200"
              data-testid="loyalty-bar"
            >
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold text-[#2B3A4A]">
                    Loyalty Bonus · {loyalty.quarter_label}
                  </p>
                  <p className="text-xs text-gray-500">
                    Purchases this quarter:{' '}
                    <strong>{formatCurrency(loyalty.purchases_total || 0)}</strong>
                  </p>
                </div>
                <div className="text-right">
                  {loyalty.applied_milestone ? (
                    <span className="inline-block px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold" data-testid="loyalty-applied">
                      Active: +{loyalty.applied_milestone.discount_percent}% off
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">No bonus yet</span>
                  )}
                </div>
              </div>
              <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                {loyalty.milestones.map((m) => {
                  const top = loyalty.milestones[loyalty.milestones.length - 1].min_purchase || 1;
                  const pct = Math.min(100, (m.min_purchase / top) * 100);
                  return (
                    <div
                      key={m.id}
                      className="absolute top-0 bottom-0 w-[2px] bg-amber-700/70"
                      style={{ left: `${pct}%` }}
                      title={`₹${m.min_purchase.toLocaleString()} → ${m.discount_percent}%`}
                    />
                  );
                })}
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600"
                  style={{ width: `${loyalty.progress_percent || 0}%` }}
                />
              </div>
              <div className="flex justify-between mt-2 text-[11px] text-gray-500">
                {loyalty.milestones.map((m) => (
                  <span key={m.id} title={m.label}>
                    {formatCurrency(m.min_purchase)} · {m.discount_percent}%
                  </span>
                ))}
              </div>
              {loyalty.next_milestone && (
                <p className="text-xs text-amber-700 mt-2" data-testid="loyalty-next">
                  Purchase{' '}
                  <strong>{formatCurrency(loyalty.gap_to_next)}</strong> more
                  this quarter to unlock{' '}
                  <strong>+{loyalty.next_milestone.discount_percent}%</strong>{' '}
                  bonus.
                </p>
              )}
            </div>
          )}
          {/* Category Filter Chips */}
          {!loading && catalog.length > 0 && (() => {
            const CATEGORY_META = [
              { key: 'all', label: 'All' },
              { key: 'agarbatti', label: 'Agarbatti' },
              { key: 'agarbatti_jar', label: 'Agarbatti Jars' },
              { key: 'bakhoor', label: 'Bakhoor' },
              { key: 'dhoop', label: 'Dhoop' },
            ];
            const counts = catalog.reduce((acc, p) => {
              const k = p.category || 'other';
              acc[k] = (acc[k] || 0) + 1;
              return acc;
            }, {});
            return (
              <div className="flex flex-wrap gap-2 mb-2" data-testid="b2b-category-chips">
                {CATEGORY_META.map((c) => {
                  const count = c.key === 'all' ? catalog.length : (counts[c.key] || 0);
                  if (c.key !== 'all' && count === 0) return null;
                  const active = categoryFilter === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setCategoryFilter(c.key)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all border ${
                        active
                          ? 'bg-[#2B3A4A] text-white border-[#2B3A4A] shadow-md'
                          : 'bg-white text-[#2B3A4A] border-gray-200 hover:border-[#D4AF37] hover:text-[#D4AF37]'
                      }`}
                      data-testid={`category-chip-${c.key}`}
                    >
                      {c.label}
                      <span className={`ml-2 text-xs ${active ? 'text-white/70' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {/* Product Table */}
          <B2BCatalogueTable
            catalog={catalog}
            quantities={quantities}
            categoryFilter={categoryFilter}
            loading={loading}
            onQuantityChange={handleQuantityChange}
          />
          {/* Distance-based shipping quote (Shiprocket-powered) */}
          <PincodeShippingInput
            fetchWithAuth={fetchWithAuth}
            items={Object.entries(quantities)
              .filter(([, q]) => q > 0)
              .map(([product_id, quantity_boxes]) => ({ product_id, quantity_boxes }))}
            onQuote={setShippingQuote}
          />
          {/* Fragrance Rewards redemption toggle */}
          {(() => {
            const currentSubtotal = orderSummary?.subtotal
              || Object.entries(quantities).reduce((s, [pid, q]) => {
                const p = catalog.find((x) => x.id === pid);
                return s + (p ? (p.price_per_box || 0) * (q || 0) : 0);
              }, 0);
            return (
              <RewardsRedeemToggle
                subtotal={currentSubtotal}
                onAmountChange={setRedeemAmount}
                fetchWithAuth={fetchWithAuth}
              />
            );
          })()}
          {/* Cash Discount Toggle */}
          <div className={`p-4 rounded-xl bg-green-50 border border-green-200 flex items-center justify-between ${voucherCode ? 'opacity-50' : ''}`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-green-600">
                <Percent size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-green-800">Pay Now & Save additional {cashDiscountPercent}%</p>
                <p className="text-sm text-green-600">
                  {voucherCode ? 'Not available when voucher is applied' : 'Auto-applied at payment — saved instantly at checkout'}
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={applyCashDiscount}
                onChange={(e) => {
                  setApplyCashDiscount(e.target.checked);
                  setOrderSummary(null);
                }}
                disabled={!!voucherCode}
                className="sr-only peer"
                data-testid="cash-discount-toggle"
              />
              <div className="w-14 h-7 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
            </label>
          </div>
          {/* Voucher Code Input */}
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-amber-500">
                <FileText size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-amber-800">Have a Voucher Code?</p>
                <p className="text-sm text-amber-600">
                  {applyCashDiscount ? 'Voucher will disable cash discount' : 'Enter your retailer voucher code'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={voucherCode}
                onChange={(e) => {
                  setVoucherCode(e.target.value.toUpperCase());
                  setOrderSummary(null);
                  if (e.target.value) setApplyCashDiscount(false);
                }}
                placeholder="Enter voucher code"
                className="flex-1 px-4 py-2 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none uppercase"
                data-testid="voucher-code-input"
              />
              {voucherCode && (
                <button
                  onClick={() => { setVoucherCode(''); setOrderSummary(null); }}
                  className="px-4 py-2 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {/* Credit Note Input */}
          <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500">
                <CreditCard size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-blue-800">Have a Credit Note?</p>
                <p className="text-sm text-blue-600">Enter your credit note code to redeem</p>
              </div>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={creditNoteCode}
                onChange={(e) => {
                  setCreditNoteCode(e.target.value.toUpperCase());
                  setOrderSummary(null);
                }}
                placeholder="Enter credit note code (CN-XXXXXXXX)"
                className="flex-1 px-4 py-2 rounded-lg border-2 border-blue-300 focus:border-blue-500 focus:outline-none uppercase"
                data-testid="credit-note-input"
              />
              {creditNoteCode && (
                <button
                  onClick={() => { setCreditNoteCode(''); setOrderSummary(null); }}
                  className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          {/* Calculate Button */}
          <button
            onClick={calculateOrder}
            disabled={totalItems === 0 || calculating}
            className="w-full py-4 text-lg font-semibold bg-[#2B3A4A] text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
            data-testid="calculate-btn"
          >
            {calculating ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Calculating...
              </>
            ) : (
              'Calculate Order'
            )}
          </button>
          {/* Order Summary */}
          <B2BOrderSummary
            orderSummary={orderSummary}
            submitting={submitting}
            onPlaceOrder={submitOrder}
          />
        </>
      ) : (
        /* Order History Tab */
        <div>
          {ordersLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-white rounded-xl animate-pulse" />
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border">
              <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium text-[#2B3A4A]">No orders yet</p>
              <p className="mt-2 text-gray-500">Place your first B2B order to see it here</p>
              <button
                onClick={() => setActiveTab('order')}
                className="mt-4 px-6 py-2 bg-[#2B3A4A] text-white rounded-lg"
              >
                Start Ordering
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div 
                  key={order.order_id}
                  className="bg-white rounded-xl p-5 border"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="font-mono text-sm text-[#D4AF37]">{order.order_id}</p>
                      <p className="text-sm mt-1 text-gray-500">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-[#2B3A4A]">{formatCurrency(order.grand_total)}</p>
                      <span 
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                          order.order_status === 'completed' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {order.order_status === 'completed' ? <CheckCircle size={12} /> : <Info size={12} />}
                        {order.order_status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center justify-between gap-3">
                    <span>
                      {order.items.length} product(s) 
                      {order.cash_discount > 0 && ` • ${order.cash_discount_percent}% cash discount applied`}
                    </span>
                    <button
                      onClick={async () => {
                        try {
                          const res = await fetchWithAuth(
                            `${API_URL}/api/retailer-dashboard/b2b/orders/${order.order_id}/invoice.pdf`
                          );
                          if (!res.ok) return toast.error('Invoice download failed');
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `invoice-${order.order_id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        } catch {
                          toast.error('Invoice download failed');
                        }
                      }}
                      className="shrink-0 px-3 py-1 text-xs font-medium rounded-md bg-[#D4AF37]/10 text-[#2B3A4A] hover:bg-[#D4AF37]/20 border border-[#D4AF37]/40"
                      data-testid={`retailer-invoice-pdf-${order.order_id}`}
                    >
                      Download Invoice PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


const STAT_UNIT_LABEL = {
  lifetime_orders: (n) => `${n} more order${n === 1 ? '' : 's'}`,
  lifetime_gmv_inr: (n) => `₹${Number(n).toLocaleString('en-IN')} more`,
  monthly_order_streak: (n) => `${n} more month${n === 1 ? '' : 's'} in a row`,
  active_months: (n) => `${n} more active month${n === 1 ? '' : 's'}`,
};

function CompactPatronProgress({ fetchWithAuth }) {
  const [next, setNext] = useState(null);
  const [current, setCurrent] = useState(null);
  const [tier, setTier] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/patron`);
        if (!res.ok) return;
        const data = await res.json();
        setNext(data.next_milestone || null);
        setCurrent(data.current_patron_tag || null);
        setTier(data.tier || null);
      } catch { /* silent */ }
    })();
  }, [fetchWithAuth]);

  if (!next && !current) return null;

  const remaining = next ? Math.ceil(Number(next.remaining || 0)) : 0;
  const pct = next ? Math.min(100, Math.max(0, Number(next.progress_pct || 0))) : 100;
  const label = next && STAT_UNIT_LABEL[next.stat]
    ? STAT_UNIT_LABEL[next.stat](remaining)
    : (next ? `${remaining} more` : '');

  const tierRing = tier
    ? ({ gold: 'ring-2 ring-amber-400', silver: 'ring-2 ring-slate-400', bronze: 'ring-2 ring-orange-400', novice: '' }[tier.id] || '')
    : '';
  const tierMedal = tier
    ? ({ gold: '🥇', silver: '🥈', bronze: '🥉', novice: '' }[tier.id] || '')
    : '';

  return (
    <div
      className={`rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-3 sm:p-4 ${tierRing}`}
      data-testid="catalog-patron-progress"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap text-sm">
        <div className="flex items-center gap-2 flex-wrap">
          {current && (
            <span className="text-[#2B3A4A] font-semibold flex items-center gap-1" data-testid="catalog-current-tag">
              {tierMedal && <span data-testid="catalog-tier-medal">{tierMedal}</span>}
              {current}
            </span>
          )}
          {tier && tier.id !== 'novice' && (
            <TierPerksChip tier={tier} />
          )}
          {next && (
            <span className="text-slate-600 text-xs sm:text-sm">
              Next: <b className="text-[#2B3A4A]">{next.name}</b>
              <span className="text-slate-400"> · {label} to go</span>
            </span>
          )}
        </div>
        <a
          href="/retailer/b2b/rewards"
          className="text-xs text-[#D4AF37] hover:underline font-semibold whitespace-nowrap"
          data-testid="catalog-patron-link"
        >
          See journey →
        </a>
      </div>
      {tier?.next_tier && tier.next_tier.tags_to_go > 0 && (
        <div className="mt-1 text-[10px] text-amber-700 font-semibold" data-testid="catalog-tier-hint">
          {tier.next_tier.tags_to_go} more tag{tier.next_tier.tags_to_go === 1 ? '' : 's'} to reach {tier.next_tier.label}
        </div>
      )}
      {next && (
        <div className="mt-2 h-1.5 w-full bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-700"
            style={{ width: `${pct}%` }}
            data-testid="catalog-patron-progress-bar"
          />
        </div>
      )}
    </div>
  );
}



// Compact tier pill on the catalog header — hover / tap reveals the
// list of perks unlocked at the retailer's current tier. Reads from
// `/api/app/config → retailer_tier_perks` via a shared module cache.
function TierPerksChip({ tier }) {
  const [perksMap, setPerksMap] = useState(null);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getTierPerks().then((m) => { if (!cancelled) setPerksMap(m); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [open]);

  if (!tier) return null;
  const perks = perksMap?.[tier.id]?.perks || [];
  const medal = perksMap?.[tier.id]?.medal || '';
  const pillCls =
    tier.id === 'gold' ? 'bg-amber-400 text-amber-950'
    : tier.id === 'silver' ? 'bg-slate-300 text-slate-900'
    : 'bg-orange-400 text-orange-950';

  return (
    <span
      ref={wrapRef}
      className="relative inline-block"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider cursor-help focus:outline-none focus:ring-2 focus:ring-amber-300 ${pillCls}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid={`catalog-tier-${tier.id}`}
      >
        {tier.label}
      </button>
      {open && (
        <div
          role="dialog"
          data-testid={`catalog-tier-perks-${tier.id}`}
          className="absolute z-40 top-full left-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-xl p-4 text-left"
        >
          <div className="flex items-center gap-2 mb-2">
            {medal && <span className="text-xl">{medal}</span>}
            <div>
              <div className="text-sm font-bold text-slate-800">{tier.label} Tier Perks</div>
              <div className="text-[11px] text-slate-500">
                {tier.achievements_count || 0} patron tag{(tier.achievements_count || 0) === 1 ? '' : 's'} earned
              </div>
            </div>
          </div>
          {perks.length > 0 ? (
            <ul className="space-y-1.5" data-testid={`catalog-tier-perks-list-${tier.id}`}>
              {perks.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="text-emerald-500 mt-0.5">✓</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Loading perks…</p>
          )}
          {tier.next_tier && tier.next_tier.tags_to_go > 0 && (
            <p className="mt-3 pt-2 border-t border-slate-100 text-[11px] text-amber-700 font-semibold">
              Earn {tier.next_tier.tags_to_go} more tag{tier.next_tier.tags_to_go === 1 ? '' : 's'} to unlock {tier.next_tier.label}.
            </p>
          )}
        </div>
      )}
    </span>
  );
}
