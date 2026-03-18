import React, { useState, useCallback, useEffect } from 'react';
import { Truck, MapPin, Clock, Check, AlertCircle, Loader2, X, ChevronUp } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * Floating Delivery Checker Component
 * A sticky, floating PIN code checker that stays visible as user scrolls
 * Can be minimized/expanded for better UX
 */
const FloatingDeliveryChecker = () => {
  const [pincode, setPincode] = useState('');
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Show floating checker after scrolling past hero section
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      // Show after scrolling 400px (past hero section)
      setIsVisible(scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll(); // Check initial position
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Load saved pincode from localStorage
  useEffect(() => {
    const savedPincode = localStorage.getItem('addrika_delivery_pincode');
    if (savedPincode) {
      setPincode(savedPincode);
      checkDelivery(savedPincode);
    }
  }, []);

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
        // Save to localStorage for persistence
        localStorage.setItem('addrika_delivery_pincode', code);
      } else {
        setEstimate(null);
        setError('Unable to deliver to this PIN');
      }
    } catch (err) {
      console.error('Delivery estimate error:', err);
      setEstimate(null);
      setError('Check failed. Try again.');
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

  const clearPincode = () => {
    setPincode('');
    setEstimate(null);
    setError('');
    localStorage.removeItem('addrika_delivery_pincode');
  };

  if (!isVisible) return null;

  return (
    <div 
      className="fixed right-4 z-50 transition-all duration-300 ease-out"
      style={{ 
        bottom: isExpanded ? '100px' : '100px',
        transform: isVisible ? 'translateX(0)' : 'translateX(120%)'
      }}
      data-testid="floating-delivery-checker"
    >
      {/* Collapsed State - Just an icon button */}
      {!isExpanded && (
        <button
          onClick={() => setIsExpanded(true)}
          className="group flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all hover:scale-105"
          style={{ 
            backgroundColor: estimate ? '#16a34a' : 'var(--japanese-indigo)',
            color: 'white'
          }}
          data-testid="expand-delivery-checker"
        >
          <Truck className="w-5 h-5" />
          {estimate ? (
            <span className="text-sm font-medium whitespace-nowrap">
              {estimate.etd_days}d delivery
            </span>
          ) : (
            <span className="text-sm font-medium whitespace-nowrap">
              Check Delivery
            </span>
          )}
        </button>
      )}

      {/* Expanded State - Full checker */}
      {isExpanded && (
        <div 
          className="w-72 rounded-xl shadow-2xl overflow-hidden animate-slideIn"
          style={{ 
            backgroundColor: 'white',
            border: '1px solid var(--border)'
          }}
        >
          {/* Header */}
          <div 
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
          >
            <div className="flex items-center gap-2 text-white">
              <Truck className="w-5 h-5" />
              <span className="font-semibold text-sm">Delivery Estimate</span>
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-white/70 hover:text-white transition-colors"
              data-testid="collapse-delivery-checker"
            >
              <ChevronUp className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {/* PIN Code Input */}
            <div className="relative">
              <MapPin 
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" 
                style={{ color: 'var(--metallic-gold)' }}
              />
              <input
                type="text"
                placeholder="Enter 6-digit PIN code"
                value={pincode}
                onChange={handlePincodeChange}
                className="w-full pl-9 pr-16 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all"
                style={{ 
                  borderColor: estimate ? '#16a34a' : error ? '#dc2626' : 'var(--border)',
                  backgroundColor: '#fafafa'
                }}
                maxLength={6}
                data-testid="floating-pincode-input"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {loading && (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                )}
                {pincode && !loading && (
                  <button
                    onClick={clearPincode}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>

            {/* Result */}
            {estimate && (
              <div 
                className="mt-3 flex items-start gap-2 p-3 rounded-lg animate-fadeIn"
                style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' }}
                data-testid="floating-estimate-result"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#16a34a' }}
                >
                  <Check className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-green-800">
                    {estimate.delivery_message}
                  </p>
                  <p className="text-xs text-green-600 mt-0.5">
                    Ships from {estimate.shipped_from}
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div 
                className="mt-3 flex items-center gap-2 p-3 rounded-lg"
                style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}
              >
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Hint */}
            {!estimate && !error && !loading && (
              <p className="mt-3 text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Enter PIN to check delivery time
              </p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideIn {
          from { 
            opacity: 0; 
            transform: translateY(10px) scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: translateY(0) scale(1); 
          }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slideIn {
          animation: slideIn 0.2s ease-out;
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default FloatingDeliveryChecker;
