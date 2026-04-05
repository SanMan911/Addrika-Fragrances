'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Store, Search, RefreshCw, MapPin, Phone, Mail, CheckCircle, XCircle, Edit2, Trash2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const statusColors = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  inactive: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

const initialRetailerForm = {
  business_name: '',
  trade_name: '',
  gst_number: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  district: '',
  state: '',
  pincode: '',
  owner_name: '',
  lat: '',
  lng: ''
};

export default function AdminRetailersPage() {
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState(initialRetailerForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchRetailers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/retailers`);
      if (res.ok) {
        const data = await res.json();
        setRetailers(data.retailers || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch retailers:', error);
      toast.error('Failed to load retailers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRetailers();
  }, [fetchRetailers]);

  const filteredRetailers = useMemo(() => {
    let filtered = [...retailers];
    
    if (statusFilter) {
      filtered = filtered.filter(r => r.status === statusFilter);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(r =>
        (r.store_name || r.storeName || '').toLowerCase().includes(query) ||
        (r.owner_name || r.ownerName || '').toLowerCase().includes(query) ||
        (r.email || '').toLowerCase().includes(query) ||
        (r.city || '').toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [retailers, statusFilter, searchQuery]);

  const handleStatusChange = async (retailerId, newStatus) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/retailers/${retailerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (res.ok) {
        toast.success(`Retailer status updated to ${newStatus}`);
        setRetailers(prev => prev.map(r =>
          r.id === retailerId ? { ...r, status: newStatus } : r
        ));
      } else {
        throw new Error('Failed to update status');
      }
    } catch (error) {
      toast.error('Failed to update retailer status');
    }
  };

  const handleAddRetailer = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      const payload = {
        ...formData,
        coordinates: formData.lat && formData.lng ? {
          lat: parseFloat(formData.lat),
          lng: parseFloat(formData.lng)
        } : null
      };
      
      const res = await authFetch(`${API_URL}/api/retailers/admin/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast.success('Retailer added successfully!');
        setShowAddForm(false);
        setFormData(initialRetailerForm);
        fetchRetailers();
      } else {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to add retailer');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to add retailer');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Retailers</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredRetailers.length} registered retailers
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
          >
            <Plus size={18} />
            Add Retailer
          </button>
          <button
            onClick={fetchRetailers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search retailers..."
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Retailers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredRetailers.map((retailer) => (
          <div
            key={retailer.id || retailer.email}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <Store size={24} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">
                    {retailer.store_name || retailer.storeName}
                  </h3>
                  <p className="text-sm text-slate-500">{retailer.owner_name || retailer.ownerName}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[retailer.status] || statusColors.pending}`}>
                {(retailer.status || 'pending').toUpperCase()}
              </span>
            </div>
            
            <div className="space-y-2 text-sm mb-4">
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Mail size={14} />
                <span>{retailer.email}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <Phone size={14} />
                <span>{retailer.phone}</span>
              </p>
              <p className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                <MapPin size={14} />
                <span>{retailer.city}, {retailer.state} - {retailer.pincode}</span>
              </p>
            </div>
            
            <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              {retailer.status !== 'active' && (
                <button
                  onClick={() => handleStatusChange(retailer.id, 'active')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm hover:bg-green-200"
                >
                  <CheckCircle size={14} />
                  Approve
                </button>
              )}
              {retailer.status === 'active' && (
                <button
                  onClick={() => handleStatusChange(retailer.id, 'suspended')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm hover:bg-red-200"
                >
                  <XCircle size={14} />
                  Suspend
                </button>
              )}
              <button
                onClick={() => setSelectedRetailer(retailer)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-200"
              >
                <Edit2 size={14} />
                View Details
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRetailers.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
          No retailers found
        </div>
      )}

      {/* Retailer Details Modal */}
      {selectedRetailer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Retailer Details
              </h3>
              <button
                onClick={() => setSelectedRetailer(null)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Store Name</h4>
                <p className="text-slate-800 dark:text-white">{selectedRetailer.store_name || selectedRetailer.storeName}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Owner</h4>
                <p className="text-slate-800 dark:text-white">{selectedRetailer.owner_name || selectedRetailer.ownerName}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Contact</h4>
                <p className="text-slate-800 dark:text-white">{selectedRetailer.email}</p>
                <p className="text-slate-800 dark:text-white">{selectedRetailer.phone}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-1">Address</h4>
                <p className="text-slate-800 dark:text-white">
                  {selectedRetailer.address}<br />
                  {selectedRetailer.city}, {selectedRetailer.state} - {selectedRetailer.pincode}
                </p>
              </div>
              {selectedRetailer.gstin && (
                <div>
                  <h4 className="text-sm font-medium text-slate-500 mb-1">GSTIN</h4>
                  <p className="text-slate-800 dark:text-white font-mono">{selectedRetailer.gstin}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Retailer Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                Add New Retailer
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleAddRetailer} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Business Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.business_name}
                    onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Trade Name</label>
                  <input
                    type="text"
                    value={formData.trade_name}
                    onChange={(e) => setFormData({...formData, trade_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner Name</label>
                  <input
                    type="text"
                    value={formData.owner_name}
                    onChange={(e) => setFormData({...formData, owner_name: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">GST Number</label>
                  <input
                    type="text"
                    value={formData.gst_number}
                    onChange={(e) => setFormData({...formData, gst_number: e.target.value.toUpperCase()})}
                    maxLength={15}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Address *</label>
                <input
                  type="text"
                  required
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">District</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({...formData, district: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={formData.state}
                    onChange={(e) => setFormData({...formData, state: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pincode *</label>
                  <input
                    type="text"
                    required
                    value={formData.pincode}
                    onChange={(e) => setFormData({...formData, pincode: e.target.value})}
                    maxLength={6}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Latitude (optional)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lat}
                    onChange={(e) => setFormData({...formData, lat: e.target.value})}
                    placeholder="e.g., 28.5921"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Longitude (optional)</label>
                  <input
                    type="number"
                    step="any"
                    value={formData.lng}
                    onChange={(e) => setFormData({...formData, lng: e.target.value})}
                    placeholder="e.g., 77.0460"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Retailer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
