'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileEdit, RefreshCw, Check, X, Eye, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

export default function AdminProfileTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [selectedTicket, setSelectedTicket] = useState(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/profile-tickets${statusFilter ? `?status=${statusFilter}` : ''}`);
      if (res.ok) {
        const data = await res.json();
        setTickets(data.tickets || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
      toast.error('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const handleApprove = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/profile-tickets/${id}/approve`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Profile change approved');
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to approve ticket');
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/profile-tickets/${id}/reject`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Profile change rejected');
        fetchTickets();
      }
    } catch (error) {
      toast.error('Failed to reject ticket');
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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Profile Change Tickets</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review and approve retailer profile changes</p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected', ''].map((status) => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <FileEdit size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">
                    {ticket.retailer_name || 'Retailer'}
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status] || statusColors.pending}`}>
                {(ticket.status || 'pending').toUpperCase()}
              </span>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-slate-500 mb-2">Requested Changes:</h4>
              <div className="space-y-2 text-sm">
                {ticket.changes && Object.entries(ticket.changes).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-800 dark:text-white">{value}</span>
                  </div>
                ))}
                {!ticket.changes && <p className="text-slate-500">No changes specified</p>}
              </div>
            </div>
            
            {ticket.status === 'pending' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleApprove(ticket.id)}
                  className="flex items-center gap-1 px-4 py-2 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200"
                >
                  <Check size={16} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(ticket.id)}
                  className="flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                >
                  <X size={16} />
                  Reject
                </button>
                <button
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex items-center gap-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200"
                >
                  <Eye size={16} />
                  View Details
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {tickets.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-8 text-center text-slate-500">
          No tickets found
        </div>
      )}
    </div>
  );
}
