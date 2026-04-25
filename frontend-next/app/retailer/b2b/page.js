'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ArrowLeft, ShoppingCart, Package, Minus, Plus, 
  Percent, CreditCard, FileText, CheckCircle, Loader2,
  Info, History
} from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
import RetailerFirstLoginTour from '../../../components/RetailerFirstLoginTour';
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
  const { fetchWithAuth, retailer: authRetailer } = useRetailerAuth();
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
          credit_note_code: creditNoteCode || null
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
          credit_note_code: creditNoteCode || null
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
          {/* KYC gate banner — shown when admin has enabled the gate AND retailer is not fully verified */}
          {kycGate && kycGate.gate_enabled && !kycGate.fully_kyc_verified && (
            <div
              className="rounded-xl p-4 bg-amber-50 border-2 border-amber-300 flex items-start gap-3"
              data-testid="kyc-gate-banner"
            >
              <Info className="text-amber-700 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">
                  Complete KYC to unlock orders
                </p>
                <p className="text-xs text-amber-800 mt-1">
                  Pending verification:{' '}
                  <b>{kycGate.missing.join(', ')}</b>. Place orders will be
                  blocked at checkout until all three (GST, PAN, Aadhaar) are
                  verified on your account. Reach out to Addrika support to
                  finish KYC.
                </p>
              </div>
            </div>
          )}

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
          {/* Product Table */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
              {/* Table Header */}
              <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-sm font-semibold bg-[#2B3A4A] text-white">
                <div className="col-span-1">Image</div>
                <div className="col-span-3">Product Name</div>
                <div className="col-span-1 text-center">Weight</div>
                <div className="col-span-2 text-center">Price/Box</div>
                <div className="col-span-2 text-center">Price/½ Box</div>
                <div className="col-span-3 text-center">Quantity</div>
              </div>
              {/* Table Body */}
              <div className="divide-y divide-gray-100">
                {catalog.map((product) => (
                  <div 
                    key={product.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
                    data-testid={`product-row-${product.id}`}
                  >
                    {/* Mobile Layout */}
                    <div className="md:hidden flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden relative">
                          {product.image && (
                            <Image src={product.image} alt={product.name} fill className="object-cover" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-[#2B3A4A]">{product.name}</p>
                          <p className="text-xs text-gray-500">{product.units_per_box} units/box • {product.net_weight}</p>
                          <p className="text-sm font-medium text-[#D4AF37]">{formatCurrency(product.price_per_box)}/box</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleQuantityChange(product.id, -1)}
                          disabled={(quantities[product.id] || 0) <= 0}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-12 text-center font-bold">{quantities[product.id] || 0}</span>
                        <button
                          onClick={() => handleQuantityChange(product.id, 1)}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center hover:border-[#D4AF37]"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    {/* Desktop Layout */}
                    <div className="hidden md:contents">
                      <div className="col-span-1">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden relative">
                          {product.image && (
                            <Image src={product.image} alt={product.name} fill className="object-cover" />
                          )}
                        </div>
                      </div>
                      <div className="col-span-3">
                        <p className="font-semibold text-[#2B3A4A]">{product.name}</p>
                        <p className="text-xs text-gray-500">{product.units_per_box} units/box</p>
                        {product.pricing_tiers?.length > 0 && (
                          <p className="text-[11px] text-green-700 mt-1 font-medium" data-testid={`tiers-${product.id}`}>
                            {product.pricing_tiers
                              .filter((t) => t.discount_percent > 0)
                              .map((t) => `${t.min_boxes}+ box: -${t.discount_percent}%`)
                              .join(' • ') || 'Bulk discounts available'}
                          </p>
                        )}
                      </div>
                      <div className="col-span-1 text-center">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#F5F0E8] text-[#2B3A4A]">
                          {product.net_weight}
                        </span>
                      </div>
                      <div className="col-span-2 text-center font-bold text-[#D4AF37]">
                        {formatCurrency(product.price_per_box)}
                      </div>
                      <div className="col-span-2 text-center font-medium text-[#2B3A4A]">
                        {formatCurrency(product.price_per_half_box)}
                      </div>
                      <div className="col-span-3 flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleQuantityChange(product.id, -1)}
                          disabled={(quantities[product.id] || 0) <= 0}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center disabled:opacity-30"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-16 text-center text-lg font-bold text-[#2B3A4A]">
                          {quantities[product.id] || 0}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(product.id, 1)}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center hover:border-[#D4AF37] hover:bg-amber-50"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {orderSummary && (
            <div className="rounded-xl overflow-hidden bg-white border-2 border-[#D4AF37]">
              <div className="px-6 py-4 bg-[#D4AF37] text-white">
                <h3 className="text-lg font-bold">Order Summary</h3>
              </div>
              <div className="p-6">
                {/* Items */}
                <div className="space-y-3 mb-6">
                  {orderSummary.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <span className="font-medium">{item.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({item.net_weight})</span>
                        <span className="text-sm text-gray-500 ml-2">× {item.quantity_boxes} boxes</span>
                      </div>
                      <span className="font-semibold">{formatCurrency(item.line_total)}</span>
                    </div>
                  ))}
                </div>
                {/* Totals */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Subtotal</span>
                    <span className="font-medium">{formatCurrency(orderSummary.subtotal)}</span>
                  </div>
                  {orderSummary.tier_discount_total > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Bulk Tier Savings (applied per line)</span>
                      <span className="font-medium">-{formatCurrency(orderSummary.tier_discount_total)}</span>
                    </div>
                  )}
                  {orderSummary.loyalty_discount > 0 && (
                    <div className="flex justify-between text-amber-700" data-testid="summary-loyalty">
                      <span>
                        Loyalty Bonus ({orderSummary.loyalty_discount_percent}%)
                      </span>
                      <span className="font-medium">
                        -{formatCurrency(orderSummary.loyalty_discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">GST (after discount)</span>
                    <span className="font-medium">{formatCurrency(orderSummary.gst_total)}</span>
                  </div>
                  {orderSummary.voucher_discount > 0 && (
                    <div className="flex justify-between text-amber-600">
                      <span>Voucher ({orderSummary.voucher_code})</span>
                      <span className="font-medium">-{formatCurrency(orderSummary.voucher_discount)}</span>
                    </div>
                  )}
                  {orderSummary.cash_discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Cash Discount ({orderSummary.cash_discount_percent}%)</span>
                      <span className="font-medium">-{formatCurrency(orderSummary.cash_discount)}</span>
                    </div>
                  )}
                  {orderSummary.credit_note_discount > 0 && (
                    <div className="flex justify-between text-blue-600">
                      <span>Credit Note ({orderSummary.credit_note_code})</span>
                      <span className="font-medium">-{formatCurrency(orderSummary.credit_note_discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 mt-3 border-t text-xl font-bold text-[#2B3A4A]">
                    <span>Grand Total</span>
                    <span className="text-[#D4AF37]">{formatCurrency(orderSummary.grand_total)}</span>
                  </div>
                </div>
                {/* Place Order Button */}
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="w-full mt-6 py-4 text-lg font-semibold bg-green-600 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
                  data-testid="place-order-btn"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <CreditCard size={20} />
                      Place Order - {formatCurrency(orderSummary.grand_total)}
                    </>
                  )}
                </button>
                <p className="text-center text-sm mt-3 text-gray-500">
                  Our team will contact you to confirm and arrange delivery
                </p>
              </div>
            </div>
          )}
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
