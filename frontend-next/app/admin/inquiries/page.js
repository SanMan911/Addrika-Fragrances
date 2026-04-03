'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Search, RefreshCw, Mail, Phone, Check, Trash2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedInquiry, setSelectedInquiry] = useState(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/inquiries`);
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.inquiries || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const handleMarkResolved = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/inquiries/${id}/resolve`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Inquiry marked as resolved');
        setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: 'resolved' } : i));
      }
    } catch (error) {
      toast.error('Failed to update inquiry');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this inquiry?')) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/admin/inquiries/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Inquiry deleted');
        setInquiries(prev => prev.filter(i => i.id !== id));
      }
    } catch (error) {
      toast.error('Failed to delete inquiry');
    }
  };

  const filteredInquiries = statusFilter
    ? inquiries.filter(i => i.status === statusFilter)
    : inquiries;

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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inquiries</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredInquiries.filter(i => i.status === 'pending').length} pending inquiries
          </p>
        </div>
        <button
          onClick={fetchInquiries}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900"
        >
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {/* Inquiries List */}
      <div className="space-y-4">
        {filteredInquiries.map((inquiry) => (
          <div
            key={inquiry.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  inquiry.status === 'pending' ? 'bg-yellow-100' : 'bg-green-100'
                }`}>
                  <MessageSquare size={20} className={inquiry.status === 'pending' ? 'text-yellow-600' : 'text-green-600'} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">{inquiry.name}</h3>
                  <p className="text-sm text-slate-500">{inquiry.subject || 'General Inquiry'}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                inquiry.status === 'pending' 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-green-100 text-green-800'
              }`}>
                {(inquiry.status || 'pending').toUpperCase()}
              </span>
            </div>
            
            <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
              <span className="flex items-center gap-1">
                <Mail size={14} />
                {inquiry.email}
              </span>
              {inquiry.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={14} />
                  {inquiry.phone}
                </span>
              )}
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{inquiry.message}</p>
            
            <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setSelectedInquiry(inquiry)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm"
              >
                <Eye size={14} />
                View Full
              </button>
              {inquiry.status === 'pending' && (
                <button
                  onClick={() => handleMarkResolved(inquiry.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm"
                >
                  <Check size={14} />
                  Mark Resolved
                </button>
              )}
              <button
                onClick={() => handleDelete(inquiry.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredInquiries.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-8 text-center text-slate-500">
          No inquiries found
        </div>
      )}

      {/* Inquiry Detail Modal */}
      {selectedInquiry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full">
            <div className="p-6 border-b flex justify-between">
              <h3 className="text-lg font-bold">Inquiry Details</h3>
              <button onClick={() => setSelectedInquiry(null)}>✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-slate-500">From</h4>
                <p className="font-medium">{selectedInquiry.name}</p>
                <p className="text-sm text-slate-500">{selectedInquiry.email}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500">Subject</h4>
                <p>{selectedInquiry.subject || 'General Inquiry'}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500">Message</h4>
                <p className="whitespace-pre-wrap">{selectedInquiry.message}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
