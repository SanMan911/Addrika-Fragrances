/**
 * UserRewardsTab - Admin view of all user rewards/coins
 * Shows coin balances, allows adjustments, and displays aggregate stats
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Coins, Search, RefreshCw, ChevronDown, Edit2, TrendingUp, TrendingDown, Users } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Helper function for authenticated fetch
const authFetch = async (url, options = {}) => {
  const sessionToken = localStorage.getItem('addrika_session_token');
  const headers = {
    ...options.headers,
    ...(sessionToken && { 'Authorization': `Bearer ${sessionToken}` })
  };
  return fetch(url, { ...options, credentials: 'include', headers });
};

const UserRewardsTab = () => {
  const [rewards, setRewards] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState('coins_balance');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Adjustment modal
  const [adjustmentModal, setAdjustmentModal] = useState(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  
  // Transaction history modal  
  const [historyModal, setHistoryModal] = useState(null);
  const [userHistory, setUserHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchRewards = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(
        `${API_URL}/api/retailers/admin/user-rewards?page=${page}&limit=30&sort_by=${sortBy}&sort_order=${sortOrder}`
      );
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards || []);
        setStats(data.aggregate_stats || {});
        setTotalPages(data.pagination?.total_pages || 1);
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
      toast.error('Failed to load user rewards');
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder]);

  useEffect(() => {
    fetchRewards();
  }, [fetchRewards]);

  const handleAdjustCoins = async () => {
    if (!adjustmentModal || !adjustmentAmount || !adjustmentReason) {
      toast.error('Please fill all fields');
      return;
    }

    setAdjusting(true);
    try {
      const response = await authFetch(
        `${API_URL}/api/retailers/admin/user-rewards/${adjustmentModal.user_id}/adjust`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adjustment_amount: parseFloat(adjustmentAmount),
            reason: adjustmentReason
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toast.success(`Coins adjusted: ${data.previous_balance} → ${data.new_balance}`);
        setAdjustmentModal(null);
        setAdjustmentAmount('');
        setAdjustmentReason('');
        fetchRewards();
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to adjust coins');
      }
    } catch (error) {
      console.error('Adjustment error:', error);
      toast.error('Failed to adjust coins');
    } finally {
      setAdjusting(false);
    }
  };

  const fetchUserHistory = async (userId) => {
    setLoadingHistory(true);
    try {
      const response = await authFetch(
        `${API_URL}/api/retailers/admin/user-rewards/${userId}`
      );
      if (response.ok) {
        const data = await response.json();
        setUserHistory(data.transactions || []);
        setHistoryModal(data.user || { user_id: userId });
      }
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoadingHistory(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Coins className="w-6 h-6" style={{ color: 'var(--metallic-gold)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            User Rewards
          </h2>
        </div>
        <Button
          onClick={fetchRewards}
          variant="outline"
          disabled={loading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Aggregate Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Total Outstanding</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
              {stats.total_coins_outstanding?.toFixed(0) || 0}
            </div>
            <div className="text-xs text-green-600">
              ≈ ₹{stats.outstanding_liability?.toFixed(2) || 0} liability
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Total Earned</div>
            <div className="text-2xl font-bold text-green-600">
              {stats.total_coins_ever_earned?.toFixed(0) || 0}
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Total Redeemed</div>
            <div className="text-2xl font-bold text-amber-600">
              {stats.total_coins_redeemed?.toFixed(0) || 0}
            </div>
          </div>
          <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}>
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Users with Balance</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              {stats.users_with_balance || 0}
            </div>
          </div>
        </div>
      )}

      {/* Sort Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-sm">Sort by:</Label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-1 rounded border text-sm"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="coins_balance">Coin Balance</option>
            <option value="total_earned">Total Earned</option>
            <option value="last_purchase">Last Purchase</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm">Order:</Label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            className="px-3 py-1 rounded border text-sm"
            style={{ borderColor: 'var(--border)' }}
          >
            <option value="desc">Highest First</option>
            <option value="asc">Lowest First</option>
          </select>
        </div>
      </div>

      {/* Rewards Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: 'var(--metallic-gold)' }} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--cream)' }}>
                <th className="p-3 text-left font-semibold" style={{ color: 'var(--japanese-indigo)' }}>User</th>
                <th className="p-3 text-right font-semibold" style={{ color: 'var(--japanese-indigo)' }}>Balance</th>
                <th className="p-3 text-right font-semibold" style={{ color: 'var(--japanese-indigo)' }}>Earned</th>
                <th className="p-3 text-right font-semibold" style={{ color: 'var(--japanese-indigo)' }}>Redeemed</th>
                <th className="p-3 text-center font-semibold" style={{ color: 'var(--japanese-indigo)' }}>Last Purchase</th>
                <th className="p-3 text-center font-semibold" style={{ color: 'var(--japanese-indigo)' }}>Expiry</th>
                <th className="p-3 text-center font-semibold" style={{ color: 'var(--japanese-indigo)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((reward, idx) => (
                <tr key={idx} className="border-b" style={{ borderColor: 'var(--border)' }}>
                  <td className="p-3">
                    <div className="font-medium" style={{ color: 'var(--japanese-indigo)' }}>
                      {reward.user_name || 'N/A'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      {reward.email}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="font-bold" style={{ color: 'var(--metallic-gold)' }}>
                      {reward.coins_balance?.toFixed(2) || 0}
                    </div>
                    <div className="text-xs text-green-600">
                      ₹{(reward.coins_balance * 0.6).toFixed(2)}
                    </div>
                  </td>
                  <td className="p-3 text-right text-green-600">
                    {reward.total_coins_earned?.toFixed(2) || 0}
                  </td>
                  <td className="p-3 text-right text-amber-600">
                    {reward.total_coins_redeemed?.toFixed(2) || 0}
                  </td>
                  <td className="p-3 text-center" style={{ color: 'var(--text-subtle)' }}>
                    {formatDate(reward.last_purchase_date)}
                  </td>
                  <td className="p-3 text-center">
                    <span 
                      className={`text-xs px-2 py-1 rounded ${
                        new Date(reward.coins_expiry_date) < new Date() 
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-600'
                      }`}
                    >
                      {formatDate(reward.coins_expiry_date)}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <div className="flex justify-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAdjustmentModal(reward)}
                        className="text-xs"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        Adjust
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetchUserHistory(reward.user_id)}
                        className="text-xs"
                      >
                        History
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="px-4 py-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Adjustment Modal */}
      {adjustmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            className="bg-white p-6 rounded-lg w-full max-w-md"
            style={{ border: '2px solid var(--metallic-gold)' }}
          >
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              Adjust Coins for {adjustmentModal.user_name || adjustmentModal.email}
            </h3>
            
            <div className="mb-4 p-3 rounded" style={{ backgroundColor: 'var(--cream)' }}>
              <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Current Balance</div>
              <div className="text-xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
                {adjustmentModal.coins_balance?.toFixed(2)} coins
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Adjustment Amount (+ to add, - to subtract)</Label>
                <Input
                  type="number"
                  value={adjustmentAmount}
                  onChange={(e) => setAdjustmentAmount(e.target.value)}
                  placeholder="e.g., 10 or -5"
                  step="0.01"
                />
              </div>
              <div>
                <Label>Reason *</Label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="Reason for adjustment (required)"
                  className="w-full px-3 py-2 border rounded text-sm"
                  style={{ borderColor: 'var(--border)' }}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setAdjustmentModal(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAdjustCoins}
                disabled={adjusting || !adjustmentAmount || !adjustmentReason}
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                {adjusting ? 'Adjusting...' : 'Confirm Adjustment'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {historyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div 
            className="bg-white p-6 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto"
            style={{ border: '2px solid var(--metallic-gold)' }}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Transaction History - {historyModal.name || historyModal.email}
              </h3>
              <Button
                variant="ghost"
                onClick={() => setHistoryModal(null)}
              >
                ✕
              </Button>
            </div>

            {loadingHistory ? (
              <div className="flex justify-center py-10">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : userHistory.length === 0 ? (
              <div className="text-center py-10" style={{ color: 'var(--text-subtle)' }}>
                No transactions found
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'var(--cream)' }}>
                    <th className="p-2 text-left">Date</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-right">Balance</th>
                    <th className="p-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {userHistory.map((tx, idx) => (
                    <tr key={idx} className="border-b" style={{ borderColor: 'var(--border)' }}>
                      <td className="p-2">{formatDate(tx.created_at)}</td>
                      <td className="p-2 capitalize">{tx.transaction_type}</td>
                      <td className={`p-2 text-right font-medium ${tx.coins_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.coins_amount > 0 ? '+' : ''}{tx.coins_amount?.toFixed(2)}
                      </td>
                      <td className="p-2 text-right">{tx.coins_balance_after?.toFixed(2)}</td>
                      <td className="p-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
                        {tx.order_number && `Order #${tx.order_number}`}
                        {tx.adjustment_reason && tx.adjustment_reason}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRewardsTab;
