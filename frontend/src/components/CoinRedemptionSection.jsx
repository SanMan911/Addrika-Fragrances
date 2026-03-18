/**
 * CoinRedemptionSection - Allow users to redeem coins at checkout
 * Displays coin balance and allows entering amount to redeem
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Coins, Check, X, Info } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useToast } from '../hooks/use-toast';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const CoinRedemptionSection = ({ 
  cartValue, 
  onRedemptionChange,
  isAuthenticated,
  disabled = false 
}) => {
  const [loading, setLoading] = useState(false);
  const [redemptionData, setRedemptionData] = useState(null);
  const [coinsToRedeem, setCoinsToRedeem] = useState('');
  const [appliedCoins, setAppliedCoins] = useState(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  // Fetch max redemption when cart value changes
  useEffect(() => {
    if (isAuthenticated && cartValue > 0) {
      fetchMaxRedemption();
    }
  }, [cartValue, isAuthenticated]);

  const fetchMaxRedemption = async () => {
    try {
      const response = await fetch(`${API_URL}/api/rewards/max-redemption`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ cart_value: cartValue })
      });

      if (response.ok) {
        const data = await response.json();
        setRedemptionData(data);
      }
    } catch (error) {
      console.error('Failed to fetch redemption data:', error);
    }
  };

  const handleApplyCoins = async () => {
    const coins = parseFloat(coinsToRedeem);
    
    if (isNaN(coins) || coins <= 0) {
      setError('Please enter a valid number of coins');
      return;
    }

    if (coins < 20) {
      setError('Minimum 20 coins required to redeem');
      return;
    }

    if (redemptionData && coins > redemptionData.max_redeemable_coins) {
      setError(`Maximum ${redemptionData.max_redeemable_coins.toFixed(2)} coins can be redeemed`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/rewards/validate-redemption`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ coins_to_redeem: coins })
      });

      const data = await response.json();

      if (response.ok && data.is_valid) {
        setAppliedCoins({
          coins: coins,
          value: data.redemption_value
        });
        onRedemptionChange({
          coins: coins,
          value: data.redemption_value
        });
        toast({
          title: 'Coins Applied!',
          description: `₹${data.redemption_value.toFixed(2)} discount applied`,
          variant: 'success'
        });
      } else {
        setError(data.error_message || 'Failed to apply coins');
      }
    } catch (error) {
      setError('Failed to validate coins');
      console.error('Coin validation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveCoins = () => {
    setAppliedCoins(null);
    setCoinsToRedeem('');
    setError('');
    onRedemptionChange(null);
  };

  const handleMaxClick = () => {
    if (redemptionData?.max_redeemable_coins) {
      setCoinsToRedeem(redemptionData.max_redeemable_coins.toFixed(2));
    }
  };

  // Don't show if not authenticated or no coins
  if (!isAuthenticated) {
    return null;
  }

  if (!redemptionData || redemptionData.coins_balance <= 0) {
    return null;
  }

  const canRedeem = redemptionData.can_redeem && !disabled;

  return (
    <div 
      className="p-4 rounded-lg"
      style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
      data-testid="coin-redemption-section"
    >
      <div className="flex items-center gap-2 mb-3">
        <Coins className="w-5 h-5" style={{ color: 'var(--metallic-gold)' }} />
        <h3 className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
          Use Addrika Coins
        </h3>
      </div>

      {/* Balance Info */}
      <div 
        className="p-3 rounded-lg mb-3"
        style={{ backgroundColor: 'rgba(213, 161, 55, 0.1)' }}
      >
        <div className="flex justify-between items-center">
          <div>
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Available Balance</div>
            <div className="text-xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
              {redemptionData.coins_balance.toFixed(2)} <span className="text-sm font-normal">coins</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>Max for this order</div>
            <div className="text-lg font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
              {redemptionData.max_redeemable_coins.toFixed(2)} coins
            </div>
            <div className="text-xs" style={{ color: '#38a169' }}>
              (₹{redemptionData.max_redemption_value.toFixed(2)} value)
            </div>
          </div>
        </div>
      </div>

      {/* Applied Coins Display */}
      {appliedCoins ? (
        <div 
          className="p-3 rounded-lg flex items-center justify-between"
          style={{ backgroundColor: 'rgba(56, 161, 105, 0.1)', border: '1px solid #38a169' }}
        >
          <div className="flex items-center gap-2">
            <Check className="w-5 h-5 text-green-600" />
            <div>
              <div className="font-medium text-green-700">
                {appliedCoins.coins.toFixed(2)} coins applied
              </div>
              <div className="text-sm text-green-600">
                ₹{appliedCoins.value.toFixed(2)} discount
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemoveCoins}
            className="text-red-500 hover:text-red-700"
            data-testid="remove-coins-btn"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <>
          {/* Redemption Input */}
          {canRedeem ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="number"
                    placeholder="Enter coins to redeem"
                    value={coinsToRedeem}
                    onChange={(e) => {
                      setCoinsToRedeem(e.target.value);
                      setError('');
                    }}
                    min="20"
                    max={redemptionData.max_redeemable_coins}
                    step="0.01"
                    disabled={loading || disabled}
                    className="pr-16"
                    data-testid="coins-input"
                  />
                  <button
                    type="button"
                    onClick={handleMaxClick}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2 py-1 rounded"
                    style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
                  >
                    MAX
                  </button>
                </div>
                <Button
                  onClick={handleApplyCoins}
                  disabled={loading || !coinsToRedeem || disabled}
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                  data-testid="apply-coins-btn"
                >
                  {loading ? 'Applying...' : 'Apply'}
                </Button>
              </div>

              {coinsToRedeem && parseFloat(coinsToRedeem) > 0 && (
                <div className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  Discount: ₹{(parseFloat(coinsToRedeem) * 0.60).toFixed(2)}
                </div>
              )}

              {error && (
                <div className="text-sm text-red-500 flex items-center gap-1">
                  <Info className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm p-2 rounded" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#e53e3e' }}>
              {redemptionData.message || 'Minimum 20 coins required to redeem'}
            </div>
          )}
        </>
      )}

      {/* Info Footer */}
      <div className="mt-3 text-xs" style={{ color: 'var(--text-subtle)' }}>
        <Info className="w-3 h-3 inline mr-1" />
        1 coin = ₹0.60 | Max 50% of cart value can be paid with coins
      </div>
    </div>
  );
};

export default CoinRedemptionSection;
