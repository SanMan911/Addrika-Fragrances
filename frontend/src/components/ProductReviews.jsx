import React, { useState, useEffect } from 'react';
import { Star, User, Check, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const StarRating = ({ rating, onRate, interactive = false, size = 20 }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => interactive && onRate(star)}
          onMouseEnter={() => interactive && setHover(star)}
          onMouseLeave={() => interactive && setHover(0)}
          className={interactive ? 'cursor-pointer' : 'cursor-default'}
          disabled={!interactive}
        >
          <Star
            size={size}
            fill={(hover || rating) >= star ? '#d4af37' : 'none'}
            stroke={(hover || rating) >= star ? '#d4af37' : '#cbd5e1'}
          />
        </button>
      ))}
    </div>
  );
};

const ProductReviews = ({ productId, productName }) => {
  const { user, isAuthenticated } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [averageRating, setAverageRating] = useState(4.2);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [newReview, setNewReview] = useState({
    rating: 5,
    title: '',
    comment: ''
  });

  useEffect(() => {
    fetchReviews();
  }, [productId]);

  const fetchReviews = async () => {
    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/reviews`);
      if (response.ok) {
        const data = await response.json();
        setReviews(data.reviews || []);
        setAverageRating(data.averageRating || 4.2);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    
    if (!isAuthenticated) {
      toast.error('Please login to write a review');
      return;
    }

    if (newReview.comment.length < 10) {
      toast.error('Review must be at least 10 characters');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`${API_URL}/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          productId,
          rating: newReview.rating,
          title: newReview.title || null,
          comment: newReview.comment
        })
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message || 'Review submitted!');
        setNewReview({ rating: 5, title: '', comment: '' });
        setShowForm(false);
        fetchReviews();
      } else {
        toast.error(data.detail || 'Failed to submit review');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8 pt-8 border-t" style={{ borderColor: 'var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            Customer Reviews
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <StarRating rating={averageRating} />
            <span className="font-semibold" style={{ color: 'var(--metallic-gold)' }}>
              {averageRating.toFixed(1)}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
            </span>
          </div>
        </div>
        
        {isAuthenticated && !showForm && (
          <Button
            onClick={() => setShowForm(true)}
            className="text-white"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
            data-testid="write-review-btn"
          >
            Write a Review
          </Button>
        )}
      </div>

      {/* Review Form */}
      {showForm && (
        <div 
          className="mb-8 p-6 rounded-xl"
          style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
        >
          <h4 className="font-semibold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
            Write your review for {productName}
          </h4>
          <form onSubmit={handleSubmitReview} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Your Rating *</label>
              <StarRating
                rating={newReview.rating}
                onRate={(r) => setNewReview({ ...newReview, rating: r })}
                interactive
                size={28}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Review Title (optional)</label>
              <Input
                value={newReview.title}
                onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                placeholder="Summarize your review"
                maxLength={100}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-2">Your Review *</label>
              <textarea
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                placeholder="Share your experience with this product (minimum 10 characters)"
                className="w-full p-3 rounded-lg border min-h-[100px] resize-none"
                style={{ borderColor: 'var(--border)' }}
                required
                minLength={10}
                maxLength={1000}
              />
              <p className="text-xs text-right mt-1" style={{ color: 'var(--text-subtle)' }}>
                {newReview.comment.length}/1000
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={submitting}
                className="text-white"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  'Submit Review'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
              <Check size={14} className="inline mr-1" />
              Reviews are verified purchases only and require admin approval before appearing.
            </p>
          </form>
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="text-center py-8">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
               style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }} />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8">
          <p style={{ color: 'var(--text-subtle)' }}>
            No reviews yet. Be the first to review this product!
          </p>
          {!isAuthenticated && (
            <p className="text-sm mt-2" style={{ color: 'var(--text-subtle)' }}>
              <a href="/login" className="underline" style={{ color: 'var(--metallic-gold)' }}>
                Login
              </a> to write a review (verified purchases only)
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => (
            <div 
              key={review.id}
              className="p-4 rounded-lg"
              style={{ backgroundColor: 'white', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: 'var(--japanese-indigo)' }}
                  >
                    {review.userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                      {review.userName}
                    </p>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} size={14} />
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-600">
                        Verified Purchase
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                  {(() => {
                    const date = new Date(review.createdAt);
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = months[date.getMonth()];
                    const year = date.getFullYear();
                    return `${day}${month}${year}`;
                  })()}
                </span>
              </div>
              
              {review.title && (
                <p className="font-semibold mb-1" style={{ color: 'var(--text-dark)' }}>
                  {review.title}
                </p>
              )}
              <p style={{ color: 'var(--text-subtle)' }}>{review.comment}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductReviews;
