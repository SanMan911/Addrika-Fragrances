/**
 * EditOrderAddressModal - Update shipping address after order placement
 */
import React, { useState, useEffect, useCallback } from 'react';
import { X, MapPin, Loader2, AlertCircle, CheckCircle, Truck } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Capitalize first letter of each word (Title Case)
const capitalizeWords = (str) => {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

const EditOrderAddressModal = ({ isOpen, onClose, order, onUpdate }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    pincode: '',
    city: '',
    state: '',
    reason: ''
  });
  const [loading, setLoading] = useState(false);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (order && isOpen) {
      const shipping = order.shipping || {};
      setFormData({
        name: shipping.name || '',
        phone: shipping.phone || '',
        address: shipping.address || '',
        pincode: shipping.pincode || '',
        city: shipping.city || '',
        state: shipping.state || '',
        reason: ''
      });
      setSuccess(false);
      setErrors({});
    }
  }, [order, isOpen]);

  // Fetch city and state from pincode
  const fetchCityStateFromPincode = useCallback(async (pincode) => {
    if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) return;
    
    setPincodeLookupLoading(true);
    try {
      const response = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await response.json();
      
      if (data[0]?.Status === 'Success' && data[0]?.PostOffice?.length > 0) {
        const postOffice = data[0].PostOffice[0];
        const city = capitalizeWords(postOffice.District || postOffice.Name);
        const state = capitalizeWords(postOffice.State);
        setFormData(prev => ({ ...prev, city, state }));
        setErrors(prev => ({ ...prev, city: '', state: '' }));
        toast.success(`Found: ${city}, ${state}`);
      } else {
        toast.error('Invalid pincode. Please check and try again.');
      }
    } catch (error) {
      console.error('Pincode lookup failed:', error);
      toast.error('Could not fetch location. Please try again.');
    } finally {
      setPincodeLookupLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Apply title case for specific fields
    const capitalizeFields = ['name', 'address'];
    let processedValue = value;
    
    if (capitalizeFields.includes(name)) {
      processedValue = capitalizeWords(value);
    }
    
    setFormData(prev => ({ ...prev, [name]: processedValue }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Auto-fetch city/state when pincode is 6 digits
    if (name === 'pincode' && value.length === 6 && /^\d{6}$/.test(value)) {
      fetchCityStateFromPincode(value);
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim() || formData.name.length < 2) {
      newErrors.name = 'Name is required (min 2 characters)';
    }
    if (!formData.phone || !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Valid 10-digit phone required';
    }
    if (!formData.address || formData.address.length < 5) {
      newErrors.address = 'Address is required (min 5 characters)';
    }
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.pincode || !/^\d{6}$/.test(formData.pincode)) {
      newErrors.pincode = 'Valid 6-digit pincode required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const response = await axios.put(
        `${API_URL}/api/orders/${order.order_number || order.orderNumber}/update-address`,
        formData,
        { withCredentials: true }
      );
      
      setSuccess(true);
      toast.success('Address updated successfully!');
      
      if (response.data.retailer_notified) {
        toast.info('The retailer has been notified of the address change');
      }
      
      // Callback to refresh order data
      if (onUpdate) {
        onUpdate(response.data.new_address);
      }
      
      // Close after delay
      setTimeout(() => {
        onClose();
      }, 2000);
      
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to update address';
      toast.error(errorMsg);
      setErrors({ submit: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !order) return null;

  // Check if order can be edited
  const orderStatus = (order.order_status || order.orderStatus || '').toLowerCase();
  const canEdit = !['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rto', 'rto_delivered'].includes(orderStatus);
  const isPickup = order.delivery_mode === 'self-pickup';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X size={20} style={{ color: 'var(--text-subtle)' }} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
          >
            <MapPin size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              Update Shipping Address
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              Order #{order.order_number || order.orderNumber}
            </p>
          </div>
        </div>

        {/* Restriction Messages */}
        {isPickup && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">
                Self-pickup orders cannot have their address changed. Please contact the store directly.
              </p>
            </div>
          </div>
        )}

        {!canEdit && !isPickup && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle size={20} />
              <p className="text-sm font-medium">
                This order is already "{orderStatus}" and cannot be modified.
              </p>
            </div>
          </div>
        )}

        {/* Success State */}
        {success && (
          <div className="text-center py-8">
            <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
            <p className="text-lg font-semibold text-green-600">Address Updated!</p>
            <p className="text-sm text-gray-500 mt-2">
              The retailer has been notified of the change.
            </p>
          </div>
        )}

        {/* Form */}
        {canEdit && !isPickup && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Notice - PIN code cannot be changed */}
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="text-amber-600 mt-0.5" />
                <div>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                    PIN Code, City & State cannot be changed
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Shipping charges and retailer assignment are based on your original delivery location. 
                    Contact support if you need to change the delivery area.
                  </p>
                </div>
              </div>
            </div>

            {/* Notice */}
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="flex items-start gap-2">
                <Truck size={18} className="text-blue-600 mt-0.5" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  The assigned retailer will be notified immediately about this address change.
                </p>
              </div>
            </div>

            {/* Name & Phone */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Recipient Name *</Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
              </div>
              <div>
                <Label>Phone *</Label>
                <Input
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={errors.phone ? 'border-red-500' : ''}
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
              </div>
            </div>

            {/* Address */}
            <div>
              <Label>Full Address *</Label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                className={`w-full px-3 py-2 rounded-md border text-sm resize-none ${
                  errors.address ? 'border-red-500' : ''
                }`}
                style={{ borderColor: errors.address ? undefined : 'var(--border)', minHeight: '80px' }}
              />
              {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
            </div>

            {/* Pincode, City, State - ALL READ-ONLY (cannot change delivery area after order) */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Pincode</Label>
                <Input
                  name="pincode"
                  value={formData.pincode}
                  placeholder="Cannot change"
                  readOnly
                  className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  data-testid="edit-address-pincode"
                />
                <p className="text-xs text-gray-500 mt-1">Locked</p>
              </div>
              <div>
                <Label>City</Label>
                <Input
                  name="city"
                  value={formData.city}
                  placeholder="Cannot change"
                  readOnly
                  className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  data-testid="edit-address-city"
                />
              </div>
              <div>
                <Label>State</Label>
                <Input
                  name="state"
                  value={formData.state}
                  placeholder="Cannot change"
                  readOnly
                  className="bg-gray-100 dark:bg-gray-700 cursor-not-allowed"
                  data-testid="edit-address-state"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label>Reason for change (optional)</Label>
              <Input
                name="reason"
                value={formData.reason}
                onChange={handleChange}
                placeholder="e.g., Typo in address, Changed location"
              />
            </div>

            {/* Error message */}
            {errors.submit && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 text-sm rounded-lg">
                {errors.submit}
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-5 text-white font-semibold"
              style={{ backgroundColor: loading ? '#999' : 'var(--japanese-indigo)' }}
              data-testid="update-order-address-btn"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating Address...
                </span>
              ) : (
                'Update Address & Notify Retailer'
              )}
            </Button>
          </form>
        )}

        {/* Cannot edit - just show close */}
        {(!canEdit || isPickup) && !success && (
          <Button
            onClick={onClose}
            variant="outline"
            className="w-full mt-4"
          >
            Close
          </Button>
        )}
      </div>
    </div>
  );
};

export default EditOrderAddressModal;
