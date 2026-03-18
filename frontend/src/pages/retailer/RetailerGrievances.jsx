/**
 * Retailer Grievances Page - Submit and track complaints
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, AlertTriangle, Plus, Clock, CheckCircle, 
  MessageSquare, Image, RefreshCw, ChevronRight
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

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

const RetailerGrievances = () => {
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 px-4 py-4"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/retailer/dashboard" className="p-2 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              Grievances
            </h1>
          </div>
          <Button onClick={() => setShowForm(true)} style={{ backgroundColor: 'var(--japanese-indigo)' }}>
            <Plus className="w-4 h-4 mr-2" />
            New Grievance
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Grievances List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : grievances.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p style={{ color: 'var(--text-subtle)' }}>No grievances submitted yet</p>
            <Button 
              onClick={() => setShowForm(true)} 
              className="mt-4"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
            >
              Submit Your First Grievance
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {grievances.map((grievance) => (
              <div
                key={grievance.complaint_id}
                className="bg-white rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedGrievance(grievance)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                      {grievance.subject}
                    </div>
                    <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      {grievance.complaint_id} • {formatDate(grievance.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={grievance.status} />
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span 
                    className="px-2 py-0.5 rounded text-xs capitalize"
                    style={{ backgroundColor: 'var(--cream)' }}
                  >
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
      </div>

      {/* New Grievance Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                  Submit Grievance
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <Label>Subject *</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Brief description of the issue"
                  maxLength={200}
                />
              </div>

              <div>
                <Label>Category</Label>
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
                <Label>Priority</Label>
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
                        borderColor: formData.priority === p.value ? p.color : 'var(--border)',
                        color: formData.priority === p.value ? p.color : 'inherit'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label>Related Order Number (optional)</Label>
                <Input
                  value={formData.order_number}
                  onChange={(e) => setFormData({ ...formData, order_number: e.target.value })}
                  placeholder="e.g., ADD20260303..."
                />
              </div>

              <div>
                <Label>Description *</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the issue in detail..."
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                  maxLength={2000}
                />
                <div className="text-xs text-right mt-1" style={{ color: 'var(--text-subtle)' }}>
                  {formData.description.length}/2000
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={submitting}
                  className="flex-1"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  {submitting ? 'Submitting...' : 'Submit Grievance'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grievance Detail Modal */}
      {selectedGrievance && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                    {selectedGrievance.subject}
                  </h2>
                  <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    {selectedGrievance.complaint_id}
                  </div>
                </div>
                <button onClick={() => setSelectedGrievance(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedGrievance.status} />
                <span 
                  className="px-2 py-0.5 rounded text-xs capitalize"
                  style={{ backgroundColor: 'var(--cream)' }}
                >
                  {selectedGrievance.category?.replace('_', ' ')}
                </span>
              </div>

              <div>
                <div className="text-sm font-medium mb-1">Description</div>
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  {selectedGrievance.description}
                </p>
              </div>

              {selectedGrievance.order_number && (
                <div>
                  <div className="text-sm font-medium mb-1">Related Order</div>
                  <p className="text-sm" style={{ color: 'var(--metallic-gold)' }}>
                    {selectedGrievance.order_number}
                  </p>
                </div>
              )}

              {selectedGrievance.resolution_notes && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#D1FAE5' }}>
                  <div className="text-sm font-medium mb-1" style={{ color: '#059669' }}>Resolution Notes</div>
                  <p className="text-sm">{selectedGrievance.resolution_notes}</p>
                </div>
              )}

              <div className="text-xs pt-4 border-t" style={{ color: 'var(--text-subtle)' }}>
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
};

export default RetailerGrievances;
