/**
 * Custom hook for delivery mode management
 * Handles shipping vs self-pickup logic, store selection, and time slots
 */
import { useState, useEffect } from 'react';
import axios from 'axios';
import { PICKUP_TIME_SLOTS, TOKEN_AMOUNT, TOKEN_PAYMENT_ENABLED } from './utils';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export const useDeliveryMode = (billingPincode) => {
  const [deliveryMode, setDeliveryMode] = useState('shipping');
  const [availablePickupStores, setAvailablePickupStores] = useState([]);
  const [selectedPickupStore, setSelectedPickupStore] = useState(null);
  const [pickupStoresLoading, setPickupStoresLoading] = useState(false);
  // Default to 'pay_now' since token payment is disabled
  const [pickupPaymentOption, setPickupPaymentOption] = useState('pay_now');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);

  // Fetch pickup stores when self-pickup is selected
  useEffect(() => {
    const fetchPickupStores = async () => {
      if (deliveryMode !== 'self_pickup') return;
      
      setPickupStoresLoading(true);
      try {
        const response = await axios.get(`${API_URL}/api/maps/retailers/self-pickup?pincode=${billingPincode || ''}`);
        setAvailablePickupStores(response.data?.retailers || []);
        
        if (response.data?.retailers?.length === 1) {
          setSelectedPickupStore(response.data.retailers[0]);
        }
      } catch (error) {
        console.error('Failed to fetch pickup stores:', error);
        setAvailablePickupStores([
          { id: 'delhi_primary', name: 'M.G. Shoppie', city: 'Dwarka, Delhi', address: '745 Sector 17 Pocket A Phase II', pincode: '110078' },
          { id: 'bhagalpur_mela', name: 'Mela Stores', city: 'Bhagalpur, Bihar', address: 'D.N. Singh Road, Variety Chowk', pincode: '812002' }
        ]);
      }
      setPickupStoresLoading(false);
    };
    
    fetchPickupStores();
  }, [deliveryMode, billingPincode]);

  const isSelfPickup = deliveryMode === 'self_pickup';
  // Token payment disabled - isPayAtStore is always false
  const isPayAtStore = TOKEN_PAYMENT_ENABLED && isSelfPickup && pickupPaymentOption === 'pay_at_store';

  return {
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
    isPayAtStore,
    PICKUP_TIME_SLOTS,
    TOKEN_AMOUNT
  };
};

export default useDeliveryMode;
