import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { FileText, Star, Mail, Instagram, RefreshCw, Plus, Check, X, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminContentPage = () => {
  const { authFetch } = useOutletContext();
  
  const [activeTab, setActiveTab] = useState('reviews');
  const [reviews, setReviews] = useState([]);
  const [blogPosts, setBlogPosts] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reviewsRes, blogRes, subsRes] = await Promise.all([
        authFetch(`${API_URL}/api/reviews/admin`),
        authFetch(`${API_URL}/api/blog/posts`),
        authFetch(`${API_URL}/api/admin/subscribers`)
      ]);

      if (reviewsRes.ok) {
        const data = await reviewsRes.json();
        setReviews(data.reviews || []);
      }
      if (blogRes.ok) {
        const data = await blogRes.json();
        setBlogPosts(data.posts || []);
      }
      if (subsRes.ok) {
        const data = await subsRes.json();
        setSubscribers(data.subscribers || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateReviewStatus = async (reviewId, approve) => {
    try {
      const res = await authFetch(`${API_URL}/api/reviews/admin/${reviewId}/${approve ? 'approve' : 'reject'}`, {
        method: 'PATCH'
      });

      if (res.ok) {
        toast.success(`Review ${approve ? 'approved' : 'rejected'}`);
        fetchData();
      } else {
        toast.error('Failed to update review');
      }
    } catch (error) {
      toast.error('Failed to update review');
    }
  };

  const tabs = [
    { id: 'reviews', label: 'Reviews', icon: Star },
    { id: 'blog', label: 'Blog', icon: FileText },
    { id: 'subscribers', label: 'Subscribers', icon: Mail },
    { id: 'instagram', label: 'Instagram', icon: Instagram },
  ];

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Content</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage reviews, blog, and subscribers</p>
        </div>
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw size={18} className={loading ? 'animate-spin mr-2' : 'mr-2'} />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-700">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
            {tab.id === 'reviews' && reviews.filter(r => !r.is_approved).length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {reviews.filter(r => !r.is_approved).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="animate-spin text-slate-400" size={32} />
            </div>
          ) : reviews.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <Star size={48} className="mx-auto text-slate-400 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No reviews yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {reviews.map((review) => (
                <div
                  key={review._id || review.id}
                  className={`bg-white dark:bg-slate-800 rounded-xl p-4 border ${
                    review.is_approved
                      ? 'border-slate-200 dark:border-slate-700'
                      : 'border-amber-300 dark:border-amber-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-slate-800 dark:text-white">{review.name}</span>
                        <div className="flex">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              size={14}
                              className={i < review.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
                            />
                          ))}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          review.is_approved
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}>
                          {review.is_approved ? 'Approved' : 'Pending'}
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-sm">{review.comment}</p>
                      <p className="text-xs text-slate-400 mt-2">{formatDate(review.created_at)}</p>
                    </div>
                    {!review.is_approved && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateReviewStatus(review._id || review.id, true)}
                          className="p-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600"
                          title="Approve"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => updateReviewStatus(review._id || review.id, false)}
                          className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600"
                          title="Reject"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Blog Tab */}
      {activeTab === 'blog' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-slate-800 dark:text-white">Blog Posts</h3>
            <Button size="sm">
              <Plus size={16} className="mr-1" />
              New Post
            </Button>
          </div>
          {blogPosts.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">No blog posts yet</p>
          ) : (
            <div className="space-y-3">
              {blogPosts.map((post) => (
                <div key={post._id || post.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white">{post.title}</p>
                    <p className="text-sm text-slate-500">{formatDate(post.created_at)}</p>
                  </div>
                  <Button size="sm" variant="outline">
                    <Eye size={14} className="mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Subscribers Tab */}
      {activeTab === 'subscribers' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-white">
              Newsletter Subscribers ({subscribers.length})
            </h3>
          </div>
          {subscribers.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">No subscribers yet</p>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700 max-h-96 overflow-y-auto">
              {subscribers.map((sub, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-slate-800 dark:text-white">{sub.email}</p>
                    <p className="text-xs text-slate-500">{formatDate(sub.subscribed_at)}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    sub.isActive
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-400'
                  }`}>
                    {sub.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Instagram Tab */}
      {activeTab === 'instagram' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
          <Instagram size={48} className="mx-auto text-pink-500 mb-4" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">Instagram Integration</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Connect your Instagram account to display your feed on the homepage and send notifications to subscribers about new posts.
          </p>
          <Button className="mt-6" variant="outline">
            Connect Instagram
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminContentPage;
