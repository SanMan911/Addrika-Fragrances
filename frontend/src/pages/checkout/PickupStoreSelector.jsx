/**
 * Enhanced PickupStoreSelector with State → District → Retailer selection
 * Shows "Top Recommended" retailer based on customer's PIN code
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, MapPin, Star, ChevronDown, Store } from 'lucide-react';
import { Label } from '../../components/ui/label';
import { PICKUP_TIME_SLOTS, TOKEN_AMOUNT, TOKEN_PAYMENT_ENABLED } from './utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PickupStoreSelector = ({
  availablePickupStores,
  selectedPickupStore,
  setSelectedPickupStore,
  pickupStoresLoading,
  pickupPaymentOption,
  setPickupPaymentOption,
  selectedTimeSlot,
  setSelectedTimeSlot,
  mrpTotal,
  customerPincode = ''
}) => {
  const balanceAtStore = mrpTotal - TOKEN_AMOUNT;
  
  // State for location-based selection
  const [selectionMode, setSelectionMode] = useState('recommended'); // 'recommended' or 'manual'
  const [statesDistricts, setStatesDistricts] = useState({ states: [], state_districts: {} });
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [filteredRetailers, setFilteredRetailers] = useState([]);
  const [recommendedRetailer, setRecommendedRetailer] = useState(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingRetailers, setLoadingRetailers] = useState(false);
  const [loadingRecommended, setLoadingRecommended] = useState(false);

  // Fetch states and districts on mount
  useEffect(() => {
    fetchStatesDistricts();
  }, []);

  // Fetch recommended retailer when customer pincode is available
  useEffect(() => {
    if (customerPincode && customerPincode.length === 6) {
      fetchRecommendedRetailer(customerPincode);
    }
  }, [customerPincode]);

  // Fetch retailers when state and district change
  useEffect(() => {
    if (selectedState && selectedDistrict) {
      fetchRetailersByLocation(selectedState, selectedDistrict);
    }
  }, [selectedState, selectedDistrict]);

  const fetchStatesDistricts = async () => {
    setLoadingLocation(true);
    try {
      const response = await fetch(`${API_URL}/api/retailers/states-districts`);
      if (response.ok) {
        const data = await response.json();
        setStatesDistricts(data);
      }
    } catch (error) {
      console.error('Failed to fetch states/districts:', error);
    } finally {
      setLoadingLocation(false);
    }
  };

  const fetchRecommendedRetailer = async (pincode) => {
    setLoadingRecommended(true);
    try {
      const response = await fetch(`${API_URL}/api/retailers/recommend?pincode=${pincode}`);
      if (response.ok) {
        const data = await response.json();
        if (data.recommended) {
          setRecommendedRetailer(data.recommended);
          // Auto-select recommended if in recommended mode
          if (selectionMode === 'recommended') {
            setSelectedPickupStore(formatRetailerForSelection(data.recommended));
          }
        }
      }
    } catch (error) {
      console.error('Failed to fetch recommended retailer:', error);
    } finally {
      setLoadingRecommended(false);
    }
  };

  const fetchRetailersByLocation = async (state, district) => {
    setLoadingRetailers(true);
    try {
      const response = await fetch(
        `${API_URL}/api/retailers/by-location?state=${encodeURIComponent(state)}&district=${encodeURIComponent(district)}`
      );
      if (response.ok) {
        const data = await response.json();
        setFilteredRetailers(data.retailers || []);
      }
    } catch (error) {
      console.error('Failed to fetch retailers:', error);
    } finally {
      setLoadingRetailers(false);
    }
  };

  const formatRetailerForSelection = (retailer) => {
    return {
      id: retailer.retailer_id || retailer.id,
      name: retailer.name,
      address: retailer.address,
      city: retailer.city,
      state: retailer.state,
      pincode: retailer.pincode,
      phone: retailer.phone,
      whatsapp: retailer.whatsapp,
      email: retailer.email,
      distance_km: retailer.distance_km
    };
  };

  const handleStateChange = (e) => {
    const state = e.target.value;
    setSelectedState(state);
    setSelectedDistrict('');
    setFilteredRetailers([]);
    setSelectedPickupStore(null);
  };

  const handleDistrictChange = (e) => {
    setSelectedDistrict(e.target.value);
    setSelectedPickupStore(null);
  };

  const handleRetailerSelect = (retailer) => {
    setSelectedPickupStore(formatRetailerForSelection(retailer));
  };

  const handleModeSwitch = (mode) => {
    setSelectionMode(mode);
    if (mode === 'recommended' && recommendedRetailer) {
      setSelectedPickupStore(formatRetailerForSelection(recommendedRetailer));
    } else if (mode === 'manual') {
      setSelectedPickupStore(null);
    }
  };

  const districts = selectedState ? (statesDistricts.districts_by_state?.[selectedState] || statesDistricts.state_districts?.[selectedState] || []) : [];

  return (
    <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
      <Label className="mb-3 block font-semibold text-lg" style={{ color: 'var(--japanese-indigo)' }}>
        <Store className="inline w-5 h-5 mr-2" />
        Select Pickup Store *
      </Label>
      
      {pickupStoresLoading || loadingLocation ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading stores...</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Selection Mode Toggle */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleModeSwitch('recommended')}
              className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                selectionMode === 'recommended'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              data-testid="mode-recommended"
            >
              <Star className={`inline w-4 h-4 mr-1 ${selectionMode === 'recommended' ? 'text-amber-500' : 'text-gray-400'}`} />
              Top Recommended
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('manual')}
              className={`flex-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                selectionMode === 'manual'
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              data-testid="mode-manual"
            >
              <MapPin className={`inline w-4 h-4 mr-1 ${selectionMode === 'manual' ? 'text-amber-500' : 'text-gray-400'}`} />
              Select Manually
            </button>
          </div>

          {/* Recommended Store Section */}
          {selectionMode === 'recommended' && (
            <div className="space-y-3">
              {loadingRecommended ? (
                <div className="flex items-center gap-2 py-4 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Finding nearest store...</span>
                </div>
              ) : recommendedRetailer ? (
                <div
                  className={`p-4 rounded-lg border-2 transition-all ${
                    selectedPickupStore?.id === recommendedRetailer.retailer_id
                      ? 'border-amber-500 bg-white'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-amber-100">
                        <Star className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                          {recommendedRetailer.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {recommendedRetailer.address}
                        </p>
                        <p className="text-sm text-gray-500">
                          {recommendedRetailer.city}, {recommendedRetailer.state} - {recommendedRetailer.pincode}
                        </p>
                        {recommendedRetailer.distance_km && (
                          <p className="text-xs text-blue-600 mt-1 font-medium">
                            {recommendedRetailer.distance_km} km from your location
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">
                      Nearest
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPickupStore(formatRetailerForSelection(recommendedRetailer))}
                    className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedPickupStore?.id === recommendedRetailer.retailer_id
                        ? 'bg-amber-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                    data-testid="select-recommended-store"
                  >
                    {selectedPickupStore?.id === recommendedRetailer.retailer_id ? 'Selected ✓' : 'Select This Store'}
                  </button>
                </div>
              ) : (
                <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                  <p className="text-sm">No recommended store found for your area.</p>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('manual')}
                    className="text-amber-600 text-sm mt-2 underline"
                  >
                    Select manually instead
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Manual Selection Section */}
          {selectionMode === 'manual' && (
            <div className="space-y-4">
              {/* State Dropdown */}
              <div>
                <Label className="text-sm mb-1 block">State</Label>
                <div className="relative">
                  <select
                    value={selectedState}
                    onChange={handleStateChange}
                    className="w-full p-3 pr-10 rounded-lg border border-gray-200 bg-white appearance-none cursor-pointer"
                    style={{ color: 'var(--japanese-indigo)' }}
                    data-testid="select-state"
                  >
                    <option value="">Select State</option>
                    {statesDistricts.states.map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* District Dropdown */}
              {selectedState && (
                <div>
                  <Label className="text-sm mb-1 block">District</Label>
                  <div className="relative">
                    <select
                      value={selectedDistrict}
                      onChange={handleDistrictChange}
                      className="w-full p-3 pr-10 rounded-lg border border-gray-200 bg-white appearance-none cursor-pointer"
                      style={{ color: 'var(--japanese-indigo)' }}
                      data-testid="select-district"
                    >
                      <option value="">Select District</option>
                      {districts.map((district) => (
                        <option key={district} value={district}>{district}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Retailers List */}
              {selectedDistrict && (
                <div>
                  <Label className="text-sm mb-2 block">
                    Available Stores in {selectedDistrict}, {selectedState}
                  </Label>
                  {loadingRetailers ? (
                    <div className="flex items-center gap-2 py-4 justify-center">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Loading stores...</span>
                    </div>
                  ) : filteredRetailers.length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {filteredRetailers.map((retailer) => (
                        <button
                          key={retailer.retailer_id}
                          type="button"
                          onClick={() => handleRetailerSelect(retailer)}
                          className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                            selectedPickupStore?.id === retailer.retailer_id
                              ? 'border-amber-500 bg-white'
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          data-testid={`manual-store-${retailer.retailer_id}`}
                        >
                          <p className="font-semibold text-sm" style={{ color: 'var(--japanese-indigo)' }}>
                            {retailer.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {retailer.address}, {retailer.city}
                          </p>
                          <p className="text-xs text-gray-400">
                            PIN: {retailer.pincode}
                          </p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-lg">
                      <p className="text-sm">No stores available in this area yet.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Fallback: Show original stores if no database retailers */}
          {!loadingLocation && statesDistricts.states.length === 0 && availablePickupStores.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Available pickup locations:</p>
              {availablePickupStores.map((store) => (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => setSelectedPickupStore(store)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    selectedPickupStore?.id === store.id 
                      ? 'border-amber-500 bg-white' 
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  data-testid={`pickup-store-${store.id}`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                        {store.name}
                      </p>
                      <p className="text-sm text-gray-500">
                        {store.address}, {store.city}
                      </p>
                      <p className="text-xs text-gray-400">PIN: {store.pincode}</p>
                    </div>
                    {store.distance_km && (
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                        {store.distance_km} km
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Payment Option for Self-Pickup */}
      {selectedPickupStore && (
        <div className="mt-4 pt-4 border-t">
          <Label className="mb-2 block font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
            Payment Option
          </Label>
          <div className="space-y-2">
            {/* Token Payment Option - HIDDEN when disabled */}
            {TOKEN_PAYMENT_ENABLED && (
              <button
                type="button"
                onClick={() => setPickupPaymentOption('pay_at_store')}
                className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                  pickupPaymentOption === 'pay_at_store' 
                    ? 'border-green-500 bg-green-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                data-testid="payment-option-store"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    pickupPaymentOption === 'pay_at_store' ? 'border-green-500' : 'border-gray-400'
                  }`}>
                    {pickupPaymentOption === 'pay_at_store' && (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-green-700">
                      Pay ₹{TOKEN_AMOUNT} Token Now
                    </p>
                    <p className="text-xs text-gray-600">
                      Pay remaining ₹{balanceAtStore.toFixed(0)} at store pickup
                    </p>
                    <p className="text-xs text-amber-600 mt-1 font-medium">
                      You'll receive an OTP for store verification
                    </p>
                  </div>
                </div>
              </button>
            )}
            
            {/* Pay Full Amount - Fast-Track Option (Always Shown & Selected by Default) */}
            <button
              type="button"
              onClick={() => setPickupPaymentOption('pay_now')}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                pickupPaymentOption === 'pay_now' 
                  ? 'border-amber-500 bg-amber-50 shadow-md' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid="payment-option-now"
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  pickupPaymentOption === 'pay_now' ? 'border-amber-500' : 'border-gray-400'
                }`}>
                  {pickupPaymentOption === 'pay_now' && (
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-amber-700 text-lg">
                      Fast-Track Pickup
                    </p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mt-1">
                    Pay ₹{mrpTotal.toFixed(0)} Now
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Complete payment online • Priority pickup • Show OTP at store
                  </p>
                  <p className="text-xs text-green-600 mt-1 font-medium">
                    ✓ Skip the queue • ✓ Instant order confirmation
                  </p>
                </div>
              </div>
            </button>
          </div>
          
          {/* Pickup Time Slot Selection */}
          <div className="mt-4 pt-4 border-t">
            <Label className="mb-2 block font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
              Preferred Pickup Time *
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {PICKUP_TIME_SLOTS.map((slot) => (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => setSelectedTimeSlot(slot)}
                  className={`p-3 rounded-lg border-2 text-center transition-all ${
                    selectedTimeSlot?.id === slot.id 
                      ? 'border-amber-500 bg-amber-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  data-testid={`time-slot-${slot.id}`}
                >
                  <p className="text-sm font-medium" style={{ color: 'var(--japanese-indigo)' }}>
                    {slot.label}
                  </p>
                </button>
              ))}
            </div>
            {!selectedTimeSlot && (
              <p className="text-xs text-red-500 mt-2">Please select a pickup time slot</p>
            )}
          </div>
          
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              <strong>How it works:</strong> After payment, you'll receive an OTP via email. Show this OTP at the store to pick up your order.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export { PICKUP_TIME_SLOTS, TOKEN_AMOUNT, TOKEN_PAYMENT_ENABLED } from './utils';
export default PickupStoreSelector;
