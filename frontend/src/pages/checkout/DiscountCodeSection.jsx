import React from 'react';
import { Tag, Loader2, X, CheckCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';

const DiscountCodeSection = ({
  discountCode,
  setDiscountCode,
  appliedDiscount,
  discountLoading,
  discountHints,
  handleApplyDiscount,
  handleRemoveDiscount,
  deliveryMode
}) => {
  // Don't render for self-pickup orders
  if (deliveryMode === 'self_pickup') {
    return null;
  }
  
  return (
    <div 
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Tag size={24} style={{ color: 'var(--metallic-gold)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
          Discount Code
        </h2>
      </div>

      {appliedDiscount ? (
        <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <CheckCircle size={24} className="text-green-600" />
            <div>
              <p className="font-semibold text-green-700 dark:text-green-400">
                {appliedDiscount.code} applied!
              </p>
              <p className="text-sm text-green-600 dark:text-green-500">
                {appliedDiscount.discountType === 'percentage' 
                  ? `${appliedDiscount.discountValue}% off` 
                  : `₹${appliedDiscount.discountValue} off`}
                {appliedDiscount.discountAmount && ` (Save ₹${appliedDiscount.discountAmount.toFixed(2)})`}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveDiscount}
            className="text-red-500 hover:text-red-700"
          >
            <X size={20} />
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex gap-2">
            <Input
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="flex-1"
              data-testid="discount-code-input"
            />
            <Button
              type="button"
              onClick={handleApplyDiscount}
              disabled={discountLoading || !discountCode.trim()}
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
              className="text-white"
              data-testid="apply-discount-btn"
            >
              {discountLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
          
          {/* Discount hints */}
          {discountHints.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-2">Available codes:</p>
              <div className="flex flex-wrap gap-2">
                {discountHints.map((hint, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setDiscountCode(hint.code)}
                    className="text-xs px-2 py-1 rounded-full border hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
                  >
                    {hint.code} - {hint.description}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscountCodeSection;
