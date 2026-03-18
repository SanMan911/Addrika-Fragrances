/**
 * ShippingInfoBanner - Displays clear shipping cost information
 * Shows shipping tiers and encourages higher cart values
 */
import React, { useState } from 'react';
import { Truck, Info, X, ChevronDown, ChevronUp, Gift } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ShippingInfoBanner = ({ cartValue = 0, compact = false }) => {
  const { isDarkMode } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Shipping tiers
  const tiers = [
    { min: 0, max: 248, shipping: 149, label: 'Standard' },
    { min: 249, max: 998, shipping: 49, label: 'Reduced' },
    { min: 999, max: Infinity, shipping: 0, label: 'FREE' }
  ];
  
  // Find current tier
  const currentTier = tiers.find(t => cartValue >= t.min && cartValue <= t.max) || tiers[0];
  
  // Calculate amount needed for next tier
  const nextTier = tiers.find(t => t.min > cartValue);
  const amountToNextTier = nextTier ? nextTier.min - cartValue : 0;
  
  // Progress bar percentage towards free shipping
  const progressToFree = Math.min((cartValue / 999) * 100, 100);
  
  if (compact) {
    return (
      <div 
        className="rounded-lg p-3 flex items-center justify-between"
        style={{ 
          backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.8)' : 'rgba(248, 246, 243, 0.9)',
          border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)'
        }}
        data-testid="shipping-info-compact"
      >
        <div className="flex items-center gap-2">
          <Truck size={16} style={{ color: 'var(--metallic-gold)' }} />
          <span className="text-sm" style={{ color: 'var(--japanese-indigo)' }}>
            {currentTier.shipping === 0 ? (
              <span className="font-semibold text-green-600">FREE Shipping!</span>
            ) : (
              <>Shipping: <strong>₹{currentTier.shipping}</strong></>
            )}
          </span>
        </div>
        {amountToNextTier > 0 && nextTier?.shipping < currentTier.shipping && (
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Add ₹{amountToNextTier} for {nextTier.shipping === 0 ? 'FREE' : `₹${nextTier.shipping}`} shipping
          </span>
        )}
      </div>
    );
  }

  return (
    <div 
      className="rounded-xl overflow-hidden mb-6"
      style={{ 
        backgroundColor: isDarkMode ? 'rgba(26, 35, 50, 0.8)' : 'rgba(248, 246, 243, 0.9)',
        border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.06)'
      }}
      data-testid="shipping-info-banner"
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:opacity-90 transition-opacity"
      >
        <div className="flex items-center gap-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
          >
            <Truck size={18} />
          </div>
          <div className="text-left">
            <p 
              className="font-semibold text-sm"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              {currentTier.shipping === 0 ? (
                <span className="text-green-600">You've unlocked FREE Shipping! 🎉</span>
              ) : (
                <>Shipping: ₹{currentTier.shipping}</>
              )}
            </p>
            {amountToNextTier > 0 && nextTier?.shipping < currentTier.shipping && (
              <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
                Add ₹{amountToNextTier} more for {nextTier.shipping === 0 ? 'FREE' : `₹${nextTier.shipping}`} shipping
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Info size={16} style={{ color: 'var(--text-subtle)' }} />
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>
      
      {/* Progress Bar */}
      <div className="px-4 pb-3">
        <div 
          className="h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(30, 58, 82, 0.1)' }}
        >
          <div 
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ 
              width: `${progressToFree}%`,
              background: progressToFree >= 100 
                ? 'linear-gradient(90deg, #22c55e, #16a34a)' 
                : 'linear-gradient(90deg, var(--metallic-gold), #f59e0b)'
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--text-subtle)' }}>₹0</span>
          <span className="text-xs font-medium" style={{ color: progressToFree >= 100 ? '#22c55e' : 'var(--metallic-gold)' }}>
            {progressToFree >= 100 ? 'FREE!' : '₹999 = Free'}
          </span>
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div 
          className="px-4 pb-4 pt-2 space-y-3"
          style={{ borderTop: isDarkMode ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(30, 58, 82, 0.1)' }}
        >
          <h4 
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--metallic-gold)' }}
          >
            Shipping Rates
          </h4>
          
          <div className="space-y-2">
            {tiers.map((tier, idx) => {
              const isCurrent = tier === currentTier;
              return (
                <div 
                  key={idx}
                  className={`flex items-center justify-between p-2 rounded-lg ${isCurrent ? 'ring-2' : ''}`}
                  style={{ 
                    backgroundColor: isCurrent 
                      ? (isDarkMode ? 'rgba(212, 175, 55, 0.2)' : 'rgba(212, 175, 55, 0.1)')
                      : 'transparent',
                    ringColor: 'var(--metallic-gold)'
                  }}
                >
                  <div className="flex items-center gap-2">
                    {tier.shipping === 0 && <Gift size={14} className="text-green-500" />}
                    <span 
                      className="text-sm"
                      style={{ color: 'var(--japanese-indigo)' }}
                    >
                      {tier.max === Infinity 
                        ? `Orders above ₹${tier.min}` 
                        : tier.min === 0 
                          ? `Orders below ₹${tier.max + 1}`
                          : `Orders ₹${tier.min} - ₹${tier.max}`
                      }
                    </span>
                  </div>
                  <span 
                    className={`text-sm font-bold ${tier.shipping === 0 ? 'text-green-600' : ''}`}
                    style={{ color: tier.shipping === 0 ? undefined : 'var(--metallic-gold)' }}
                  >
                    {tier.shipping === 0 ? 'FREE' : `₹${tier.shipping}`}
                  </span>
                </div>
              );
            })}
          </div>
          
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            * Shipping charges are calculated based on cart value before any discounts. 
            Actual shipping may vary based on location and weight.
          </p>
        </div>
      )}
    </div>
  );
};

export default ShippingInfoBanner;
