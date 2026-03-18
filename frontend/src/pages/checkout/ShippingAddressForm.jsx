import React from 'react';
import { Truck } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const ShippingAddressForm = ({
  shippingData,
  handleShippingChange,
  shippingErrors,
  shippingPincodeLookupLoading,
  useDifferentShipping,
  setUseDifferentShipping
}) => {
  return (
    <div 
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck size={24} style={{ color: 'var(--metallic-gold)' }} />
          <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
            Shipping Address
          </h2>
        </div>
      </div>

      <label className="flex items-center gap-3 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={!useDifferentShipping}
          onChange={(e) => setUseDifferentShipping(!e.target.checked)}
          className="w-5 h-5 rounded border-gray-300"
        />
        <span className="text-sm">Same as billing address</span>
      </label>

      {useDifferentShipping && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="md:col-span-2 grid grid-cols-4 gap-4">
            <div>
              <Label>Title</Label>
              <select
                name="salutation"
                value={shippingData.salutation}
                onChange={handleShippingChange}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
              >
                <option value="">Select</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
              </select>
            </div>
            <div className="col-span-3">
              <Label>Full Name *</Label>
              <Input
                name="name"
                value={shippingData.name}
                onChange={handleShippingChange}
                placeholder="Recipient's full name"
                className={shippingErrors.name ? 'border-red-500' : ''}
              />
              {shippingErrors.name && <p className="text-red-500 text-sm mt-1">{shippingErrors.name}</p>}
            </div>
          </div>

          <div>
            <Label>Phone Number *</Label>
            <Input
              name="phone"
              value={shippingData.phone}
              onChange={handleShippingChange}
              placeholder="10-digit mobile number"
              className={shippingErrors.phone ? 'border-red-500' : ''}
            />
            {shippingErrors.phone && <p className="text-red-500 text-sm mt-1">{shippingErrors.phone}</p>}
          </div>

          <div>
            <Label>
              Pincode * 
              {shippingPincodeLookupLoading && <span className="text-xs text-blue-500 ml-2">Looking up...</span>}
            </Label>
            <Input
              name="pincode"
              value={shippingData.pincode}
              onChange={handleShippingChange}
              placeholder="6-digit pincode"
              maxLength={6}
              className={shippingErrors.pincode ? 'border-red-500' : ''}
            />
            {shippingErrors.pincode && <p className="text-red-500 text-sm mt-1">{shippingErrors.pincode}</p>}
          </div>

          <div className="md:col-span-2">
            <Label>Address *</Label>
            <Input
              name="address"
              value={shippingData.address}
              onChange={handleShippingChange}
              placeholder="House/Flat No., Building, Street"
              className={shippingErrors.address ? 'border-red-500' : ''}
            />
            {shippingErrors.address && <p className="text-red-500 text-sm mt-1">{shippingErrors.address}</p>}
          </div>

          <div>
            <Label>City *</Label>
            <Input
              name="city"
              value={shippingData.city}
              onChange={handleShippingChange}
              placeholder="Auto-filled from pincode"
              readOnly
              className={`${shippingErrors.city ? 'border-red-500' : ''} bg-gray-100 dark:bg-gray-700 cursor-not-allowed`}
            />
            {shippingErrors.city && <p className="text-red-500 text-sm mt-1">{shippingErrors.city}</p>}
          </div>

          <div>
            <Label>State *</Label>
            <Input
              name="state"
              value={shippingData.state}
              readOnly
              placeholder="Auto-filled from pincode"
              className={`${shippingErrors.state ? 'border-red-500' : ''} bg-gray-100 dark:bg-gray-700 cursor-not-allowed`}
            />
            {shippingErrors.state && <p className="text-red-500 text-sm mt-1">{shippingErrors.state}</p>}
          </div>
        </div>
      )}
    </div>
  );
};

export default ShippingAddressForm;
