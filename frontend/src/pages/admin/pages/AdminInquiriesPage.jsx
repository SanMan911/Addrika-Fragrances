import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { MessageSquare, RefreshCw, Check, X, Mail, Phone, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminInquiriesPage = () => {
  const { authFetch } = useOutletContext();
  
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, pending, responded
  const [selectedInquiry, setSelectedInquiry] = useState(null);

  const fetchInquiries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/inquiries/admin`);
      if (res.ok) {
        const data = await res.json();
        setInquiries(data.inquiries || []);
      }
    } catch (error) {
      console.error('Failed to fetch inquiries:', error);
      toast.error('Failed to load inquiries');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  const updateInquiryStatus = async (inquiryId, status) => {
    try {
      const res = await authFetch(`${API_URL}/api/inquiries/admin/${inquiryId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        toast.success(`Inquiry marked as ${status}`);
        fetchInquiries();
      } else {
        toast.error('Failed to update inquiry');
      }
    } catch (error) {
      toast.error('Failed to update inquiry');
    }
  };

  const deleteInquiry = async (inquiryId) => {
    if (!window.confirm('Are you sure you want to delete this inquiry?')) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/inquiries/admin/${inquiryId}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        toast.success('Inquiry deleted');
        fetchInquiries();
        setSelectedInquiry(null);
      } else {
        toast.error('Failed to delete inquiry');
      }
    } catch (error) {
      toast.error('Failed to delete inquiry');
    }
  };

  const filteredInquiries = inquiries.filter(inq => {
    if (filter === 'all') return true;
    return inq.status === filter;
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const pendingCount = inquiries.filter(i => i.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inquiries</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Manage customer inquiries ({pendingCount} pending)
          </p>
        </div>
        <Button onClick={fetchInquiries} variant="outline" disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin mr-2' : 'mr-2'} />
          Refresh
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
        {['all', 'pending', 'responded'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 font-medium capitalize border-b-2 transition-colors ${
              filter === status
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {status}
            {status === 'pending' && pendingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inquiries List */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="animate-spin text-slate-400" size={32} />
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No inquiries found</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-[600px] overflow-y-auto">
              {filteredInquiries.map((inquiry) => (
                <div
                  key={inquiry._id || inquiry.id}
                  onClick={() => setSelectedInquiry(inquiry)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    selectedInquiry?._id === inquiry._id ? 'bg-slate-50 dark:bg-slate-700/50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-white truncate">{inquiry.name}</p>
                      <p className="text-sm text-slate-500 truncate">{inquiry.email}</p>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                        {inquiry.message}
                      </p>
                    </div>
                    <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${
                      inquiry.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                    }`}>
                      {inquiry.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">{formatDate(inquiry.created_at)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inquiry Detail */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          {selectedInquiry ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-white">{selectedInquiry.name}</h2>
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    selectedInquiry.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {selectedInquiry.status}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteInquiry(selectedInquiry._id || selectedInquiry.id)}
                  className="text-red-600 hover:bg-red-50"
                >
                  Delete
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <Mail size={16} />
                  <a href={`mailto:${selectedInquiry.email}`} className="hover:underline">
                    {selectedInquiry.email}
                  </a>
                </div>
                {selectedInquiry.phone && (
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <Phone size={16} />
                    <a href={`tel:${selectedInquiry.phone}`} className="hover:underline">
                      {selectedInquiry.phone}
                    </a>
                  </div>
                )}
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">Message</p>
                <p className="text-slate-800 dark:text-white whitespace-pre-wrap">{selectedInquiry.message}</p>
              </div>

              <p className="text-sm text-slate-500">Received: {formatDate(selectedInquiry.created_at)}</p>

              {selectedInquiry.status === 'pending' && (
                <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                  <Button
                    onClick={() => updateInquiryStatus(selectedInquiry._id || selectedInquiry.id, 'responded')}
                    className="flex-1"
                  >
                    <Check size={16} className="mr-2" />
                    Mark Responded
                  </Button>
                  <a
                    href={`mailto:${selectedInquiry.email}?subject=Re: Your Inquiry to Addrika`}
                    className="flex-1"
                  >
                    <Button variant="outline" className="w-full">
                      <Mail size={16} className="mr-2" />
                      Reply via Email
                    </Button>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 dark:text-slate-400">
              <div className="text-center">
                <Eye size={48} className="mx-auto mb-4 opacity-50" />
                <p>Select an inquiry to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminInquiriesPage;
