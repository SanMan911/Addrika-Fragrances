import React from 'react';
import { Building2 } from 'lucide-react';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const B2BSection = ({
  isB2B,
  setIsB2B,
  gstNumber,
  setGstNumber,
  businessName,
  setBusinessName,
  gstError,
  showB2BOption
}) => {
  if (!showB2BOption) {
    return null;
  }
  
  return (
    <div 
      className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6"
      style={{ border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Building2 size={24} style={{ color: 'var(--metallic-gold)' }} />
        <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
          Business Purchase (B2B)
        </h2>
      </div>

      <label className="flex items-center gap-3 cursor-pointer mb-4">
        <input
          type="checkbox"
          checked={isB2B}
          onChange={(e) => setIsB2B(e.target.checked)}
          className="w-5 h-5 rounded border-gray-300"
        />
        <span className="text-sm">This is a business purchase (GST Invoice required)</span>
      </label>

      {isB2B && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <Label>Business Name *</Label>
            <Input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your registered business name"
              className={!businessName && isB2B ? 'border-amber-400' : ''}
            />
          </div>
          <div>
            <Label>GST Number *</Label>
            <Input
              value={gstNumber}
              onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
              placeholder="e.g., 22AAAAA0000A1Z5"
              maxLength={15}
              className={gstError ? 'border-red-500' : ''}
            />
            {gstError && <p className="text-red-500 text-sm mt-1">{gstError}</p>}
            <p className="text-xs text-gray-500 mt-1">15-character GST Identification Number</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default B2BSection;
