import React from 'react';
import { Truck, Store, Package } from 'lucide-react';

const DeliveryModeSelector = ({
  deliveryMode,
  setDeliveryMode,
  promotionalText = "For faster service, choose pickup from your nearest Authorized Addrika Retailer."
}) => {
  return (
    <div 
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <Package size={24} style={{ color: 'var(--metallic-gold)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
          How would you like to receive your order?
        </h2>
      </div>
      
      <p className="text-sm mb-4 italic" style={{ color: 'var(--metallic-gold)' }}>
        {promotionalText}
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Shipping Option */}
        <button
          type="button"
          onClick={() => setDeliveryMode('shipping')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            deliveryMode === 'shipping' 
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
          }`}
          data-testid="delivery-mode-shipping"
        >
          <div className="flex items-center gap-3 mb-2">
            <Truck size={24} className={deliveryMode === 'shipping' ? 'text-amber-600' : 'text-gray-400'} />
            <span className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
              Ship to My Address
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Get your order delivered to your doorstep
          </p>
          <p className="text-xs mt-2 text-green-600 font-medium">
            Discount codes available
          </p>
        </button>
        
        {/* Self-Pickup Option */}
        <button
          type="button"
          onClick={() => setDeliveryMode('self_pickup')}
          className={`p-4 rounded-lg border-2 transition-all text-left ${
            deliveryMode === 'self_pickup' 
              ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' 
              : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
          }`}
          data-testid="delivery-mode-pickup"
        >
          <div className="flex items-center gap-3 mb-2">
            <Store size={24} className={deliveryMode === 'self_pickup' ? 'text-amber-600' : 'text-gray-400'} />
            <span className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
              Self-Pickup from Store
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Collect from our retail partner near you
          </p>
          <p className="text-xs mt-2 text-green-600 font-medium">
            No shipping charges - Fast-Track Pickup
          </p>
        </button>
      </div>
    </div>
  );
};

export default DeliveryModeSelector;
