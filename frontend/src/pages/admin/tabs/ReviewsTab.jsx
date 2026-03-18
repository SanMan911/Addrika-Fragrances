import React from 'react';
import { Star, Check, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const ReviewsTab = ({ reviews, updateReviewStatus }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="reviews-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Product Reviews ({reviews.length})
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {reviews.filter(r => r.status === 'pending').length} pending approval
        </p>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {reviews.map((review) => (
          <div key={review.id} className="p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {review.userName}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Product: {review.productId} • {review.rating} ⭐
                </p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                review.status === 'pending' 
                  ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' 
                  : review.status === 'approved' 
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                    : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
              }`}>
                {review.status}
              </span>
            </div>
            {review.title && <p className="font-medium mb-1 text-slate-800 dark:text-slate-200">{review.title}</p>}
            <p className="text-sm mb-3 text-slate-600 dark:text-slate-400">{review.comment}</p>
            {review.status === 'pending' && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() => updateReviewStatus(review.id, 'approved')}
                  className="flex items-center gap-1 text-white bg-green-500 hover:bg-green-600"
                  data-testid={`approve-review-${review.id}`}
                >
                  <Check size={14} /> Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateReviewStatus(review.id, 'rejected')}
                  className="flex items-center gap-1 text-red-500 border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                  data-testid={`reject-review-${review.id}`}
                >
                  <X size={14} /> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="text-center py-12">
            <Star size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">No reviews yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewsTab;
