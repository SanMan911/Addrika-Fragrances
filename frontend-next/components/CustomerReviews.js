'use client';

import { useState } from 'react';
import { Star, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';

function ReviewCard({ review }) {
  const date = new Date(review.date);
  const formattedDate = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div
      className="p-5 rounded-xl transition-all duration-300 hover:scale-[1.01]"
      style={{
        background: 'linear-gradient(135deg, rgba(26,26,46,0.6) 0%, rgba(22,33,62,0.6) 100%)',
        border: '1px solid rgba(212,175,55,0.1)',
      }}
      data-testid={`review-card-${review.name.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
            style={{
              background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
              color: '#1a1a2e',
            }}
          >
            {review.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">{review.name}</span>
              {review.verified && (
                <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                  <CheckCircle size={11} />
                  Verified
                </span>
              )}
            </div>
            <span className="text-xs text-gray-500">{formattedDate}</span>
          </div>
        </div>
        {/* Stars */}
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              size={13}
              fill={star <= review.rating ? '#D4AF37' : 'transparent'}
              color={star <= review.rating ? '#D4AF37' : 'rgba(255,255,255,0.2)'}
            />
          ))}
        </div>
      </div>
      <p className="text-sm leading-relaxed text-gray-300">
        {review.text}
      </p>
    </div>
  );
}

function RatingBreakdown({ reviews }) {
  const counts = [0, 0, 0, 0, 0];
  reviews.forEach((r) => {
    if (r.rating >= 1 && r.rating <= 5) counts[r.rating - 1]++;
  });
  const total = reviews.length;

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = counts[star - 1];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={star} className="flex items-center gap-3 text-sm">
            <span className="w-6 text-right text-gray-400 font-medium">{star}</span>
            <Star size={12} fill="#D4AF37" color="#D4AF37" />
            <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: 'linear-gradient(90deg, #D4AF37 0%, #f5d67a 100%)',
                }}
              />
            </div>
            <span className="w-6 text-gray-500 text-xs">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function CustomerReviews({ reviews, rating, reviewCount }) {
  const [showAll, setShowAll] = useState(false);

  if (!reviews || reviews.length === 0) return null;

  const displayed = showAll ? reviews : reviews.slice(0, 3);

  return (
    <section
      className="mt-16 pt-12 border-t"
      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
      data-testid="customer-reviews-section"
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-10 mb-8">
        <div className="lg:w-1/3">
          <h2
            className="text-2xl sm:text-3xl font-bold text-white mb-2"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Customer Reviews
          </h2>
          <div className="flex items-center gap-3 mb-5">
            <span className="text-4xl font-bold text-[#D4AF37]">{rating}</span>
            <div>
              <div className="flex gap-0.5 mb-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={16}
                    fill={star <= Math.round(rating) ? '#D4AF37' : 'transparent'}
                    color={star <= Math.round(rating) ? '#D4AF37' : 'rgba(255,255,255,0.2)'}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">Based on {reviewCount} reviews</span>
            </div>
          </div>
          <RatingBreakdown reviews={reviews} />
        </div>

        {/* Reviews Grid */}
        <div className="lg:w-2/3 space-y-4">
          {displayed.map((review, idx) => (
            <ReviewCard key={idx} review={review} />
          ))}

          {reviews.length > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="flex items-center gap-2 mx-auto px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 hover:scale-105"
              style={{
                color: '#D4AF37',
                background: 'rgba(212,175,55,0.08)',
                border: '1px solid rgba(212,175,55,0.2)',
              }}
              data-testid="toggle-reviews-btn"
            >
              {showAll ? (
                <>Show Less <ChevronUp size={16} /></>
              ) : (
                <>Show All {reviews.length} Reviews <ChevronDown size={16} /></>
              )}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
