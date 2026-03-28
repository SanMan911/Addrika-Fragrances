'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  FileEdit, Plus, Clock, CheckCircle, XCircle, AlertCircle, 
  ChevronRight, User, Building, FileText, HelpCircle, Upload, X
} from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const changeTypes = [
  { 
    value: 'name_address', 
    label: 'Change in Name or Address',
    icon: Building,
    description: 'Update business name, trade name, or registered address'
  },
  { 
    value: 'gst', 
    label: 'Change in GST',
    icon: FileText,
    description: 'Update GST number or GST-related details'
  },
  { 
    value: 'spoc', 
    label: 'Change in SPOC',
    icon: User,
    description: 'Update Single Point of Contact details'
  },
  { 
    value: 'other', 
    label: 'Others',
    icon: HelpCircle,
    description: 'Any other profile-related change request'
  }
];
const statusColors = {
  pending: { bg: '#FEF3C7', text: '#D97706', icon: Clock },
  under_review: { bg: '#DBEAFE', text: '#2563EB', icon: AlertCircle },
  approved: { bg: '#D1FAE5', text: '#059669', icon: CheckCircle },
  rejected: { bg: '#FEE2E2', text: '#DC2626', icon: XCircle }
};
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return 'N/A';
  }
};
const StatusBadge = ({ status }) => {
  const config = statusColors[status] || statusColors.pending;
  const Icon = config.icon;
  return (
    <span 
      className="px-2 py-1 text-xs font-medium rounded-full capitalize flex items-center gap-1"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      <Icon size={12} />
      {status?.replace('_', ' ')}
    </span>
  );
};
export default function RetailerProfileRequestsPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [statusCounts, setStatusCounts] = useState({});
  
  const [formData, setFormData] = useState({
    change_type: '',
    description: '',
    new_value: '',
    supporting_document: null
  });
  const [documentName, setDocumentName] = useState('');
  const { fetchWithAuth } = useRetailerAuth();
  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/profile-change-requests`);
      if (response.ok) {
        const data = await response.json();
        setTickets(data.tickets || []);
        setStatusCounts(data.status_counts || {});
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);
  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('File too large (max 2MB)');
      return;
    }
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Only images and PDFs allowed');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setFormData(prev => ({ ...prev, supporting_document: reader.result }));
      setDocumentName(file.name);
    };
    reader.readAsDataURL(file);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.change_type) {
      toast.error('Please select a change type');
      return;
    }
    
    if (!formData.description || formData.description.length < 10) {
      toast.error('Please provide a detailed description (min 10 characters)');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/profile-change-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Request submitted: ${data.ticket_id}`);
        setShowForm(false);
        setFormData({
          change_type: '',
          description: '',
          new_value: '',
          supporting_document: null
        });
        setDocumentName('');
        fetchTickets();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to submit request');
      }
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#2B3A4A]">Profile Change Requests</h1>
        <button 
          onClick={() => setShowForm(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-[#2B3A4A] text-white rounded-lg"
          data-testid="new-request-btn"
        >
          <Plus size={18} />
          Raise Ticket
        </button>
      </div>
      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(statusColors).map(([status, config]) => (
          <div 
            key={status}
            className="p-3 rounded-lg text-center"
            style={{ backgroundColor: config.bg + '80' }}
          >
            <p className="text-2xl font-bold" style={{ color: config.text }}>
              {statusCounts[status] || 0}
            </p>
            <p className="text-xs capitalize" style={{ color: config.text }}>
              {status.replace('_', ' ')}
            </p>
          </div>
        ))}
      </div>
      {/* Info Banner */}
      <div className="rounded-lg p-4 flex items-start gap-3 bg-blue-50 border border-blue-200">
        <AlertCircle className="text-blue-600 flex-shrink-0 mt-0.5" size={20} />
        <div>
          <p className="text-sm font-medium text-blue-800">Profile changes require admin approval</p>
          <p className="text-xs text-blue-600 mt-1">
            To maintain data integrity, profile changes like name, address, GST, or SPOC details must be submitted as a request.
          </p>
        </div>
      </div>
      {/* Tickets List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <FileEdit className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No profile change requests yet</p>
          <button 
            onClick={() => setShowForm(true)} 
            className="mt-4 px-6 py-2 bg-[#2B3A4A] text-white rounded-lg"
            data-testid="first-request-btn"
          >
            Raise Your First Request
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <div 
              key={ticket.ticket_id}
              className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow border"
              onClick={() => setSelectedTicket(ticket)}
              data-testid={`ticket-${ticket.ticket_id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-[#D4AF37]">{ticket.ticket_id}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                  <h3 className="font-medium text-[#2B3A4A]">{ticket.change_type_label}</h3>
                  <p className="text-sm mt-1 line-clamp-2 text-gray-500">{ticket.description}</p>
                  <p className="text-xs mt-2 text-gray-400">Submitted: {formatDate(ticket.created_at)}</p>
                </div>
                <ChevronRight className="text-gray-400 flex-shrink-0" />
              </div>
            </div>
          ))}
        </div>
      )}
      {/* New Request Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-[#2B3A4A]">Request Profile Change</h2>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Change Type Selection */}
                <div>
                  <label className="text-sm font-medium mb-3 block">What would you like to change?</label>
                  <div className="grid grid-cols-1 gap-2">
                    {changeTypes.map((type) => {
                      const Icon = type.icon;
                      const isSelected = formData.change_type === type.value;
                      return (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, change_type: type.value }))}
                          className={`p-4 rounded-lg text-left transition-all flex items-start gap-3 border ${
                            isSelected ? 'ring-2 ring-[#D4AF37] bg-[#F5F0E8]' : 'hover:bg-gray-50'
                          }`}
                          data-testid={`change-type-${type.value}`}
                        >
                          <div className={`p-2 rounded-lg flex-shrink-0 ${isSelected ? 'bg-[#D4AF37]/20' : 'bg-gray-100'}`}>
                            <Icon size={20} className={isSelected ? 'text-[#D4AF37]' : 'text-gray-500'} />
                          </div>
                          <div>
                            <p className="font-medium text-[#2B3A4A]">{type.label}</p>
                            <p className="text-xs mt-0.5 text-gray-500">{type.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {/* Description */}
                <div>
                  <label className="text-sm font-medium">
                    Describe your request <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={4}
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Please provide details about the change you're requesting..."
                    className="w-full mt-2 px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    data-testid="description-input"
                  />
                  <p className="text-xs mt-1 text-gray-500">Minimum 10 characters</p>
                </div>
                {/* New Value */}
                <div>
                  <label className="text-sm font-medium">Proposed new value (optional)</label>
                  <input
                    value={formData.new_value}
                    onChange={(e) => setFormData(prev => ({ ...prev, new_value: e.target.value }))}
                    placeholder="e.g., New business name, new address, etc."
                    className="w-full mt-2 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                    data-testid="new-value-input"
                  />
                </div>
                {/* Supporting Document */}
                <div>
                  <label className="text-sm font-medium">Supporting Document (optional)</label>
                  <div className="mt-2">
                    {documentName ? (
                      <div className="flex items-center justify-between p-3 rounded-lg bg-[#F5F0E8] border">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-[#D4AF37]" />
                          <span className="text-sm truncate max-w-[200px]">{documentName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, supporting_document: null }));
                            setDocumentName('');
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <Upload size={20} className="text-gray-400" />
                        <span className="text-sm text-gray-500">Upload image or PDF (max 2MB)</span>
                        <input
                          type="file"
                          onChange={handleFileChange}
                          accept="image/*,.pdf"
                          className="hidden"
                          data-testid="document-upload"
                        />
                      </label>
                    )}
                  </div>
                </div>
                {/* Submit Button */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                    data-testid="cancel-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !formData.change_type || formData.description.length < 10}
                    className="flex-1 py-2 bg-[#2B3A4A] text-white rounded-lg disabled:opacity-50"
                    data-testid="submit-btn"
                  >
                    {submitting ? 'Submitting...' : 'Submit Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Ticket Detail Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <span className="font-mono text-sm text-[#D4AF37]">{selectedTicket.ticket_id}</span>
                  <h2 className="text-xl font-bold mt-1 text-[#2B3A4A]">{selectedTicket.change_type_label}</h2>
                </div>
                <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <StatusBadge status={selectedTicket.status} />
                  <span className="text-sm text-gray-500">
                    {selectedTicket.reviewed_at 
                      ? `Reviewed: ${formatDate(selectedTicket.reviewed_at)}`
                      : `Submitted: ${formatDate(selectedTicket.created_at)}`
                    }
                  </span>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Description</label>
                  <p className="mt-1 text-[#2B3A4A]">{selectedTicket.description}</p>
                </div>
                {selectedTicket.new_value && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Proposed New Value</label>
                    <p className="mt-1 font-medium text-[#D4AF37]">{selectedTicket.new_value}</p>
                  </div>
                )}
                {selectedTicket.admin_notes && (
                  <div 
                    className="p-4 rounded-lg"
                    style={{ 
                      backgroundColor: selectedTicket.status === 'rejected' ? '#FEF2F2' : '#F0FDF4',
                      border: `1px solid ${selectedTicket.status === 'rejected' ? '#FECACA' : '#BBF7D0'}`
                    }}
                  >
                    <label className="text-sm font-medium" style={{ 
                      color: selectedTicket.status === 'rejected' ? '#991B1B' : '#166534' 
                    }}>
                      Admin Notes
                    </label>
                    <p className="mt-1 text-sm" style={{ 
                      color: selectedTicket.status === 'rejected' ? '#B91C1C' : '#15803D' 
                    }}>
                      {selectedTicket.admin_notes}
                    </p>
                  </div>
                )}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="w-full py-2 border rounded-lg hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
