import React from 'react';
import { DollarSign, Tag, Users, BarChart3, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const CouponUsageTab = ({
  discountUsage,
  discountPerformance,
  setShowPurgeCouponUsageModal
}) => {
  return (
    <div className="space-y-6" data-testid="coupon-usage-tab">
      {/* Usage Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Discount Given</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                ₹{discountUsage.stats?.total_discount_amount || 0}
              </p>
            </div>
            <DollarSign size={32} style={{ color: 'var(--metallic-gold)' }} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Total Coupon Uses</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {discountUsage.stats?.total_uses || 0}
              </p>
            </div>
            <Tag size={32} style={{ color: 'var(--metallic-gold)' }} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-6 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Unique Customers</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                {discountUsage.stats?.unique_users || 0}
              </p>
            </div>
            <Users size={32} style={{ color: 'var(--metallic-gold)' }} />
          </div>
        </div>
      </div>

      {/* Usage Logs Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Coupon Usage History ({discountUsage.logs?.length || 0})
          </h2>
          {(discountUsage.logs?.length || 0) > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowPurgeCouponUsageModal(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="purge-all-coupon-usage-btn"
            >
              <Trash2 size={16} className="mr-1" />
              Purge All Usage
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Order #</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Cart Total</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">Used At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700 text-slate-700 dark:text-slate-300">
              {(discountUsage.logs || []).map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold" style={{ color: 'var(--metallic-gold)' }}>
                      {log.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm">{log.order_number}</td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm">{log.email}</p>
                      {log.user_id && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">ID: {log.user_id}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">₹{log.cart_total?.toFixed(2) || '0.00'}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-600 dark:text-green-400 font-semibold">
                      -₹{log.discount_amount?.toFixed(2) || '0.00'}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 block">
                      ({log.discount_type === 'percentage' ? `${log.discount_value}%` : `₹${log.discount_value}`})
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    {(() => {
                      const date = new Date(log.used_at);
                      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = months[date.getMonth()];
                      const year = date.getFullYear();
                      const hours = String(date.getHours()).padStart(2, '0');
                      const minutes = String(date.getMinutes()).padStart(2, '0');
                      return `${day}${month}${year} ${hours}:${minutes}`;
                    })()} IST
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(discountUsage.logs || []).length === 0 && (
            <div className="text-center py-12">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
              <p className="text-slate-500 dark:text-slate-400">No coupon usage recorded yet</p>
              <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">
                Usage is logged when orders with discount codes are paid successfully
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Performance Report Section */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Performance Report
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Which discount codes drive the most sales</p>
        </div>

        {/* Performance Summary */}
        {discountPerformance.summary && Object.keys(discountPerformance.summary).length > 0 && (
          <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-slate-200 dark:border-slate-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {discountPerformance.summary.total_codes_used || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Codes Used</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  ₹{discountPerformance.summary.net_revenue || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Net Revenue</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-500 dark:text-red-400">
                  ₹{discountPerformance.summary.total_discount_given || 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Total Discount Given</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold" style={{ color: 'var(--metallic-gold)' }}>
                  {discountPerformance.summary.avg_discount_percentage || 0}%
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Avg Discount %</p>
              </div>
            </div>
          </div>
        )}

        {/* Performance Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Uses</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Customers</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cart Value</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Discount Given</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net Revenue</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Avg Order</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ROI</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {(discountPerformance.performance || []).map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <span className="font-mono font-bold" style={{ color: 'var(--metallic-gold)' }}>
                      {item.code}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">
                      {item.discount_type === 'percentage' ? `${item.discount_value}% off` : `₹${item.discount_value} off`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-300">{item.total_uses}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{item.unique_customers}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">₹{item.total_cart_value}</td>
                  <td className="px-4 py-3 text-red-500 dark:text-red-400">-₹{item.total_discount_given}</td>
                  <td className="px-4 py-3 font-semibold text-green-600 dark:text-green-400">₹{item.net_revenue}</td>
                  <td className="px-4 py-3 text-slate-700 dark:text-slate-300">₹{item.avg_cart_value}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${item.roi >= 10 ? 'text-green-600 dark:text-green-400' : item.roi >= 5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-500 dark:text-red-400'}`}>
                      {item.roi}x
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${item.is_active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'}`}>
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(discountPerformance.performance || []).length === 0 && (
            <div className="text-center py-8">
              <p className="text-slate-500 dark:text-slate-400">No performance data yet</p>
              <p className="text-sm mt-1 text-slate-400 dark:text-slate-500">
                Data appears after orders with discounts are completed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CouponUsageTab;
