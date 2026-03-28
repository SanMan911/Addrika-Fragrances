'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  MapPin, Plus, Edit2, Trash2, Star, Loader2, X, Home, Building, 
  Check, AlertTriangle, ArrowLeft
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const NICKNAME_SUGGESTIONS = [
  { name: 'Home', icon: Home },
  { name: 'Office', icon: Building },
  { name: 'Parents', icon: Home },
  { name: 'Other', icon: MapPin }
];

const capitalizeWords = (str) => {
  if (!str) return str;
  return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
};

export default function AddressesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
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
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAddresses();
    }
  }, [isAuthenticated]);

  const fetchAddresses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/user/addresses`, { credentials: 'include' });
      const data = await response.json();
      setAddresses(data.addresses || []);
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
      const url = editingAddress 
        ? `${API_URL}/api/user/addresses/${editingAddress.address_id}`
        : `${API_URL}/api/user/addresses`;
      
      const response = await fetch(url, {
        method: editingAddress ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });
      
      if (response.ok) {
        toast.success(editingAddress ? 'Address updated successfully' : 'Address saved successfully');
        fetchAddresses();
        setShowForm(false);
        resetForm();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to save address');
      }
    } catch (error) {
      toast.error('Failed to save address');
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
      const response = await fetch(`${API_URL}/api/user/addresses/${addressId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('Address deleted');
        setDeleteConfirm(null);
        fetchAddresses();
      } else {
        toast.error('Failed to delete address');
      }
    } catch (error) {
      toast.error('Failed to delete address');
    }
  };

  const handleSetDefault = async (addressId) => {
    try {
      const response = await fetch(`${API_URL}/api/user/addresses/${addressId}/set-default`, {
        method: 'PUT',
        credentials: 'include'
      });
      
      if (response.ok) {
        toast.success('Default address updated');
        fetchAddresses();
      } else {
        toast.error('Failed to set default');
      }
    } catch (error) {
      toast.error('Failed to set default');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2B3A4A] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/account" className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <MapPin size={24} className="text-[#D4AF37]" />
            <h1 className="text-xl font-bold">Saved Addresses</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        ) : showForm ? (
          /* Address Form */
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-[#2B3A4A] text-lg">
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </h3>
              <button
                onClick={() => { setShowForm(false); resetForm(); }}
                className="text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Nickname */}
              <div>
                <label className="block text-sm font-medium mb-1">Address Nickname *</label>
                <div className="flex gap-2 mb-2">
                  {NICKNAME_SUGGESTIONS.map(({ name, icon: Icon }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, nickname: name }))}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs transition-all border ${
                        formData.nickname === name 
                          ? 'bg-amber-100 text-amber-700 border-amber-300' 
                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      <Icon size={14} />
                      {name}
                    </button>
                  ))}
                </div>
                <input
                  name="nickname"
                  value={formData.nickname}
                  onChange={handleChange}
                  placeholder="e.g., Home, Office, Parents"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none ${errors.nickname ? 'border-red-500' : ''}`}
                />
                {errors.nickname && <p className="text-red-500 text-xs mt-1">{errors.nickname}</p>}
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Full Name *</label>
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Recipient's Full Name"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none ${errors.name ? 'border-red-500' : ''}`}
                    data-testid="address-name-input"
                  />
                  {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Phone Number *</label>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="10-Digit Mobile"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none ${errors.phone ? 'border-red-500' : ''}`}
                    data-testid="address-phone-input"
                  />
                  {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone}</p>}
                </div>
              </div>

              {/* Address Lines */}
              <div>
                <label className="block text-sm font-medium mb-1">Address Line 1 *</label>
                <input
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  placeholder="House/Flat No., Building, Street"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none ${errors.address_line1 ? 'border-red-500' : ''}`}
                  data-testid="address-line1-input"
                />
                {errors.address_line1 && <p className="text-red-500 text-xs mt-1">{errors.address_line1}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Address Line 2 (Optional)</label>
                <input
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  placeholder="Landmark, Area"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                  data-testid="address-line2-input"
                />
              </div>

              {/* Pincode, City, State */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Pincode *
                    {pincodeLookupLoading && <span className="text-xs text-blue-500 ml-2">Looking up...</span>}
                  </label>
                  <input
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleChange}
                    placeholder="6 digits"
                    maxLength={6}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none ${errors.pincode ? 'border-red-500' : ''}`}
                    data-testid="address-pincode-input"
                  />
                  {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                  <p className="text-xs text-gray-500 mt-1">Auto-fills city/state</p>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City *</label>
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="Auto-filled"
                    readOnly
                    className={`w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed ${errors.city ? 'border-red-500' : ''}`}
                    data-testid="address-city-input"
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">State *</label>
                  <input
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Auto-filled"
                    readOnly
                    className={`w-full px-3 py-2 border rounded-lg bg-gray-100 cursor-not-allowed ${errors.state ? 'border-red-500' : ''}`}
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
                <span className="text-sm text-gray-600">Set as default address</span>
              </label>

              {/* Submit */}
              <button
                type="submit"
                disabled={formLoading}
                className="w-full py-3 bg-[#2B3A4A] text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {formLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </span>
                ) : editingAddress ? 'Update Address' : 'Save Address'}
              </button>
            </form>
          </div>
        ) : (
          /* Address List */
          <div className="space-y-4">
            {addresses.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <MapPin size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500">No saved addresses yet</p>
              </div>
            ) : (
              addresses.map((addr) => (
                <div
                  key={addr.address_id}
                  className={`bg-white p-4 rounded-xl border transition-all ${
                    addr.is_default ? 'border-[#D4AF37] bg-amber-50/50' : 'border-gray-200'
                  }`}
                  data-testid={`address-card-${addr.nickname.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-[#2B3A4A]">{addr.nickname}</span>
                        {addr.is_default && (
                          <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Star size={10} fill="currentColor" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">{addr.name} • {addr.phone}</p>
                      <p className="text-sm mt-1 text-gray-600">
                        {addr.address_line1}
                        {addr.address_line2 && `, ${addr.address_line2}`}
                      </p>
                      <p className="text-sm text-gray-600">
                        {addr.city}, {addr.state} - {addr.pincode}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {!addr.is_default && (
                        <button
                          onClick={() => handleSetDefault(addr.address_id)}
                          className="p-2 rounded hover:bg-gray-100"
                          title="Set as default"
                        >
                          <Star size={16} className="text-gray-400" />
                        </button>
                      )}
                      <button
                        onClick={() => handleEdit(addr)}
                        className="p-2 rounded hover:bg-gray-100"
                        title="Edit"
                      >
                        <Edit2 size={16} className="text-[#D4AF37]" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(addr.address_id)}
                        className="p-2 rounded hover:bg-red-50"
                        title="Delete"
                      >
                        <Trash2 size={16} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                  
                  {/* Delete confirmation */}
                  {deleteConfirm === addr.address_id && (
                    <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                      <div className="flex items-center gap-2 text-red-600 mb-2">
                        <AlertTriangle size={16} />
                        <span className="font-medium text-sm">Delete this address?</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(addr.address_id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="px-3 py-1 border rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Add button */}
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="w-full py-4 bg-[#2B3A4A] text-white rounded-xl font-semibold flex items-center justify-center gap-2"
              data-testid="add-new-address-btn"
            >
              <Plus size={18} />
              Add New Address
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
