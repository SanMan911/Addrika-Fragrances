import React from 'react';
import { Tag, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const DiscountsTab = ({
  discountCodes,
  showNewCodeForm,
  setShowNewCodeForm,
  newCode,
  setNewCode,
  createDiscountCode,
  deleteDiscountCode,
  setShowPurgeDiscountsModal
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="discounts-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Discount Codes ({discountCodes.length})
        </h2>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowNewCodeForm(!showNewCodeForm)}
            className="flex items-center gap-2 text-white bg-slate-800 hover:bg-slate-700"
            data-testid="new-discount-code-btn"
          >
            <Plus size={18} />
            New Code
          </Button>
          {discountCodes.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowPurgeDiscountsModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="purge-all-discounts-btn"
            >
              <Trash2 size={16} className="mr-1" />
              Purge All
            </Button>
          )}
        </div>
      </div>

      {/* New Code Form */}
      {showNewCodeForm && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
          <form onSubmit={createDiscountCode} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Code *</Label>
              <Input
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                placeholder="e.g., WELCOME10"
                required
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                data-testid="discount-code-input"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Discount Type</Label>
              <select
                value={newCode.discountType}
                onChange={(e) => setNewCode({ ...newCode, discountType: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                data-testid="discount-type-select"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed (₹)</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Value *</Label>
              <Input
                type="number"
                value={newCode.discountValue}
                onChange={(e) => setNewCode({ ...newCode, discountValue: e.target.value })}
                placeholder="10"
                required
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                data-testid="discount-value-input"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Usage Type</Label>
              <select
                value={newCode.usageType}
                onChange={(e) => setNewCode({ ...newCode, usageType: e.target.value })}
                className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                data-testid="usage-type-select"
              >
                <option value="universal">Universal (anyone, unlimited)</option>
                <option value="single_per_user">Single Use (once per user)</option>
                <option value="limited">Limited (first X uses)</option>
                <option value="time_bound">Time-Bound (expires)</option>
              </select>
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Max Uses {newCode.usageType === 'limited' ? '*' : '(optional)'}</Label>
              <Input
                type="number"
                value={newCode.maxUses}
                onChange={(e) => setNewCode({ ...newCode, maxUses: e.target.value })}
                placeholder={newCode.usageType === 'limited' ? 'e.g., 100' : 'Unlimited'}
                required={newCode.usageType === 'limited'}
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Min Order Value (₹)</Label>
              <Input
                type="number"
                value={newCode.minOrderValue}
                onChange={(e) => setNewCode({ ...newCode, minOrderValue: e.target.value })}
                placeholder="0"
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Max Discount Cap (₹)</Label>
              <Input
                type="number"
                value={newCode.maxDiscount}
                onChange={(e) => setNewCode({ ...newCode, maxDiscount: e.target.value })}
                placeholder="No cap"
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Expires At {newCode.usageType === 'time_bound' ? '*' : '(optional)'}</Label>
              <Input
                type="datetime-local"
                value={newCode.expiresAt}
                onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
                required={newCode.usageType === 'time_bound'}
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <div className="md:col-span-4">
              <Label className="text-slate-700 dark:text-slate-300">Description</Label>
              <Input
                value={newCode.description}
                onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                placeholder="e.g., 5% off on orders above ₹2,499"
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
              />
            </div>
            <div className="md:col-span-4 flex gap-2">
              <Button type="submit" className="text-white bg-slate-800 hover:bg-slate-700" data-testid="create-discount-btn">
                Create Code
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNewCodeForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Code</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Discount</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Type</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Usage</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Min Order</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {discountCodes.map((code) => (
              <tr key={code._id || code.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td className="px-4 py-3 font-mono font-bold" style={{ color: 'var(--metallic-gold)' }}>
                  {code.code}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {code.discount_type === 'percentage' ? `${code.discount_value}%` : `₹${code.discount_value}`}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    code.usage_type === 'universal' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    code.usage_type === 'single_per_user' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                    code.usage_type === 'limited' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {code.usage_type === 'universal' ? 'Universal' :
                     code.usage_type === 'single_per_user' ? 'Single/User' :
                     code.usage_type === 'limited' ? 'Limited' : 'Time-Bound'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                  {code.times_used || 0} / {code.max_uses || '∞'}
                </td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">₹{code.min_order_value || 0}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    code.is_active 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {code.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {code.is_active && (
                    <button
                      onClick={() => deleteDiscountCode(code._id || code.id)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      data-testid={`delete-code-${code.code}`}
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {discountCodes.length === 0 && (
          <div className="text-center py-12">
            <Tag size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">No discount codes yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiscountsTab;
