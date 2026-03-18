/**
 * RetailerB2B - B2B Wholesale Ordering System
 * Allows retailers to place bulk orders at wholesale prices
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, ShoppingCart, Package, Minus, Plus, 
  Percent, CreditCard, FileText, CheckCircle, Loader2,
  Info, History
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';
import { ThumbnailImage } from '../../components/OptimizedImage';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RetailerB2B = () => {
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
  const [cashDiscountPercent, setCashDiscountPercent] = useState(2);
  const [activeTab, setActiveTab] = useState('order'); // 'order' or 'history'
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [paymentInProgress, setPaymentInProgress] = useState(false);

  const { fetchWithAuth } = useRetailerAuth();

  // Fetch B2B catalog
  const fetchCatalog = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/b2b/catalog`);
      if (response.ok) {
        const data = await response.json();
        setCatalog(data.products || []);
        setRetailerInfo({
          gst: data.retailer_gst,
          address: data.retailer_address
        });
        setCashDiscountPercent(data.cash_discount_percent || 2);
      }
    } catch (error) {
      console.error('Failed to fetch catalog:', error);
      toast.error('Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  // Fetch order history
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

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchOrders();
    }
  }, [activeTab, fetchOrders]);

  // Handle quantity change (in 0.5 increments)
  const handleQuantityChange = (productId, delta) => {
    setQuantities(prev => {
      const current = prev[productId] || 0;
      const newVal = Math.max(0, current + delta * 0.5);
      return { ...prev, [productId]: newVal };
    });
    setOrderSummary(null); // Reset summary when quantities change
  };

  // Calculate order total
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
          apply_cash_discount: applyCashDiscount && !voucherCode,  // No cash discount if voucher
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

  // Submit order
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
        
        // If Razorpay order created, initiate payment
        if (data.razorpay_order_id && data.razorpay_key) {
          await initiateRazorpayPayment(data);
        } else {
          toast.success(`Order ${data.order_id} placed successfully!`);
          resetOrderForm();
        }
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

  // Razorpay payment
  const initiateRazorpayPayment = async (orderData) => {
    setPaymentInProgress(true);
    
    const options = {
      key: orderData.razorpay_key,
      amount: orderSummary.grand_total * 100,
      currency: 'INR',
      name: 'Addrika',
      description: `B2B Order: ${orderData.order_id}`,
      order_id: orderData.razorpay_order_id,
      handler: async (response) => {
        try {
          const verifyResponse = await fetchWithAuth(
            `${API_URL}/api/retailer-dashboard/b2b/order/${orderData.order_id}/verify-payment`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature
              })
            }
          );

          if (verifyResponse.ok) {
            toast.success('Payment successful! Order confirmed.');
            resetOrderForm();
          } else {
            toast.error('Payment verification failed');
          }
        } catch (error) {
          toast.error('Payment verification failed');
        } finally {
          setPaymentInProgress(false);
        }
      },
      prefill: {
        email: retailerInfo?.email,
        contact: retailerInfo?.phone
      },
      theme: {
        color: '#1e3a52'
      },
      modal: {
        ondismiss: () => {
          setPaymentInProgress(false);
          toast.info('Payment cancelled. Your order is saved as pending.');
        }
      }
    };

    const razorpay = new window.Razorpay(options);
    razorpay.open();
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

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 px-4 py-4"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/retailer/dashboard" className="p-2 rounded-lg hover:bg-gray-100" data-testid="back-btn">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              B2B Wholesale Orders
            </h1>
          </div>
          {totalItems > 0 && (
            <div 
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
            >
              <ShoppingCart size={16} />
              <span className="font-semibold">{totalItems} boxes</span>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('order')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'order' 
                ? 'bg-white shadow-md' 
                : 'bg-transparent hover:bg-white/50'
            }`}
            style={{ 
              color: activeTab === 'order' ? 'var(--japanese-indigo)' : 'var(--text-subtle)',
              border: activeTab === 'order' ? '2px solid var(--metallic-gold)' : '2px solid transparent'
            }}
            data-testid="tab-order"
          >
            <Package size={18} />
            Place Order
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'history' 
                ? 'bg-white shadow-md' 
                : 'bg-transparent hover:bg-white/50'
            }`}
            style={{ 
              color: activeTab === 'history' ? 'var(--japanese-indigo)' : 'var(--text-subtle)',
              border: activeTab === 'history' ? '2px solid var(--metallic-gold)' : '2px solid transparent'
            }}
            data-testid="tab-history"
          >
            <History size={18} />
            Order History
          </button>
        </div>

        {activeTab === 'order' ? (
          <>
            {/* GST Info Banner */}
            {retailerInfo && (
              <div 
                className="rounded-xl p-4 mb-6 flex items-start gap-3"
                style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
              >
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

            {/* Product Table */}
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl overflow-hidden shadow-sm" style={{ border: '1px solid var(--border)' }}>
                {/* Table Header */}
                <div 
                  className="grid grid-cols-12 gap-2 px-4 py-3 text-sm font-semibold"
                  style={{ backgroundColor: 'var(--japanese-indigo)', color: 'white' }}
                >
                  <div className="col-span-1">Image</div>
                  <div className="col-span-3">Product Name</div>
                  <div className="col-span-1 text-center">Weight</div>
                  <div className="col-span-2 text-center">Price/Box</div>
                  <div className="col-span-2 text-center">Price/½ Box</div>
                  <div className="col-span-3 text-center">Quantity (Boxes)</div>
                </div>

                {/* Table Body */}
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {catalog.map((product) => (
                    <div 
                      key={product.id}
                      className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
                      data-testid={`product-row-${product.id}`}
                    >
                      {/* Image */}
                      <div className="col-span-1">
                        <ThumbnailImage
                          src={product.image}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg overflow-hidden"
                        />
                      </div>

                      {/* Name */}
                      <div className="col-span-3">
                        <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                          {product.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                          {product.units_per_box} units/box
                        </p>
                      </div>

                      {/* Weight */}
                      <div className="col-span-1 text-center">
                        <span 
                          className="px-2 py-1 rounded-full text-xs font-medium"
                          style={{ backgroundColor: 'var(--cream)', color: 'var(--japanese-indigo)' }}
                        >
                          {product.net_weight}
                        </span>
                      </div>

                      {/* Price per Box */}
                      <div className="col-span-2 text-center">
                        <span className="font-bold" style={{ color: 'var(--metallic-gold)' }}>
                          {formatCurrency(product.price_per_box)}
                        </span>
                      </div>

                      {/* Price per Half Box */}
                      <div className="col-span-2 text-center">
                        <span className="font-medium" style={{ color: 'var(--japanese-indigo)' }}>
                          {formatCurrency(product.price_per_half_box)}
                        </span>
                      </div>

                      {/* Quantity Controls */}
                      <div className="col-span-3 flex items-center justify-center gap-3">
                        <button
                          onClick={() => handleQuantityChange(product.id, -1)}
                          disabled={(quantities[product.id] || 0) <= 0}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-30"
                          style={{ borderColor: 'var(--border)' }}
                          data-testid={`qty-decrease-${product.id}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span 
                          className="w-16 text-center text-lg font-bold"
                          style={{ color: 'var(--japanese-indigo)' }}
                        >
                          {quantities[product.id] || 0}
                        </span>
                        <button
                          onClick={() => handleQuantityChange(product.id, 1)}
                          className="w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all hover:border-[var(--metallic-gold)] hover:bg-amber-50"
                          style={{ borderColor: 'var(--border)' }}
                          data-testid={`qty-increase-${product.id}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cash Discount Toggle */}
            <div 
              className={`mt-6 p-4 rounded-xl flex items-center justify-between transition-opacity ${voucherCode ? 'opacity-50' : ''}`}
              style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  <Percent size={20} className="text-white" />
                </div>
                <div>
                  <p className="font-semibold text-green-800">
                    Get {cashDiscountPercent}% Cash Discount
                  </p>
                  <p className="text-sm text-green-600">
                    {voucherCode ? 'Not available when voucher is applied' : 'Pay online and save extra on your order'}
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
                <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:start-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-600 peer-disabled:opacity-50"></div>
              </label>
            </div>

            {/* Voucher Code Input */}
            <div 
              className="mt-4 p-4 rounded-xl"
              style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#F59E0B' }}
                >
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
                    if (e.target.value) {
                      setApplyCashDiscount(false);
                    }
                  }}
                  placeholder="Enter voucher code"
                  className="flex-1 px-4 py-2 rounded-lg border-2 border-amber-300 focus:border-amber-500 focus:outline-none uppercase"
                  data-testid="voucher-code-input"
                />
                {voucherCode && (
                  <button
                    onClick={() => {
                      setVoucherCode('');
                      setOrderSummary(null);
                    }}
                    className="px-4 py-2 bg-amber-200 text-amber-800 rounded-lg hover:bg-amber-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Credit Note Code Input */}
            <div 
              className="mt-4 p-4 rounded-xl"
              style={{ backgroundColor: '#EFF6FF', border: '1px solid #3B82F6' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: '#3B82F6' }}
                >
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
                    onClick={() => {
                      setCreditNoteCode('');
                      setOrderSummary(null);
                    }}
                    className="px-4 py-2 bg-blue-200 text-blue-800 rounded-lg hover:bg-blue-300"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Calculate Button */}
            <div className="mt-6 flex gap-4">
              <Button
                onClick={calculateOrder}
                disabled={totalItems === 0 || calculating}
                className="flex-1 py-6 text-lg"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
                data-testid="calculate-btn"
              >
                {calculating ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Calculating...
                  </>
                ) : (
                  'Calculate Order'
                )}
              </Button>
            </div>

            {/* Order Summary */}
            {orderSummary && (
              <div 
                className="mt-6 rounded-xl overflow-hidden"
                style={{ backgroundColor: 'white', border: '2px solid var(--metallic-gold)' }}
              >
                <div 
                  className="px-6 py-4"
                  style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
                >
                  <h3 className="text-lg font-bold">Order Summary</h3>
                </div>

                <div className="p-6">
                  {/* Items */}
                  <div className="space-y-3 mb-6">
                    {orderSummary.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b" style={{ borderColor: 'var(--border)' }}>
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
                  <div className="space-y-2 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-subtle)' }}>Subtotal</span>
                      <span className="font-medium">{formatCurrency(orderSummary.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span style={{ color: 'var(--text-subtle)' }}>GST (18%)</span>
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
                    {orderSummary.total_discount > 0 && (
                      <div className="flex justify-between text-green-700 font-medium">
                        <span>Total Savings</span>
                        <span>-{formatCurrency(orderSummary.total_discount)}</span>
                      </div>
                    )}
                    <div 
                      className="flex justify-between pt-3 mt-3 border-t text-xl font-bold"
                      style={{ borderColor: 'var(--border)', color: 'var(--japanese-indigo)' }}
                    >
                      <span>Grand Total</span>
                      <span style={{ color: 'var(--metallic-gold)' }}>{formatCurrency(orderSummary.grand_total)}</span>
                    </div>
                  </div>

                  {/* GST Details */}
                  <div 
                    className="mt-6 p-4 rounded-lg"
                    style={{ backgroundColor: 'var(--cream)' }}
                  >
                    <p className="text-sm font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                      Billing Details
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      <strong>GST:</strong> {orderSummary.retailer_gst || 'Not registered'}
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                      <strong>Address:</strong> {orderSummary.retailer_address?.business_name}, {orderSummary.retailer_address?.address}, {orderSummary.retailer_address?.city}, {orderSummary.retailer_address?.state} - {orderSummary.retailer_address?.pincode}
                    </p>
                  </div>

                  {/* Place Order Button */}
                  <Button
                    onClick={submitOrder}
                    disabled={submitting}
                    className="w-full mt-6 py-6 text-lg"
                    style={{ backgroundColor: '#16a34a' }}
                    data-testid="place-order-btn"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={20} />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2" size={20} />
                        Place Order - {formatCurrency(orderSummary.grand_total)}
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm mt-3" style={{ color: 'var(--text-subtle)' }}>
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
              <div className="text-center py-16 bg-white rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <Package className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg font-medium" style={{ color: 'var(--japanese-indigo)' }}>
                  No orders yet
                </p>
                <p className="mt-2" style={{ color: 'var(--text-subtle)' }}>
                  Place your first B2B order to see it here
                </p>
                <Button
                  onClick={() => setActiveTab('order')}
                  className="mt-4"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  Start Ordering
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => (
                  <div 
                    key={order.order_id}
                    className="bg-white rounded-xl p-5"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="font-mono text-sm" style={{ color: 'var(--metallic-gold)' }}>
                          {order.order_id}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                          {formatCurrency(order.grand_total)}
                        </p>
                        <span 
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-1"
                          style={{ 
                            backgroundColor: order.order_status === 'completed' ? '#D1FAE5' : '#FEF3C7',
                            color: order.order_status === 'completed' ? '#059669' : '#D97706'
                          }}
                        >
                          {order.order_status === 'completed' ? <CheckCircle size={12} /> : <Info size={12} />}
                          {order.order_status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      {order.items.length} product(s) • 
                      {order.cash_discount > 0 && ` ${order.cash_discount_percent}% cash discount applied`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RetailerB2B;
