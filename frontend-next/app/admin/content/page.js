'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Star, RefreshCw, Check, X, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function AdminContentPage() {
  const [activeTab, setActiveTab] = useState('reviews');
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/reviews/${id}/approve`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Review approved');
        setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
      }
    } catch (error) {
      toast.error('Failed to approve review');
    }
  };

  const handleReject = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/reviews/${id}/reject`, { method: 'PATCH' });
      if (res.ok) {
        toast.success('Review rejected');
        setReviews(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
      }
    } catch (error) {
      toast.error('Failed to reject review');
    }
  };

  const pendingReviews = reviews.filter(r => r.status === 'pending');

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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Content</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {pendingReviews.length} reviews pending approval
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Reviews List */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div
            key={review.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white">{review.user_name || 'Anonymous'}</h3>
                <p className="text-sm text-slate-500">{review.product_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                    />
                  ))}
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  review.status === 'approved' ? 'bg-green-100 text-green-800' :
                  review.status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {(review.status || 'pending').toUpperCase()}
                </span>
              </div>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 mb-4">{review.comment}</p>
            
            {review.status === 'pending' && (
              <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={() => handleApprove(review.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm"
                >
                  <Check size={14} />
                  Approve
                </button>
                <button
                  onClick={() => handleReject(review.id)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm"
                >
                  <X size={14} />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-8 text-center text-slate-500">
          No reviews found
        </div>
      )}
    </div>
  );
}
