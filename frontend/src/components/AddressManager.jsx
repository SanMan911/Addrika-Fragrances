/**
 * AddressManager - Manage saved addresses with add, edit, delete functionality
 */
import React, { useState, useEffect, useCallback } from 'react';
import { 
  MapPin, Plus, Edit2, Trash2, Star, Loader2, X, Home, Building, 
  Check, AlertTriangle 
} from 'lucide-react';
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

// Nickname suggestions with icons
const NICKNAME_SUGGESTIONS = [
  { name: 'Home', icon: Home },
  { name: 'Office', icon: Building },
  { name: 'Parents', icon: Home },
  { name: 'Other', icon: MapPin }
];

const AddressManager = ({ isOpen, onClose, onAddressSelect, selectMode = false }) => {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    nickname: '',
    name: '',
    phone: '',
    address_line1: '',
    address_line2: '',
    pincode: '',
    city: '',
    state: '',
    is_default: false
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen) {
      fetchAddresses();
    }
  }, [isOpen]);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/user/addresses`, { withCredentials: true });
      setAddresses(response.data.addresses || []);
    } catch (error) {
      toast.error('Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      nickname: '',
      name: '',
      phone: '',
      address_line1: '',
      address_line2: '',
      pincode: '',
      city: '',
      state: '',
      is_default: false
    });
    setErrors({});
    setEditingAddress(null);
  };

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
        toast.error('Invalid pincode. Please enter city and state manually.');
        setFormData(prev => ({ ...prev, city: '', state: '' }));
      }
    } catch (error) {
      console.error('Pincode lookup failed:', error);
      toast.error('Could not fetch location. Please enter manually.');
    } finally {
      setPincodeLookupLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Apply title case for specific fields
    const capitalizeFields = ['name', 'address_line1', 'address_line2', 'nickname'];
    let processedValue = value;
    
    if (type === 'checkbox') {
      processedValue = checked;
    } else if (capitalizeFields.includes(name)) {
      processedValue = capitalizeWords(value);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: processedValue
    }));
    
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
    if (!formData.nickname.trim()) newErrors.nickname = 'Nickname is required';
    if (!formData.name.trim() || formData.name.length < 2) newErrors.name = 'Name is required (min 2 chars)';
    if (!formData.phone || !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = 'Valid 10-digit phone required';
    }
    if (!formData.address_line1 || formData.address_line1.length < 5) {
      newErrors.address_line1 = 'Address is required (min 5 chars)';
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

    setFormLoading(true);
    try {
      if (editingAddress) {
        await axios.put(
          `${API_URL}/api/user/addresses/${editingAddress.address_id}`,
          formData,
          { withCredentials: true }
        );
        toast.success('Address updated successfully');
      } else {
        await axios.post(
          `${API_URL}/api/user/addresses`,
          formData,
          { withCredentials: true }
        );
        toast.success('Address saved successfully');
      }
      
      fetchAddresses();
      setShowForm(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save address');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = (address) => {
    setFormData({
      nickname: address.nickname,
      name: address.name,
      phone: address.phone,
      address_line1: address.address_line1,
      address_line2: address.address_line2 || '',
      pincode: address.pincode,
      city: address.city,
      state: address.state,
      is_default: address.is_default
    });
    setEditingAddress(address);
    setShowForm(true);
  };

  const handleDelete = async (addressId) => {
    try {
      await axios.delete(`${API_URL}/api/user/addresses/${addressId}`, { withCredentials: true });
      toast.success('Address deleted');
      setDeleteConfirm(null);
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      await axios.put(
        `${API_URL}/api/user/addresses/${addressId}/set-default`,
        {},
        { withCredentials: true }
      );
      toast.success('Default address updated');
      fetchAddresses();
    } catch (error) {
      toast.error('Failed to set default');
    }
  };

  const handleSelect = (address) => {
    if (onAddressSelect) {
      onAddressSelect({
        name: address.name,
        phone: address.phone,
        address: address.address_line1 + (address.address_line2 ? ', ' + address.address_line2 : ''),
        city: address.city,
        state: address.state,
        pincode: address.pincode
      });
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal */}
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <MapPin size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                {selectMode ? 'Select Address' : 'Manage Addresses'}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                {selectMode ? 'Choose a saved address' : 'Add, edit or remove your saved addresses'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} style={{ color: 'var(--text-subtle)' }} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'var(--metallic-gold)' }} />
            </div>
          ) : showForm ? (
            /* Address Form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                  {editingAddress ? 'Edit Address' : 'Add New Address'}
                </h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowForm(false); resetForm(); }}
                >
                  Cancel
                </Button>
              </div>

              {/* Nickname */}
              <div>
                <Label>Address Nickname *</Label>
                <div className="flex gap-2 mt-1 mb-2">
                  {NICKNAME_SUGGESTIONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, nickname: name }))}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all ${
                        formData.nickname === name 
                          ? 'bg-amber-100 text-amber-700 border-amber-300' 
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                      style={{ border: '1px solid' }}
                    >
                      <Icon size={14} />
                      {name}
                    </button>
                  ))}
                </div>
                <Input
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="e.g., Home, Office, Parents"
                  className={errors.nickname ? 'border-red-500' : ''}
                />
                {errors.nickname && <p className="text-red-500 text-xs mt-1">{errors.nickname}</p>}
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Recipient's Full Name"
                    className={errors.name ? 'border-red-500' : ''}
                    data-testid="address-name-input"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <Label>Phone Number *</Label>
                  <Input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-Digit Mobile"
                    className={errors.phone ? 'border-red-500' : ''}
                    data-testid="address-phone-input"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Address Lines */}
              <div>
                <Label>Address Line 1 *</Label>
                <Input
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="House/Flat No., Building, Street"
                  className={errors.address_line1 ? 'border-red-500' : ''}
                  data-testid="address-line1-input"
                />
                {errors.address_line1 && <p className="text-red-500 text-xs mt-1">{errors.address_line1}</p>}
              </div>
              <div>
                <Label>Address Line 2 (Optional)</Label>
                <Input
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Landmark, Area"
                  data-testid="address-line2-input"
                />
              </div>

              {/* Pincode first, then City & State (auto-filled) */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>
                    Pincode *
                    {pincodeLookupLoading && <span className="text-xs text-blue-500 ml-2">Looking up...</span>}
                  </Label>
                  <Input
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="6 digits"
                    maxLength={6}
                    className={errors.pincode ? 'border-red-500' : ''}
                    data-testid="address-pincode-input"
                  />
                  {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                  <p className="text-xs text-gray-500 mt-1">City & State auto-fill</p>
                </div>
                <div>
                  <Label>City *</Label>
                  <Input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Auto-filled"
                    className={`bg-gray-100 dark:bg-gray-700 cursor-not-allowed ${errors.city ? 'border-red-500' : ''}`}
                    readOnly
                    data-testid="address-city-input"
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                <div>
                  <Label>State *</Label>
                  <Input
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Auto-filled"
                    className={`bg-gray-100 dark:bg-gray-700 cursor-not-allowed ${errors.state ? 'border-red-500' : ''}`}
                    readOnly
                    data-testid="address-state-input"
                  />
                  {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
                </div>
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_default"
                  checked={formData.is_default}
                  onChange={handleChange}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  Set as default address
                </span>
              </label>

              {/* Submit */}
              <Button
                type="submit"
                disabled={formLoading}
                className="w-full py-5 text-white font-semibold"
                style={{ backgroundColor: formLoading ? '#999' : 'var(--japanese-indigo)' }}
              >
                {formLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : editingAddress ? 'Update Address' : 'Save Address'}
              </Button>
            </form>
          ) : (
            /* Address List */
            <div className="space-y-3">
              {addresses.length === 0 ? (
                <div className="text-center py-8">
                  <MapPin size={48} className="mx-auto mb-4 opacity-30" />
                  <p style={{ color: 'var(--text-subtle)' }}>No saved addresses yet</p>
                </div>
              ) : (
                addresses.map((addr) => (
                  <div
                    key={addr.address_id}
                    className={`p-4 rounded-lg border transition-all ${
                      selectMode ? 'cursor-pointer hover:border-amber-400' : ''
                    } ${addr.is_default ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-900/20' : ''}`}
                    style={{ borderColor: addr.is_default ? undefined : 'var(--border)' }}
                    onClick={() => selectMode && handleSelect(addr)}
                    data-testid={`address-card-${addr.nickname.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                            {addr.nickname}
                          </span>
                          {addr.is_default && (
                            <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                              <Star size={10} fill="currentColor" />
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                          {addr.name} • {addr.phone}
                        </p>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                          {addr.address_line1}
                          {addr.address_line2 && `, ${addr.address_line2}`}
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                          {addr.city}, {addr.state} - {addr.pincode}
                        </p>
                      </div>
                      
                      {!selectMode && (
                        <div className="flex items-center gap-1">
                          {!addr.is_default && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleSetDefault(addr.address_id); }}
                              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              title="Set as default"
                            >
                              <Star size={16} style={{ color: 'var(--text-subtle)' }} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handleEdit(addr); }}
                            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            title="Edit"
                          >
                            <Edit2 size={16} style={{ color: 'var(--metallic-gold)' }} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirm(addr.address_id); }}
                            className="p-2 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                            title="Delete"
                          >
                            <Trash2 size={16} className="text-red-500" />
                          </button>
                        </div>
                      )}
                      
                      {selectMode && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => { e.stopPropagation(); handleSelect(addr); }}
                          style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
                        >
                          <Check size={14} className="mr-1" />
                          Use
                        </Button>
                      )}
                    </div>
                    
                    {/* Delete confirmation */}
                    {deleteConfirm === addr.address_id && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                          <AlertTriangle size={16} />
                          <span className="font-medium text-sm">Delete this address?</span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(addr.address_id)}
                          >
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer - Add button */}
        {!showForm && !selectMode && (
          <div className="p-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <Button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="w-full py-4 text-white font-semibold"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
              data-testid="add-new-address-btn"
            >
              <Plus size={18} className="mr-2" />
              Add New Address
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AddressManager;
