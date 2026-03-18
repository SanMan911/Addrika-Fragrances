import React, { useState } from 'react';
import { MapPin, Sparkles, BookMarked } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import AddressManager from '../../components/AddressManager';

const BillingAddressForm = ({
  billingData,
  handleBillingChange,
  errors,
  pincodeLookupLoading,
  hasBillingFromUser,
  usingSavedDetails,
  savedDetails,
  handleUseSavedDetails,
  deliveryMode,
  onSelectSavedAddress,
  isAuthenticated
}) => {
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const isReadOnly = hasBillingFromUser || usingSavedDetails;
  
  const handleAddressSelect = (address) => {
    if (onSelectSavedAddress) {
      onSelectSavedAddress(address);
    }
    setShowAddressPicker(false);
  };
  
  return (
    <div 
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin size={24} style={{ color: 'var(--metallic-gold)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            {deliveryMode === 'self_pickup' ? 'Your Details' : 'Billing Address'}
          </h2>
        </div>
        
        <div className="flex gap-2">
          {/* Use Saved Address Button - Only for authenticated users */}
          {isAuthenticated && (
            <Button
              type="button"
              onClick={() => setShowAddressPicker(true)}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              style={{ borderColor: 'var(--japanese-indigo)', color: 'var(--japanese-indigo)' }}
              data-testid="use-saved-address-btn"
            >
              <BookMarked size={16} />
              Saved Addresses
            </Button>
          )}
          
          {savedDetails && !usingSavedDetails && !hasBillingFromUser && (
            <Button
              type="button"
              onClick={handleUseSavedDetails}
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
              style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
            >
              <Sparkles size={16} />
              Last Order
            </Button>
          )}
        </div>
      </div>

      {usingSavedDetails && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200">
          <p className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <Sparkles size={16} />
            Using your saved details from previous order
          </p>
        </div>
      )}

      {hasBillingFromUser && !usingSavedDetails && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Your address is pre-filled from your profile. Update your profile to change billing address.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2 grid grid-cols-4 gap-4">
          <div>
            <Label htmlFor="salutation">Title</Label>
            <select
              id="salutation"
              name="salutation"
              value={billingData.salutation}
              onChange={handleBillingChange}
              disabled={isReadOnly}
              className={`w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            >
              <option value="">Select</option>
              <option value="Mr.">Mr.</option>
              <option value="Mrs.">Mrs.</option>
              <option value="Ms.">Ms.</option>
            </select>
          </div>
          <div className="col-span-3">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              name="name"
              value={billingData.name}
              onChange={handleBillingChange}
              placeholder="Your full name"
              className={`${errors.name ? 'border-red-500' : ''} ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
              data-testid="checkout-name-input"
              readOnly={isReadOnly}
            />
            {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
          </div>
        </div>

        <div>
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={billingData.email}
            onChange={handleBillingChange}
            placeholder="email@example.com"
            className={`${errors.email ? 'border-red-500' : ''} ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            data-testid="checkout-email-input"
            readOnly={isReadOnly}
          />
          {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>

        <div>
          <Label htmlFor="phone">Phone Number *</Label>
          <Input
            id="phone"
            name="phone"
            value={billingData.phone}
            onChange={handleBillingChange}
            placeholder="10-digit mobile number"
            className={`${errors.phone ? 'border-red-500' : ''} ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            data-testid="checkout-phone-input"
            readOnly={isReadOnly}
          />
          {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
        </div>

        <div>
          <Label htmlFor="pincode">
            Pincode * 
            {pincodeLookupLoading && <span className="text-xs text-blue-500 ml-2">Looking up...</span>}
          </Label>
          <Input
            id="pincode"
            name="pincode"
            value={billingData.pincode}
            onChange={handleBillingChange}
            placeholder="6-digit pincode"
            maxLength={6}
            className={`${errors.pincode ? 'border-red-500' : ''} ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            data-testid="checkout-pincode-input"
            readOnly={isReadOnly}
          />
          {errors.pincode && <p className="text-red-500 text-sm mt-1">{errors.pincode}</p>}
          {!isReadOnly && <p className="text-xs text-gray-500 mt-1">City & State will auto-fill</p>}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="address">Address *</Label>
          <Input
            id="address"
            name="address"
            value={billingData.address}
            onChange={handleBillingChange}
            placeholder="House/Flat No., Building, Street"
            className={`${errors.address ? 'border-red-500' : ''} ${isReadOnly ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : ''}`}
            data-testid="checkout-address-input"
            readOnly={isReadOnly}
          />
          {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
        </div>

        <div>
          <Label htmlFor="city">City *</Label>
          <Input
            id="city"
            name="city"
            value={billingData.city}
            onChange={handleBillingChange}
            placeholder="Auto-filled from pincode"
            className={`${errors.city ? 'border-red-500' : ''} bg-gray-100 dark:bg-gray-700 cursor-not-allowed`}
            data-testid="checkout-city-input"
            readOnly
          />
          {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
        </div>

        <div>
          <Label htmlFor="state">State *</Label>
          <Input
            id="state"
            name="state"
            value={billingData.state}
            onChange={handleBillingChange}
            placeholder="Auto-filled from pincode"
            className={`${errors.state ? 'border-red-500' : ''} bg-gray-100 dark:bg-gray-700 cursor-not-allowed`}
            data-testid="checkout-state-input"
            readOnly
          />
          {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
        </div>
      </div>
      
      {/* Address Manager Modal for selecting saved addresses */}
      <AddressManager 
        isOpen={showAddressPicker}
        onClose={() => setShowAddressPicker(false)}
        onAddressSelect={handleAddressSelect}
        selectMode={true}
      />
    </div>
  );
};

export default BillingAddressForm;
