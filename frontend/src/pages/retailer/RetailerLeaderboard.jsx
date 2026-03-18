/**
 * Retailer Leaderboard Page - Rankings and performance comparison
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, Trophy, Medal, Crown, Star, TrendingUp,
  Package, DollarSign, RefreshCw, User
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useRetailerAuth } from '../../context/RetailerAuthContext';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RetailerLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentRetailer, setCurrentRetailer] = useState(null);
  const [totalRetailers, setTotalRetailers] = useState(0);
  const [loading, setLoading] = useState(true);
  
  const { fetchWithAuth } = useRetailerAuth();

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data.leaderboard || []);
        setCurrentRetailer(data.current_retailer);
        setTotalRetailers(data.total_retailers || 0);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-amber-600" />;
    return <span className="w-6 h-6 flex items-center justify-center font-bold text-gray-500">#{rank}</span>;
  };

  const getRankBgColor = (rank) => {
    if (rank === 1) return 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)';
    if (rank === 2) return 'linear-gradient(135deg, #C0C0C0 0%, #A0A0A0 100%)';
    if (rank === 3) return 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)';
    return 'var(--cream)';
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
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6" style={{ color: 'var(--metallic-gold)' }} />
              <h1 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Leaderboard
              </h1>
            </div>
          </div>
          <Button variant="outline" onClick={fetchLeaderboard} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Current Retailer Position Card */}
        {currentRetailer && (
          <div 
            className="mb-6 p-6 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, var(--japanese-indigo) 0%, #2C3E50 100%)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm opacity-80">Your Position</div>
                <div className="text-4xl font-bold">#{currentRetailer.rank}</div>
              </div>
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
              >
                <Star className="w-8 h-8" />
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/20">
              <div>
                <div className="text-xs opacity-70">Orders</div>
                <div className="text-xl font-bold">{currentRetailer.total_orders}</div>
              </div>
              <div>
                <div className="text-xs opacity-70">Completion</div>
                <div className="text-xl font-bold">{currentRetailer.completion_rate}%</div>
              </div>
              <div>
                <div className="text-xs opacity-70">Score</div>
                <div className="text-xl font-bold">{currentRetailer.overall_score}</div>
              </div>
            </div>
          </div>
        )}

        {/* Scoring Info */}
        <div 
          className="mb-6 p-4 rounded-xl text-sm"
          style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}
        >
          <div className="font-medium mb-1">How is the score calculated?</div>
          <div className="text-xs">
            40% Completion Rate + 30% Order Volume + 30% Revenue Generated
          </div>
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
            ))}
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl">
            <Trophy className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p style={{ color: 'var(--text-subtle)' }}>No rankings available yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leaderboard.map((retailer) => (
              <div
                key={retailer.retailer_id}
                className={`rounded-xl p-4 transition-all ${
                  retailer.is_current_user ? 'ring-2 ring-offset-2' : ''
                }`}
                style={{ 
                  background: retailer.rank <= 3 ? getRankBgColor(retailer.rank) : 'white',
                  color: retailer.rank <= 3 ? 'white' : 'inherit',
                  ringColor: retailer.is_current_user ? 'var(--metallic-gold)' : 'transparent'
                }}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0">
                    {getRankIcon(retailer.rank)}
                  </div>

                  {/* Store Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold truncate ${retailer.rank <= 3 ? '' : 'text-gray-900'}`}>
                        {retailer.name}
                      </span>
                      {retailer.is_current_user && (
                        <span 
                          className="px-2 py-0.5 text-xs rounded-full"
                          style={{ 
                            backgroundColor: retailer.rank <= 3 ? 'rgba(255,255,255,0.3)' : 'var(--metallic-gold)',
                            color: 'white'
                          }}
                        >
                          You
                        </span>
                      )}
                    </div>
                    <div className={`text-sm ${retailer.rank <= 3 ? 'opacity-80' : 'text-gray-500'}`}>
                      {retailer.city}, {retailer.district}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 text-right">
                    <div className={`text-lg font-bold ${retailer.rank <= 3 ? '' : 'text-gray-900'}`}>
                      {retailer.overall_score}
                    </div>
                    <div className={`text-xs ${retailer.rank <= 3 ? 'opacity-80' : 'text-gray-500'}`}>
                      {retailer.total_orders} orders • {retailer.completion_rate}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Total Count */}
        <div className="mt-6 text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
          Showing top {leaderboard.length} of {totalRetailers} retailers
        </div>
      </div>
    </div>
  );
};

export default RetailerLeaderboard;
