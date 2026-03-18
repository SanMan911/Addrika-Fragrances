/**
 * CheckoutPage - Refactored Checkout Component
 * Uses modular hooks and components from ./checkout/ for clean separation of concerns
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, LogIn } from 'lucide-react';

// Layout components
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';

// Context hooks
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';

// Checkout sub-components
import DeliveryModeSelector from './checkout/DeliveryModeSelector';
import BillingAddressForm from './checkout/BillingAddressForm';
import ShippingAddressForm from './checkout/ShippingAddressForm';
import PickupStoreSelector from './checkout/PickupStoreSelector';
import DiscountCodeSection from './checkout/DiscountCodeSection';
import B2BSection from './checkout/B2BSection';
import OrderSummaryPanel from './checkout/OrderSummaryPanel';
import CoinRedemptionSection from '../components/CoinRedemptionSection';

// Custom hooks
import { useCheckoutForm } from './checkout/useCheckoutForm';
import { useDeliveryMode } from './checkout/useDeliveryMode';
import { useDiscountCode } from './checkout/useDiscountCode';
import { useOrderPricing } from './checkout/useOrderPricing';
import { useRazorpayPayment } from './checkout/useRazorpayPayment';
import { calculateDynamicShipping } from './checkout/utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cart, isCartLoaded, getCartTotal, clearCart, markCartConverted } = useCart();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  
  // Dynamic shipping state
  const [dynamicShippingCharge, setDynamicShippingCharge] = useState(null);
  const [shippingLoading, setShippingLoading] = useState(false);
  
  // Coin redemption state
  const [coinRedemption, setCoinRedemption] = useState(null);

  // Initialize custom hooks
  const {
    billingData,
    shippingData,
    errors,
    shippingErrors,
    pincodeLookupLoading,
    shippingPincodeLookupLoading,
    savedDetails,
    usingSavedDetails,
    useDifferentShipping,
    setUseDifferentShipping,
    isB2B,
    setIsB2B,
    gstNumber,
    setGstNumber,
    businessName,
    setBusinessName,
    gstError,
    hasBillingFromUser,
    handleBillingChange,
    handleShippingChange,
    handleUseSavedDetails,
    validateForm,
    setAddressFromSaved,
    setShippingFromSaved
  } = useCheckoutForm(user, isAuthenticated);

  const {
    deliveryMode,
    setDeliveryMode,
    availablePickupStores,
    selectedPickupStore,
    setSelectedPickupStore,
    pickupStoresLoading,
    pickupPaymentOption,
    setPickupPaymentOption,
    selectedTimeSlot,
    setSelectedTimeSlot,
    isSelfPickup,
    isPayAtStore
  } = useDeliveryMode(billingData.pincode);

  const {
    discountCode,
    setDiscountCode,
    appliedDiscount,
    discountLoading,
    discountHints,
    handleApplyDiscount,
    handleRemoveDiscount
  } = useDiscountCode(cart, getCartTotal, deliveryMode);

  // Calculate package weight for shipping
  const calculatePackageWeight = useCallback(() => {
    let weight = 0;
    cart.forEach(item => {
      const size = item.size || '50g';
      const qty = item.quantity || 1;
      if (size === '50g') {
        weight += 0.08 * qty; // 80g with packaging
      } else if (size === '200g') {
        weight += 0.35 * qty; // 350g with packaging
      } else {
        weight += 0.15 * qty; // Default
      }
    });
    return Math.max(weight, 0.25); // Minimum 250g
  }, [cart]);

  // Fetch dynamic shipping rates when pincode or cart changes
  useEffect(() => {
    const fetchDynamicShipping = async () => {
      // Skip for self-pickup
      if (deliveryMode === 'self_pickup') {
        setDynamicShippingCharge(null);
        return;
      }

      // Determine which pincode to use (shipping if different, else billing)
      const deliveryPincode = useDifferentShipping ? shippingData.pincode : billingData.pincode;
      
      if (!deliveryPincode || deliveryPincode.length !== 6) {
        setDynamicShippingCharge(null);
        return;
      }

      const weight = calculatePackageWeight();
      
      // Calculate MRP total and apply discount for shipping calculation
      const mrpTotal = cart.reduce((total, item) => {
        return total + ((item.mrp || item.price) * item.quantity);
      }, 0);
      
      // Calculate post-discount subtotal for shipping tier check
      const discountAmount = appliedDiscount?.discountAmount || 0;
      const subtotalAfterDiscount = Math.max(0, mrpTotal - discountAmount);

      // Free shipping if post-discount subtotal >= 999
      if (subtotalAfterDiscount >= 999) {
        setDynamicShippingCharge(0);
        return;
      }

      setShippingLoading(true);
      try {
        const result = await calculateDynamicShipping(deliveryPincode, weight, subtotalAfterDiscount);
        if (result.success || result.isFallback) {
          setDynamicShippingCharge(result.charge);
        }
      } catch (error) {
        console.error('Dynamic shipping fetch failed:', error);
        // Keep existing or use null for fallback
      } finally {
        setShippingLoading(false);
      }
    };

    // Debounce the API call
    const timeoutId = setTimeout(fetchDynamicShipping, 500);
    return () => clearTimeout(timeoutId);
  }, [billingData.pincode, shippingData.pincode, useDifferentShipping, deliveryMode, cart, calculatePackageWeight, appliedDiscount]);

  const pricing = useOrderPricing(
    cart,
    getCartTotal,
    deliveryMode,
    pickupPaymentOption,
    appliedDiscount,
    dynamicShippingCharge,
    coinRedemption
  );

  const { loading, processPayment } = useRazorpayPayment(
    cart,
    billingData,
    shippingData,
    useDifferentShipping,
    deliveryMode,
    selectedPickupStore,
    pickupPaymentOption,
    selectedTimeSlot,
    appliedDiscount,
    isB2B,
    gstNumber,
    businessName,
    clearCart,
    markCartConverted,
    user,
    coinRedemption
  );

  // Handle place order
  const handlePlaceOrder = () => {
    processPayment(validateForm);
  };

  // Loading state
  if (!isCartLoaded || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto" style={{ borderColor: 'var(--metallic-gold)' }} />
          <p className="mt-4" style={{ color: 'var(--text-dark)' }}>Loading checkout...</p>
        </div>
      </div>
    );
  }

  // Empty cart state
  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <Header />
        <main className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <ShoppingBag size={64} className="mx-auto mb-4 opacity-50" style={{ color: 'var(--metallic-gold)' }} />
            <h1 className="text-2xl font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              Your cart is empty
            </h1>
            <p className="mb-8" style={{ color: 'var(--text-subtle)' }}>
              Add some beautiful fragrances to your cart to proceed with checkout.
            </p>
            <Button
              onClick={() => navigate('/')}
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
              className="text-white"
            >
              Browse Fragrances
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 mb-6 hover:opacity-80 transition-opacity"
          style={{ color: 'var(--japanese-indigo)' }}
        >
          <ArrowLeft size={20} />
          <span>Continue Shopping</span>
        </Link>

        {/* Page Title */}
        <h1 
          className="text-3xl font-bold mb-8"
          style={{ color: 'var(--japanese-indigo)', fontFamily: "'Exo', sans-serif" }}
        >
          Checkout
        </h1>

        {/* Guest Login Prompt */}
        {!isAuthenticated && (
          <div 
            className="mb-6 p-4 rounded-lg flex items-center justify-between"
            style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3">
              <LogIn size={24} style={{ color: 'var(--metallic-gold)' }} />
              <div>
                <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                  Already have an account?
                </p>
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  Login for faster checkout and order tracking
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/login', { state: { from: '/checkout' } })}
              variant="outline"
              style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
            >
              Login
            </Button>
          </div>
        )}

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Mode Selector */}
            <DeliveryModeSelector
              deliveryMode={deliveryMode}
              setDeliveryMode={setDeliveryMode}
            />

            {/* Self-Pickup Store Selector */}
            {isSelfPickup && (
              <div 
                className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
                style={{ border: '1px solid var(--border)' }}
              >
                <PickupStoreSelector
                  availablePickupStores={availablePickupStores}
                  selectedPickupStore={selectedPickupStore}
                  setSelectedPickupStore={setSelectedPickupStore}
                  pickupStoresLoading={pickupStoresLoading}
                  pickupPaymentOption={pickupPaymentOption}
                  setPickupPaymentOption={setPickupPaymentOption}
                  selectedTimeSlot={selectedTimeSlot}
                  setSelectedTimeSlot={setSelectedTimeSlot}
                  mrpTotal={pricing.mrpTotal}
                  customerPincode={billingData.pincode || user?.pincode || ''}
                />
              </div>
            )}

            {/* Billing Address Form */}
            <BillingAddressForm
              billingData={billingData}
              handleBillingChange={handleBillingChange}
              errors={errors}
              pincodeLookupLoading={pincodeLookupLoading}
              hasBillingFromUser={hasBillingFromUser}
              usingSavedDetails={usingSavedDetails}
              savedDetails={savedDetails}
              handleUseSavedDetails={handleUseSavedDetails}
              deliveryMode={deliveryMode}
              onSelectSavedAddress={setAddressFromSaved}
              isAuthenticated={isAuthenticated}
            />

            {/* Shipping Address Form - Only for shipping mode */}
            {!isSelfPickup && (
              <ShippingAddressForm
                shippingData={shippingData}
                handleShippingChange={handleShippingChange}
                shippingErrors={shippingErrors}
                shippingPincodeLookupLoading={shippingPincodeLookupLoading}
                useDifferentShipping={useDifferentShipping}
                setUseDifferentShipping={setUseDifferentShipping}
              />
            )}

            {/* Discount Code Section - Only for shipping mode */}
            <DiscountCodeSection
              discountCode={discountCode}
              setDiscountCode={setDiscountCode}
              appliedDiscount={appliedDiscount}
              discountLoading={discountLoading}
              discountHints={discountHints}
              handleApplyDiscount={handleApplyDiscount}
              handleRemoveDiscount={handleRemoveDiscount}
              deliveryMode={deliveryMode}
            />

            {/* Coin Redemption Section - Only for shipping mode and authenticated users */}
            {!isSelfPickup && (
              <CoinRedemptionSection
                cartValue={getCartTotal()}
                onRedemptionChange={setCoinRedemption}
                isAuthenticated={isAuthenticated}
                disabled={loading}
              />
            )}

            {/* B2B Section */}
            <B2BSection
              isB2B={isB2B}
              setIsB2B={setIsB2B}
              gstNumber={gstNumber}
              setGstNumber={setGstNumber}
              businessName={businessName}
              setBusinessName={setBusinessName}
              gstError={gstError}
              showB2BOption={!isSelfPickup}
            />
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <OrderSummaryPanel
              cart={cart}
              pricing={pricing}
              deliveryMode={deliveryMode}
              appliedDiscount={appliedDiscount}
              selectedPickupStore={selectedPickupStore}
              selectedTimeSlot={selectedTimeSlot}
              pickupPaymentOption={pickupPaymentOption}
              loading={loading}
              handlePlaceOrder={handlePlaceOrder}
              isSelfPickup={isSelfPickup}
              isPayAtStore={isPayAtStore}
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CheckoutPage;
