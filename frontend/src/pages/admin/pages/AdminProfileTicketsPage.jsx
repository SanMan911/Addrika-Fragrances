import React, { useState, useEffect } from 'react';
import { 
  FileEdit, CheckCircle, XCircle, Clock, AlertCircle, Eye, 
  ChevronLeft, ChevronRight, RefreshCw, User, Building2, 
  FileText, Calendar, Search, Filter
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const StatusBadge = ({ status }) => {
  const styles = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    under_review: 'bg-blue-100 text-blue-800 border-blue-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200'
  };
  
  const icons = {
    pending: Clock,
    under_review: Eye,
    approved: CheckCircle,
    rejected: XCircle
  };
  
  const Icon = icons[status] || AlertCircle;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      <Icon className="w-3.5 h-3.5" />
      {status?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
};

const ChangeTypeBadge = ({ type }) => {
  const styles = {
    business_name: 'bg-purple-50 text-purple-700',
    address: 'bg-blue-50 text-blue-700',
    gst: 'bg-orange-50 text-orange-700',
    spoc: 'bg-teal-50 text-teal-700',
    contact: 'bg-indigo-50 text-indigo-700',
    other: 'bg-gray-50 text-gray-700'
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || styles.other}`}>
      {type?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
    </span>
  );
};

const AdminProfileTicketsPage = () => {
  const [tickets, setTickets] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [pagination, setPagination] = useState({ page: 1, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [processingAction, setProcessingAction] = useState(false);

  const fetchWithAuth = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Request failed');
    }
    return response.json();
  };

  const loadTickets = async (page = 1) => {
    setLoading(true);
    try {
      let url = `${API_URL}/api/retailers/admin/profile-change-tickets?page=${page}&limit=20`;
      if (filterStatus) url += `&status=${filterStatus}`;
      
      const data = await fetchWithAuth(url);
      setTickets(data.tickets || []);
      setStatusCounts(data.status_counts || {});
      setPagination(data.pagination || { page: 1, total: 0, total_pages: 0 });
    } catch (error) {
      toast.error('Failed to load tickets: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadTicketDetail = async (ticketId) => {
    try {
      const data = await fetchWithAuth(`${API_URL}/api/retailers/admin/profile-change-tickets/${ticketId}`);
      setSelectedTicket(data.ticket);
      setSelectedRetailer(data.retailer);
      setReviewNotes(data.ticket?.admin_notes || '');
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load ticket details: ' + error.message);
    }
  };

  const handleReviewTicket = async (status) => {
    if (!selectedTicket) return;
    
    setProcessingAction(true);
    try {
      await fetchWithAuth(
        `${API_URL}/api/retailers/admin/profile-change-tickets/${selectedTicket.ticket_id}`,
        {
          method: 'PUT',
          body: JSON.stringify({
            status,
            admin_notes: reviewNotes
          })
        }
      );
      
      toast.success(`Ticket ${status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : 'marked as under review'}`);
      setShowDetailModal(false);
      loadTickets(pagination.page);
    } catch (error) {
      toast.error('Failed to update ticket: ' + error.message);
    } finally {
      setProcessingAction(false);
    }
  };

  useEffect(() => {
    loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus]);

  const filteredTickets = tickets.filter(ticket => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      ticket.retailer_name?.toLowerCase().includes(search) ||
      ticket.retailer_id?.toLowerCase().includes(search) ||
      ticket.ticket_id?.toLowerCase().includes(search) ||
      ticket.change_type?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6" data-testid="admin-profile-tickets-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Profile Change Requests</h1>
          <p className="text-gray-500 mt-1">Review and manage retailer profile change tickets</p>
        </div>
        <button
          onClick={() => loadTickets(pagination.page)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          data-testid="refresh-tickets-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div 
          className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
            filterStatus === 'pending' ? 'border-amber-500 shadow-md' : 'border-transparent hover:border-amber-200'
          }`}
          onClick={() => setFilterStatus(filterStatus === 'pending' ? '' : 'pending')}
          data-testid="filter-pending"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.pending || 0}</p>
              <p className="text-sm text-gray-500">Pending</p>
            </div>
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
            filterStatus === 'under_review' ? 'border-blue-500 shadow-md' : 'border-transparent hover:border-blue-200'
          }`}
          onClick={() => setFilterStatus(filterStatus === 'under_review' ? '' : 'under_review')}
          data-testid="filter-under-review"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.under_review || 0}</p>
              <p className="text-sm text-gray-500">Under Review</p>
            </div>
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
            filterStatus === 'approved' ? 'border-green-500 shadow-md' : 'border-transparent hover:border-green-200'
          }`}
          onClick={() => setFilterStatus(filterStatus === 'approved' ? '' : 'approved')}
          data-testid="filter-approved"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.approved || 0}</p>
              <p className="text-sm text-gray-500">Approved</p>
            </div>
          </div>
        </div>
        
        <div 
          className={`bg-white rounded-xl p-4 border-2 cursor-pointer transition-all ${
            filterStatus === 'rejected' ? 'border-red-500 shadow-md' : 'border-transparent hover:border-red-200'
          }`}
          onClick={() => setFilterStatus(filterStatus === 'rejected' ? '' : 'rejected')}
          data-testid="filter-rejected"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{statusCounts.rejected || 0}</p>
              <p className="text-sm text-gray-500">Rejected</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by retailer name, ID, or ticket ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              data-testid="search-tickets"
            />
          </div>
          {filterStatus && (
            <button
              onClick={() => setFilterStatus('')}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Filter className="w-4 h-4" />
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {/* Tickets Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="text-center py-20">
            <FileEdit className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No profile change tickets found</p>
            {filterStatus && (
              <button 
                onClick={() => setFilterStatus('')}
                className="mt-2 text-amber-600 hover:underline"
              >
                Clear filter to see all tickets
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="tickets-table">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Retailer</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change Type</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTickets.map((ticket) => (
                  <tr key={ticket.ticket_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{ticket.retailer_name || 'Unknown'}</p>
                          <p className="text-sm text-gray-500">{ticket.retailer_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <ChangeTypeBadge type={ticket.change_type} />
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        {new Date(ticket.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => loadTicketDetail(ticket.ticket_id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-sm font-medium"
                        data-testid={`view-ticket-${ticket.ticket_id}`}
                      >
                        <Eye className="w-4 h-4" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-500">
              Showing page {pagination.page} of {pagination.total_pages} ({pagination.total} total)
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => loadTickets(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => loadTickets(pagination.page + 1)}
                disabled={pagination.page >= pagination.total_pages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" data-testid="ticket-detail-modal">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Profile Change Request</h2>
                <p className="text-sm text-gray-500">Ticket #{selectedTicket.ticket_id?.slice(0, 8)}</p>
              </div>
              <StatusBadge status={selectedTicket.status} />
            </div>
            
            <div className="p-6 space-y-6">
              {/* Retailer Info */}
              {selectedRetailer && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-amber-600" />
                    Retailer Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Business Name</p>
                      <p className="font-medium text-gray-900">{selectedRetailer.business_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Retailer ID</p>
                      <p className="font-medium text-gray-900">{selectedRetailer.retailer_id}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Email</p>
                      <p className="font-medium text-gray-900">{selectedRetailer.email}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p className="font-medium text-gray-900">{selectedRetailer.phone}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Request Details */}
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  Change Request Details
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Change Type</p>
                    <ChangeTypeBadge type={selectedTicket.change_type} />
                  </div>
                  
                  {selectedTicket.current_value && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Current Value</p>
                      <p className="text-gray-900 bg-white px-3 py-2 rounded-lg border border-gray-200">
                        {selectedTicket.current_value}
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Requested Value</p>
                    <p className="text-gray-900 bg-white px-3 py-2 rounded-lg border border-amber-300 font-medium">
                      {selectedTicket.requested_value}
                    </p>
                  </div>
                  
                  {selectedTicket.reason && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Reason for Change</p>
                      <p className="text-gray-700 bg-white px-3 py-2 rounded-lg border border-gray-200">
                        {selectedTicket.reason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Supporting Document */}
              {selectedTicket.supporting_document && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Supporting Document</p>
                  <img 
                    src={selectedTicket.supporting_document} 
                    alt="Supporting document" 
                    className="max-w-full rounded-lg border border-gray-200"
                  />
                </div>
              )}
              
              {/* Admin Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Admin Notes (visible to retailer)
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add notes about this request..."
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  rows={3}
                  data-testid="admin-notes-input"
                />
              </div>
              
              {/* Review History */}
              {selectedTicket.reviewed_by && (
                <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
                  <p>
                    Last reviewed by <span className="font-medium">{selectedTicket.reviewed_by}</span> on{' '}
                    {new Date(selectedTicket.reviewed_at).toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex flex-wrap gap-3 justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Close
              </button>
              
              {selectedTicket.status === 'pending' && (
                <button
                  onClick={() => handleReviewTicket('under_review')}
                  disabled={processingAction}
                  className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium disabled:opacity-50"
                  data-testid="mark-under-review-btn"
                >
                  Mark Under Review
                </button>
              )}
              
              {(selectedTicket.status === 'pending' || selectedTicket.status === 'under_review') && (
                <>
                  <button
                    onClick={() => handleReviewTicket('rejected')}
                    disabled={processingAction}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors font-medium disabled:opacity-50"
                    data-testid="reject-ticket-btn"
                  >
                    <XCircle className="w-4 h-4 inline mr-1" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleReviewTicket('approved')}
                    disabled={processingAction}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                    data-testid="approve-ticket-btn"
                  >
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Approve
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProfileTicketsPage;
