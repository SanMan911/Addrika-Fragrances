import React, { useState, useCallback } from 'react';
import { Truck, MapPin, Clock, Check, AlertCircle, Loader2 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Delivery Estimate Component
 * Shows estimated delivery time based on customer's PIN code
 * Uses ShipRocket API to calculate from nearest warehouse (Delhi/Bihar)
 */
const DeliveryEstimate = ({ className = '' }) => {
  const [pincode, setPincode] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');

  const checkDelivery = useCallback(async (code) => {
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      setEstimate(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/shipping/delivery-estimate?pincode=${code}`);
      const data = await response.json();

      if (data.success) {
        setEstimate(data);
        setError('');
      } else {
        setEstimate(null);
        setError('Unable to estimate delivery for this PIN code');
      }
    } catch (err) {
      console.error('Delivery estimate error:', err);
      setEstimate(null);
      setError('Unable to check delivery. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePincodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPincode(value);
    
    if (value.length === 6) {
      checkDelivery(value);
    } else {
      setEstimate(null);
      setError('');
    }
  };

  return (
    <div className={`delivery-estimate ${className}`}>
      {/* PIN Code Input */}
      <div className="flex items-center gap-2 mb-2">
        <div className="relative flex-1">
          <MapPin 
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
            style={{ color: 'var(--metallic-gold)' }}
          />
          <input
            type="text"
            placeholder="Enter PIN code"
            value={pincode}
            onChange={handlePincodeChange}
            className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
            style={{ 
              borderColor: estimate ? '#16a34a' : error ? '#dc2626' : 'var(--border)',
              backgroundColor: 'var(--cream)'
            }}
            maxLength={6}
            data-testid="delivery-pincode-input"
          />
          {loading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />
          )}
        </div>
        <button
          onClick={() => checkDelivery(pincode)}
          disabled={pincode.length !== 6 || loading}
          className="px-3 py-2 text-sm font-medium rounded-lg transition-all disabled:opacity-50"
          style={{ 
            backgroundColor: 'var(--japanese-indigo)',
            color: 'white'
          }}
          data-testid="check-delivery-btn"
        >
          Check
        </button>
      </div>

      {/* Delivery Estimate Result */}
      {estimate && (
        <div 
          className="flex items-center gap-2 p-2.5 rounded-lg animate-fadeIn"
          style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
          data-testid="delivery-estimate-result"
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#16a34a' }}
          >
            <Truck className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-green-800">
              {estimate.delivery_message}
            </p>
            <p className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Ships from {estimate.shipped_from}
              {estimate.courier && ` via ${estimate.courier}`}
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div 
          className="flex items-center gap-2 p-2.5 rounded-lg"
          style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}
        >
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Hint when no input */}
      {!estimate && !error && !loading && pincode.length < 6 && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Enter PIN code to check delivery time
        </p>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default DeliveryEstimate;
