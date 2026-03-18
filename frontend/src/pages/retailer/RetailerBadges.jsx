/**
 * RetailerBadges - Badge History & Timeline Component
 * Shows retailer's achievements, current badges, and award history
 */
import React, { useState, useEffect } from 'react';
import { 
  Trophy, Star, Crown, Target, Award, CheckCircle, ShieldCheck,
  Clock, Calendar, TrendingUp, Gift, Sparkles, ChevronDown, ChevronUp
} from 'lucide-react';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Icon mapping
const iconMap = {
  trophy: Trophy,
  star: Star,
  crown: Crown,
  target: Target,
  award: Award,
  'check-circle': CheckCircle,
  'shield-check': ShieldCheck
};

const RetailerBadges = () => {
  const [badgeData, setBadgeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showFullHistory, setShowFullHistory] = useState(false);
  
  const { fetchWithAuth } = useRetailerAuth();

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/badges`);
      if (res.ok) {
        const data = await res.json();
        setBadgeData(data);
      } else {
        toast.error('Failed to load badges');
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', { 
        day: 'numeric', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (days) => {
    if (!days) return '';
    if (days < 30) return `${days} days`;
    if (days < 365) return `${Math.floor(days / 30)} months`;
    return `${Math.floor(days / 365)} year${days >= 730 ? 's' : ''}`;
  };

  const getActionText = (action) => {
    switch (action) {
      case 'awarded': return 'Awarded';
      case 'revoked': return 'Revoked';
      case 'removed': return 'Removed';
      case 'replaced': return 'Replaced';
      default: return action;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'awarded': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'revoked': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'removed': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'replaced': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--metallic-gold)' }}></div>
      </div>
    );
  }

  if (!badgeData) {
    return (
      <div className="text-center py-16">
        <Award className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-gray-500">Unable to load badge information</p>
      </div>
    );
  }

  const { current_badges, badge_history, stats } = badgeData;
  const displayHistory = showFullHistory ? badge_history : badge_history?.slice(0, 5);

  return (
    <div className="space-y-6 p-4 lg:p-6" data-testid="retailer-badges-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }} data-testid="badges-header">
            Your Achievements
          </h2>
          <p className="text-gray-500 mt-1">Badges and recognition earned through your partnership</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
          <Sparkles className="text-amber-500" size={20} />
          <span className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
            {stats?.total_badges_earned || 0} Total Earned
          </span>
        </div>
      </div>

      {/* Current Badges Grid */}
      {current_badges?.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="current-badges-grid">
          {current_badges.map((badge, idx) => {
            const IconComponent = iconMap[badge.icon] || Award;
            return (
              <div 
                key={idx}
                className="relative overflow-hidden rounded-xl p-5 bg-white shadow-sm border transition-transform hover:scale-[1.02]"
                style={{ borderColor: badge.color + '40' }}
              >
                {/* Glow effect */}
                <div 
                  className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20"
                  style={{ backgroundColor: badge.color }}
                />
                
                <div className="relative">
                  <div 
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                    style={{ backgroundColor: badge.color + '20' }}
                  >
                    <IconComponent size={28} style={{ color: badge.color }} />
                  </div>
                  
                  <h3 className="font-bold text-lg mb-1" style={{ color: 'var(--japanese-indigo)' }}>
                    {badge.name}
                  </h3>
                  
                  {badge.period && (
                    <p className="text-sm font-medium mb-1" style={{ color: badge.color }}>
                      {badge.period}
                    </p>
                  )}
                  
                  <p className="text-sm text-gray-500">{badge.description}</p>
                  
                  {badge.awarded_at && (
                    <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                      <Calendar size={12} />
                      Awarded {formatDate(badge.awarded_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div 
          className="rounded-xl p-8 text-center"
          style={{ backgroundColor: 'var(--cream)', border: '2px dashed var(--border)' }}
        >
          <Gift className="mx-auto mb-4 text-gray-400" size={48} />
          <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--japanese-indigo)' }}>
            No Badges Yet
          </h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Keep up the great work! Badges are awarded based on your performance, order completion rate, and partnership milestones.
          </p>
        </div>
      )}

      {/* Stats Cards */}
      {stats?.partner_duration_days && (
        <div 
          className="rounded-xl p-6 flex items-center gap-6"
          style={{ background: 'linear-gradient(135deg, var(--japanese-indigo) 0%, #2d4a6a 100%)' }}
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--metallic-gold)' }}>
            <Trophy size={32} className="text-white" />
          </div>
          <div className="text-white">
            <p className="text-sm opacity-80">Verified Partner for</p>
            <p className="text-3xl font-bold">{formatDuration(stats.partner_duration_days)}</p>
            <p className="text-sm opacity-60 mt-1">Thank you for your continued partnership!</p>
          </div>
        </div>
      )}

      {/* Badge History Timeline */}
      {badge_history?.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border p-6" data-testid="badge-history-timeline">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--japanese-indigo)' }}>
              <Clock size={20} />
              Badge History
            </h3>
            <span className="text-sm text-gray-500">{badge_history.length} events</span>
          </div>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200" />
            
            {/* Timeline events */}
            <div className="space-y-6">
              {displayHistory.map((event, idx) => {
                const eventDate = event.awarded_at || event.revoked_at || event.removed_at || event.replaced_at;
                
                return (
                  <div key={event.event_id || idx} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div 
                      className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center ${
                        event.action === 'awarded' ? 'bg-green-100' : 
                        event.action === 'revoked' ? 'bg-red-100' : 'bg-gray-100'
                      }`}
                    >
                      {event.action === 'awarded' ? (
                        <Award className={event.action === 'awarded' ? 'text-green-600' : 'text-gray-600'} size={20} />
                      ) : (
                        <TrendingUp className="text-gray-600" size={20} />
                      )}
                    </div>
                    
                    {/* Event content */}
                    <div className="flex-1 pb-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                            {event.badge_name}
                          </h4>
                          {event.period && (
                            <p className="text-sm text-gray-500">{event.period}</p>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(event.action)}`}>
                          {getActionText(event.action)}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-400 mt-2 flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(eventDate)}
                        {event.awarded_by && (
                          <span className="ml-2">by Admin</span>
                        )}
                      </p>
                      
                      {event.action === 'replaced' && event.replaced_by && (
                        <p className="text-sm text-blue-600 mt-1">
                          Replaced by new recognition
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Show more/less button */}
          {badge_history.length > 5 && (
            <button
              onClick={() => setShowFullHistory(!showFullHistory)}
              className="w-full mt-4 py-3 text-center text-sm font-medium rounded-lg transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
              style={{ color: 'var(--metallic-gold)' }}
            >
              {showFullHistory ? (
                <>
                  <ChevronUp size={16} />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  Show All ({badge_history.length} events)
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Empty History State */}
      {(!badge_history || badge_history.length === 0) && current_badges?.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border p-6 text-center">
          <Clock className="mx-auto mb-3 text-gray-400" size={32} />
          <p className="text-gray-500">Badge history will appear here as you earn more achievements</p>
        </div>
      )}

      {/* Achievement Tips */}
      <div 
        className="rounded-xl p-6"
        style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
      >
        <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--japanese-indigo)' }}>
          <Target size={20} />
          How to Earn More Badges
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="text-green-600" size={16} />
            </div>
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--japanese-indigo)' }}>High Completion Rate</p>
              <p className="text-xs text-gray-500">Complete orders promptly and maintain quality</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="text-blue-600" size={16} />
            </div>
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--japanese-indigo)' }}>Consistent Performance</p>
              <p className="text-xs text-gray-500">Maintain steady order volume month-over-month</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Star className="text-amber-600" size={16} />
            </div>
            <div>
              <p className="font-medium text-sm" style={{ color: 'var(--japanese-indigo)' }}>Customer Satisfaction</p>
              <p className="text-xs text-gray-500">Provide excellent service for positive reviews</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RetailerBadges;
