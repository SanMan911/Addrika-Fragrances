'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileEdit, RefreshCw, Check, X, Clock, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';
import ConfirmDeleteDialog from '../../../components/admin/ConfirmDeleteDialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

const FILTERS = ['pending', 'under_review', 'approved', 'rejected', ''];

export default function AdminProfileTicketsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [deleting, setDeleting] = useState(null);
  const [resetScope, setResetScope] = useState(null); // 'reviewed' | 'all'

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(
        `${API_URL}/api/retailers/admin/profile-change-tickets${statusFilter ? `?status=${statusFilter}` : ''}`
      );
      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      setTickets(data.tickets || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const review = async (ticketId, status) => {
    try {
      const res = await authFetch(
        `${API_URL}/api/retailers/admin/profile-change-tickets/${ticketId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status, admin_notes: null }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || 'Update failed');
      toast.success(`Profile change ${status}`);
      fetchTickets();
    } catch (error) {
      toast.error(error.message || 'Update failed');
    }
  };

  const deleteTicket = async () => {
    const res = await authFetch(
      `${API_URL}/api/retailers/admin/profile-change-tickets/${deleting.ticket_id}`,
      { method: 'DELETE' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.detail || 'Could not delete this ticket');
      throw new Error(data.detail || 'delete failed');
    }
    toast.success('Ticket deleted');
    fetchTickets();
  };

  const runReset = async () => {
    const res = await authFetch(
      `${API_URL}/api/retailers/admin/profile-change-tickets/reset?scope=${resetScope}&confirm=RESET`,
      { method: 'POST' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.detail || 'Could not clear the tickets');
      throw new Error(data.detail || 'reset failed');
    }
    toast.success(data.message || 'Tickets cleared');
    fetchTickets();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-profile-tickets-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Profile Change Tickets</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Review and approve retailer profile changes</p>
        </div>
        <button
          onClick={fetchTickets}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          data-testid="profile-tickets-refresh"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter + reset */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((status) => (
            <button
              key={status || 'all'}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-amber-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
              data-testid={`profile-tickets-filter-${status || 'all'}`}
            >
              {status ? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-700">
          <span className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <RotateCcw size={15} className="text-amber-500" /> Clear tickets:
          </span>
          <button
            onClick={() => setResetScope('reviewed')}
            className="px-4 py-2 rounded-lg text-sm font-semibold border border-amber-300 text-amber-700 dark:text-amber-400 dark:border-amber-900/60 hover:bg-amber-50 dark:hover:bg-amber-900/20"
            data-testid="profile-tickets-reset-reviewed"
          >
            Clear approved &amp; rejected
          </button>
          <button
            onClick={() => setResetScope('all')}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700"
            data-testid="profile-tickets-reset-all"
          >
            Clear every ticket
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.map((ticket) => (
          <div
            key={ticket.ticket_id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
            data-testid={`profile-ticket-${ticket.ticket_id}`}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                  <FileEdit size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-white">
                    {ticket.business_name || ticket.retailer_id}
                  </h3>
                  <p className="text-sm text-slate-500 flex items-center gap-1">
                    <Clock size={12} />
                    {ticket.created_at ? new Date(ticket.created_at).toLocaleDateString('en-IN') : '—'}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[ticket.status] || statusColors.pending}`}>
                {(ticket.status || 'pending').replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 mb-4">
              <h4 className="text-sm font-medium text-slate-500 mb-2">Requested changes</h4>
              <div className="space-y-2 text-sm">
                {Object.entries(ticket.requested_changes || ticket.changes || {}).map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-4">
                    <span className="text-slate-600 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-800 dark:text-white text-right">{String(value)}</span>
                  </div>
                ))}
                {!Object.keys(ticket.requested_changes || ticket.changes || {}).length && (
                  <p className="text-slate-500">No changes specified</p>
                )}
              </div>
              {ticket.reason && (
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 italic">“{ticket.reason}”</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ticket.status !== 'approved' && (
                <button
                  onClick={() => review(ticket.ticket_id, 'approved')}
                  className="flex items-center gap-1 px-4 py-2 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm hover:bg-green-200"
                  data-testid={`profile-ticket-approve-${ticket.ticket_id}`}
                >
                  <Check size={16} />
                  Approve
                </button>
              )}
              {ticket.status !== 'rejected' && (
                <button
                  onClick={() => review(ticket.ticket_id, 'rejected')}
                  className="flex items-center gap-1 px-4 py-2 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-lg text-sm hover:bg-red-200"
                  data-testid={`profile-ticket-reject-${ticket.ticket_id}`}
                >
                  <X size={16} />
                  Reject
                </button>
              )}
              <button
                onClick={() => setDeleting(ticket)}
                className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20"
                data-testid={`profile-ticket-delete-${ticket.ticket_id}`}
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {tickets.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400" data-testid="profile-tickets-empty">
          No tickets found
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleting}
        title="Delete this ticket permanently?"
        description="The profile change request is erased for good. The retailer's own profile is untouched."
        confirmValue="DELETE"
        onConfirm={deleteTicket}
        onClose={() => setDeleting(null)}
        testId="profile-ticket-confirm-delete"
      />

      <ConfirmDeleteDialog
        open={!!resetScope}
        title={resetScope === 'all' ? 'Clear every profile ticket?' : 'Clear reviewed tickets?'}
        description={
          resetScope === 'all'
            ? 'Every ticket goes, including the pending ones still waiting on you.'
            : 'Only approved and rejected tickets go. Pending requests stay put.'
        }
        confirmValue="RESET"
        confirmLabel="Clear now"
        onConfirm={runReset}
        onClose={() => setResetScope(null)}
        testId="profile-tickets-confirm-reset"
      />
    </div>
  );
}
