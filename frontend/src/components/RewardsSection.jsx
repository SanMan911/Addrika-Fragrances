/**
 * RewardsSection - Display user's coin balance and history
 * Used in Account page to show rewards information
 */
import React, { useState, useEffect } from 'react';
import { Coins, Gift, TrendingUp, Clock, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '../hooks/use-toast';
import { fetchRewardsBalance, fetchRewardsHistory, formatDate, REWARDS_CONFIG } from '../services/rewardsApi';

const RewardsSection = () => {
  const [rewards, setRewards] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadRewardsBalance();
  }, []);

  const loadRewardsBalance = async () => {
    try {
      const data = await fetchRewardsBalance();
      setRewards(data);
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (history.length > 0) {
      setShowHistory(!showHistory);
      return;
    }

    setHistoryLoading(true);
    try {
      const data = await fetchRewardsHistory(1, 10);
      setHistory(data.transactions || []);
      setShowHistory(true);
    } catch (error) {
      console.error('Failed to fetch history:', error);
      toast({ title: 'Error', description: 'Failed to load transaction history', variant: 'destructive' });
    } finally {
      setHistoryLoading(false);
    }
  };

  const getTransactionIcon = (type) => {
    const icons = {
      earned: <TrendingUp className="w-4 h-4 text-green-500" />,
      redeemed: <Gift className="w-4 h-4 text-amber-500" />,
      expired: <Clock className="w-4 h-4 text-red-500" />,
      adjusted: <Info className="w-4 h-4 text-blue-500" />
    };
    return icons[type] || <Coins className="w-4 h-4 text-gray-500" />;
  };

  const getTransactionColor = (type) => {
    const colors = { earned: 'text-green-600', redeemed: 'text-amber-600', expired: 'text-red-600', adjusted: 'text-blue-600' };
    return colors[type] || 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="p-6 rounded-lg" style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const balance = rewards?.balance?.coins || 0;
  const value = rewards?.balance?.value || 0;
  const daysUntilExpiry = rewards?.expiry?.days_until_expiry;

  return (
    <div 
      className="p-6 rounded-lg"
      style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div 
          className="p-2 rounded-full"
          style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
        >
          <Coins className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
            Addrika Rewards
          </h3>
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
            Earn coins on every purchase
          </p>
        </div>
      </div>

      {/* Balance Card */}
      <div 
        className="p-4 rounded-lg mb-4"
        style={{ 
          background: 'linear-gradient(135deg, var(--japanese-indigo), #2d3748)',
          color: 'white'
        }}
      >
        <div className="text-sm opacity-80 mb-1">Your Coin Balance</div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
            {balance.toFixed(2)}
          </span>
          <span className="text-sm opacity-80">coins</span>
        </div>
        <div className="text-sm mt-2" style={{ color: '#68d391' }}>
          Worth ₹{value.toFixed(2)} on your next order
        </div>
        
        {/* Expiry Warning */}
        {daysUntilExpiry !== null && daysUntilExpiry <= 30 && balance > 0 && (
          <div 
            className="mt-3 p-2 rounded text-sm"
            style={{ 
              backgroundColor: daysUntilExpiry <= 7 ? 'rgba(239, 68, 68, 0.2)' : 'rgba(251, 191, 36, 0.2)',
              color: daysUntilExpiry <= 7 ? '#fca5a5' : '#fcd34d'
            }}
          >
            ⚠️ {daysUntilExpiry <= 7 
              ? `Coins expire in ${daysUntilExpiry} days!` 
              : `Coins expire in ${daysUntilExpiry} days`
            }
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgba(56, 161, 105, 0.1)' }}>
          <div className="text-lg font-semibold text-green-600">
            {rewards?.stats?.total_earned?.toFixed(0) || 0}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Earned</div>
        </div>
        <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgba(213, 161, 55, 0.1)' }}>
          <div className="text-lg font-semibold text-amber-600">
            {rewards?.stats?.total_redeemed?.toFixed(0) || 0}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Redeemed</div>
        </div>
        <div className="text-center p-2 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
          <div className="text-lg font-semibold text-red-600">
            {rewards?.stats?.total_expired?.toFixed(0) || 0}
          </div>
          <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>Expired</div>
        </div>
      </div>

      {/* How It Works */}
      <div 
        className="p-3 rounded mb-4 text-sm"
        style={{ backgroundColor: 'rgba(213, 161, 55, 0.1)' }}
      >
        <div className="font-medium mb-2" style={{ color: 'var(--japanese-indigo)' }}>
          How to Earn & Redeem
        </div>
        <ul className="space-y-1" style={{ color: 'var(--text-subtle)' }}>
          <li>• Earn <strong>6.9 coins</strong> for every ₹125 spent</li>
          <li>• Redeem coins at <strong>₹0.60 per coin</strong></li>
          <li>• Minimum <strong>20 coins</strong> to redeem</li>
          <li>• Max <strong>50%</strong> of order can be paid with coins</li>
          <li>• Coins valid for <strong>3 months</strong> from last purchase</li>
        </ul>
      </div>

      {/* History Toggle */}
      <Button
        variant="outline"
        className="w-full"
        onClick={loadHistory}
        disabled={historyLoading}
        style={{ borderColor: 'var(--border)' }}
        data-testid="view-rewards-history-btn"
      >
        {historyLoading ? (
          'Loading...'
        ) : (
          <>
            {showHistory ? 'Hide' : 'View'} Transaction History
            {showHistory ? <ChevronUp className="ml-2 w-4 h-4" /> : <ChevronDown className="ml-2 w-4 h-4" />}
          </>
        )}
      </Button>

      {/* Transaction History */}
      {showHistory && history.length > 0 && (
        <div className="mt-4 space-y-2">
          {history.map((tx, idx) => (
            <div 
              key={idx}
              className="flex items-center justify-between p-3 rounded"
              style={{ backgroundColor: 'white', border: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                {getTransactionIcon(tx.transaction_type)}
                <div>
                  <div className="text-sm font-medium capitalize" style={{ color: 'var(--japanese-indigo)' }}>
                    {tx.transaction_type}
                  </div>
                  {tx.order_number && (
                    <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                      Order #{tx.order_number}
                    </div>
                  )}
                  <div className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                    {formatDate(tx.created_at)}
                  </div>
                </div>
              </div>
              <div className={`font-semibold ${getTransactionColor(tx.transaction_type)}`}>
                {tx.coins_amount > 0 ? '+' : ''}{tx.coins_amount?.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      )}

      {showHistory && history.length === 0 && (
        <div className="mt-4 text-center p-4 text-sm" style={{ color: 'var(--text-subtle)' }}>
          No transactions yet. Start shopping to earn coins!
        </div>
      )}
    </div>
  );
};

export default RewardsSection;
