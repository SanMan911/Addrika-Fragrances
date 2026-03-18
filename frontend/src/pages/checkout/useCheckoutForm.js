/**
 * Custom hook for checkout form state management
 * Handles billing/shipping address, validation, and pincode lookups
 */
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Capitalize first letter of each word
const capitalizeWords = (str) => {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

export const useCheckoutForm = (user, isAuthenticated) => {
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const [shippingPincodeLookupLoading, setShippingPincodeLookupLoading] = useState(false);
  const [savedDetails, setSavedDetails] = useState(null);
  const [usingSavedDetails, setUsingSavedDetails] = useState(false);
  const [useDifferentShipping, setUseDifferentShipping] = useState(false);
  
  // B2B / GST state
  const [isB2B, setIsB2B] = useState(false);
  const [gstNumber, setGstNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstError, setGstError] = useState('');
  
  // Check if billing data is from registered user
  const hasBillingFromUser = isAuthenticated && user && user.address && user.city && user.state && user.pincode;
  
  // Billing address
  const [billingData, setBillingData] = useState({
    salutation: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  
  // Shipping address
  const [shippingData, setShippingData] = useState({
    salutation: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: ''
  });
  
  const [errors, setErrors] = useState({});
  const [shippingErrors, setShippingErrors] = useState({});

  // Fetch saved details
  useEffect(() => {
    const fetchSavedDetails = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await axios.get(`${API_URL}/api/user/saved-details`, {
          withCredentials: true
        });
        if (response.data?.saved_details) {
          setSavedDetails(response.data.saved_details);
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error('Failed to fetch saved details:', error);
        }
      }
    };
    fetchSavedDetails();
  }, [isAuthenticated]);

  // Pre-fill billing from user profile
  useEffect(() => {
    if (user) {
      setBillingData(prev => ({
        ...prev,
        salutation: user.salutation || prev.salutation,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone?.replace(/^\+\d+\s*/, '') || prev.phone,
        address: user.address || prev.address,
        city: user.city || prev.city,
        state: user.state || prev.state,
        pincode: user.pincode || prev.pincode
      }));
    }
  }, [user]);

  // Use saved details
  const handleUseSavedDetails = useCallback(() => {
    if (savedDetails) {
      setBillingData(savedDetails);
      setUsingSavedDetails(true);
      toast.success('Previous billing details loaded!');
    }
  }, [savedDetails]);

  // Fetch city and state from pincode
  const fetchCityStateFromPincode = async (pincode, isShipping = false) => {
    const setLoading = isShipping ? setShippingPincodeLookupLoading : setPincodeLookupLoading;
    const setData = isShipping ? setShippingData : setBillingData;
    const setErr = isShipping ? setShippingErrors : setErrors;
    
    setLoading(true);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        const city = capitalizeWords(postOffice.District || postOffice.Name);
        const state = capitalizeWords(postOffice.State);
        setData(prev => ({ ...prev, city, state }));
        setErr(prev => ({ ...prev, city: '', state: '' }));
        toast.success(`Found: ${city}, ${state}`);
        return { city, state };
      } else {
        toast.error('Invalid pincode. Please enter city and state manually.');
        return null;
      }
    } catch (error) {
      console.error('Pincode lookup failed:', error);
      toast.error('Could not fetch location. Please enter city and state manually.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Handle billing change
  const handleBillingChange = useCallback((e) => {
    const { name, value } = e.target;
    const capitalizeFields = ['name', 'city', 'address', 'landmark'];
    const processedValue = capitalizeFields.includes(name) ? capitalizeWords(value) : value;
    
    setBillingData(prev => ({ ...prev, [name]: processedValue }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (name === 'pincode' && value.length === 6 && /^\d{6}$/.test(value)) {
      fetchCityStateFromPincode(value, false);
    }
  }, [errors]);

  // Handle shipping change
  const handleShippingChange = useCallback((e) => {
    const { name, value } = e.target;
    const capitalizeFields = ['name', 'city', 'address', 'landmark'];
    const processedValue = capitalizeFields.includes(name) ? capitalizeWords(value) : value;
    
    setShippingData(prev => ({ ...prev, [name]: processedValue }));
    if (shippingErrors[name]) {
      setShippingErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (name === 'pincode' && value.length === 6 && /^\d{6}$/.test(value)) {
      fetchCityStateFromPincode(value, true);
    }
  }, [shippingErrors]);

  // Validate GST Number
  const validateGSTNumber = useCallback((gst) => {
    if (!gst) return true;
    const gstPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstPattern.test(gst.toUpperCase());
  }, []);

  // Validate form
  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!billingData.name.trim()) newErrors.name = 'Name is required';
    if (!billingData.email.trim()) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(billingData.email)) newErrors.email = 'Invalid email format';
    if (!billingData.phone.trim()) newErrors.phone = 'Phone is required';
    else if (!/^\d{10}$/.test(billingData.phone.replace(/\D/g, ''))) newErrors.phone = 'Invalid phone (10 digits required)';
    if (!billingData.address.trim()) newErrors.address = 'Address is required';
    if (!billingData.city.trim()) newErrors.city = 'City is required';
    if (!billingData.state.trim()) newErrors.state = 'State is required';
    if (!billingData.pincode.trim()) newErrors.pincode = 'Pincode is required';
    else if (!/^\d{6}$/.test(billingData.pincode)) newErrors.pincode = 'Invalid pincode (6 digits required)';
    
    setErrors(newErrors);
    
    const newShippingErrors = {};
    if (useDifferentShipping) {
      if (!shippingData.name.trim()) newShippingErrors.name = 'Name is required';
      if (!shippingData.phone.trim()) newShippingErrors.phone = 'Phone is required';
      else if (!/^\d{10}$/.test(shippingData.phone.replace(/\D/g, ''))) newShippingErrors.phone = 'Invalid phone (10 digits required)';
      if (!shippingData.address.trim()) newShippingErrors.address = 'Address is required';
      if (!shippingData.city.trim()) newShippingErrors.city = 'City is required';
      if (!shippingData.state.trim()) newShippingErrors.state = 'State is required';
      if (!shippingData.pincode.trim()) newShippingErrors.pincode = 'Pincode is required';
      else if (!/^\d{6}$/.test(shippingData.pincode)) newShippingErrors.pincode = 'Invalid pincode (6 digits required)';
    }
    setShippingErrors(newShippingErrors);
    
    if (isB2B && gstNumber && !validateGSTNumber(gstNumber)) {
      setGstError('Invalid GST number format (e.g., 22AAAAA0000A1Z5)');
      return false;
    }
    setGstError('');
    
    return Object.keys(newErrors).length === 0 && Object.keys(newShippingErrors).length === 0;
  }, [billingData, shippingData, useDifferentShipping, isB2B, gstNumber, validateGSTNumber]);

  // Set billing data from saved address
  const setAddressFromSaved = useCallback((savedAddress) => {
    if (!savedAddress) return;
    
    const fullAddress = savedAddress.address_line2 
      ? `${savedAddress.address_line1}, ${savedAddress.address_line2}`
      : savedAddress.address_line1 || savedAddress.address;
    
    setBillingData(prev => ({
      ...prev,
      name: savedAddress.name || prev.name,
      phone: savedAddress.phone || prev.phone,
      address: fullAddress || prev.address,
      city: savedAddress.city || prev.city,
      state: savedAddress.state || prev.state,
      pincode: savedAddress.pincode || prev.pincode
    }));
    
    toast.success(`Address "${savedAddress.nickname || 'Saved'}" applied`);
  }, []);

  // Set shipping data from saved address
  const setShippingFromSaved = useCallback((savedAddress) => {
    if (!savedAddress) return;
    
    const fullAddress = savedAddress.address_line2 
      ? `${savedAddress.address_line1}, ${savedAddress.address_line2}`
      : savedAddress.address_line1 || savedAddress.address;
    
    setShippingData(prev => ({
      ...prev,
      name: savedAddress.name || prev.name,
      phone: savedAddress.phone || prev.phone,
      address: fullAddress || prev.address,
      city: savedAddress.city || prev.city,
      state: savedAddress.state || prev.state,
      pincode: savedAddress.pincode || prev.pincode
    }));
    
    toast.success(`Shipping address "${savedAddress.nickname || 'Saved'}" applied`);
  }, []);

  return {
    billingData,
    setBillingData,
    shippingData,
    setShippingData,
    errors,
    shippingErrors,
    pincodeLookupLoading,
    shippingPincodeLookupLoading,
    savedDetails,
    usingSavedDetails,
    setUsingSavedDetails,
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
    fetchCityStateFromPincode,
    setAddressFromSaved,
    setShippingFromSaved
  };
};

export default useCheckoutForm;
