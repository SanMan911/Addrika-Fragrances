'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Plus, Clock, CheckCircle, X } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';
const categories = [
  { value: 'order_issue', label: 'Order Issue' },
  { value: 'payment', label: 'Payment Problem' },
  { value: 'product_quality', label: 'Product Quality' },
  { value: 'delivery', label: 'Delivery Issue' },
  { value: 'other', label: 'Other' }
];
const priorities = [
  { value: 'low', label: 'Low', color: '#10B981' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#EF4444' }
];
const statusColors = {
  open: { bg: '#FEE2E2', text: '#DC2626' },
  in_progress: { bg: '#FEF3C7', text: '#D97706' },
  resolved: { bg: '#D1FAE5', text: '#059669' },
  closed: { bg: '#E5E7EB', text: '#6B7280' }
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
  const colors = statusColors[status] || statusColors.open;
  return (
    <span 
      className="px-2 py-1 text-xs font-medium rounded-full capitalize"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      {status?.replace('_', ' ')}
    </span>
  );
};
export default function RetailerGrievancesPage() {
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedGrievance, setSelectedGrievance] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    category: 'other',
    priority: 'medium',
    order_number: ''
  });
  const { fetchWithAuth } = useRetailerAuth();
  const fetchGrievances = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/grievances`);
      if (response.ok) {
        const data = await response.json();
        setGrievances(data.grievances || []);
      }
    } catch (error) {
      console.error('Failed to fetch grievances:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);
  useEffect(() => {
    fetchGrievances();
  }, [fetchGrievances]);
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.subject || !formData.description) {
      toast.error('Please fill in subject and description');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/grievances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        const data = await response.json();
        toast.success(`Grievance submitted: ${data.complaint_id}`);
        setShowForm(false);
        setFormData({
          subject: '',
          description: '',
          category: 'other',
          priority: 'medium',
          order_number: ''
        });
        fetchGrievances();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to submit grievance');
      }
    } catch (error) {
      toast.error('Failed to submit grievance');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#2B3A4A]">Grievances</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2B3A4A] text-white rounded-lg"
        >
          <Plus size={18} />
          New Grievance
        </button>
      </div>
      {/* Grievances List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : grievances.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">No grievances submitted yet</p>
          <button 
            onClick={() => setShowForm(true)} 
            className="mt-4 px-6 py-2 bg-[#2B3A4A] text-white rounded-lg"
          >
            Submit Your First Grievance
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {grievances.map((grievance) => (
            <div
              key={grievance.complaint_id}
              className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow border"
              onClick={() => setSelectedGrievance(grievance)}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-semibold text-[#2B3A4A]">{grievance.subject}</div>
                  <div className="text-sm text-gray-500">
                    {grievance.complaint_id} • {formatDate(grievance.created_at)}
                  </div>
                </div>
                <StatusBadge status={grievance.status} />
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="px-2 py-0.5 rounded text-xs capitalize bg-[#F5F0E8]">
                  {grievance.category?.replace('_', ' ')}
                </span>
                <span style={{ color: priorities.find(p => p.value === grievance.priority)?.color }}>
                  {grievance.priority} priority
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* New Grievance Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#2B3A4A]">Submit Grievance</h2>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Subject *</label>
                <input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Brief description of the issue"
                  maxLength={200}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  {categories.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <div className="flex gap-2">
                  {priorities.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, priority: p.value })}
                      className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        formData.priority === p.value ? 'border-2' : ''
                      }`}
                      style={{ 
                        borderColor: formData.priority === p.value ? p.color : '#e5e7eb',
                        color: formData.priority === p.value ? p.color : 'inherit'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Related Order Number (optional)</label>
                <input
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  placeholder="e.g., ADD20260303..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the issue in detail..."
                  rows={5}
                  maxLength={2000}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                />
                <div className="text-xs text-right mt-1 text-gray-500">
                  {formData.description.length}/2000
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1 py-2 bg-[#2B3A4A] text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Grievance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Grievance Detail Modal */}
      {selectedGrievance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#2B3A4A]">{selectedGrievance.subject}</h2>
                <div className="text-sm text-gray-500">{selectedGrievance.complaint_id}</div>
              </div>
              <button onClick={() => setSelectedGrievance(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedGrievance.status} />
                <span className="px-2 py-0.5 rounded text-xs capitalize bg-[#F5F0E8]">
                  {selectedGrievance.category?.replace('_', ' ')}
                </span>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Description</div>
                <p className="text-sm text-gray-600">{selectedGrievance.description}</p>
              </div>
              {selectedGrievance.order_number && (
                <div>
                  <div className="text-sm font-medium mb-1">Related Order</div>
                  <p className="text-sm text-[#D4AF37]">{selectedGrievance.order_number}</p>
                </div>
              )}
              {selectedGrievance.resolution_notes && (
                <div className="p-3 rounded-lg bg-green-50">
                  <div className="text-sm font-medium mb-1 text-green-700">Resolution Notes</div>
                  <p className="text-sm">{selectedGrievance.resolution_notes}</p>
                </div>
              )}
              <div className="text-xs pt-4 border-t text-gray-500">
                Submitted: {formatDate(selectedGrievance.created_at)}
                {selectedGrievance.resolved_at && (
                  <> • Resolved: {formatDate(selectedGrievance.resolved_at)}</>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
