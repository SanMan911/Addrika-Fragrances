'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Medal, Crown, Star, RefreshCw } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';
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
  return '#ffffff';
};
export default function RetailerLeaderboardPage() {
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
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-[#D4AF37]" />
          <h1 className="text-2xl font-bold text-[#2B3A4A]">Leaderboard</h1>
        </div>
        <button
          onClick={fetchLeaderboard}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
      {/* Current Retailer Position Card */}
      {currentRetailer && (
        <div 
          className="p-6 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #2B3A4A 0%, #3d5266 100%)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-sm opacity-80">Your Position</div>
              <div className="text-4xl font-bold">#{currentRetailer.rank}</div>
            </div>
            <div className="w-16 h-16 rounded-full flex items-center justify-center bg-white/20">
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
      <div className="p-4 rounded-xl text-sm bg-blue-50 text-blue-700">
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
          <p className="text-gray-500">No rankings available yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leaderboard.map((retailer) => (
            <div
              key={retailer.retailer_id}
              className={`rounded-xl p-4 transition-all ${
                retailer.is_current_user ? 'ring-2 ring-offset-2 ring-[#D4AF37]' : ''
              }`}
              style={{ 
                background: retailer.rank <= 3 ? getRankBgColor(retailer.rank) : 'white',
                color: retailer.rank <= 3 ? 'white' : 'inherit',
                border: retailer.rank > 3 ? '1px solid #e5e7eb' : 'none'
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
                          backgroundColor: retailer.rank <= 3 ? 'rgba(255,255,255,0.3)' : '#D4AF37',
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
      <div className="text-center text-sm text-gray-500">
        Showing top {leaderboard.length} of {totalRetailers} retailers
      </div>
    </div>
  );
}
