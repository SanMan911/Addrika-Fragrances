import React from 'react';
import { DollarSign, Package, Users, MessageSquare } from 'lucide-react';

const OverviewTab = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" data-testid="overview-tab">
      {/* Revenue Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <DollarSign size={24} style={{ color: 'var(--metallic-gold)' }} />
          <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
            Revenue
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          ₹{(stats.revenue?.total || 0).toLocaleString('en-IN')}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
      </div>

      {/* Orders Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <Package size={24} style={{ color: 'var(--metallic-gold)' }} />
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            Orders
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          {stats.orders?.total || 0}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {stats.orders?.pending || 0} pending
        </p>
      </div>

      {/* Users Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <Users size={24} style={{ color: 'var(--metallic-gold)' }} />
          <span className="text-xs px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            Users
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          {stats.users?.total || 0}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">Registered Users</p>
      </div>

      {/* Inquiries Card */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <MessageSquare size={24} style={{ color: 'var(--metallic-gold)' }} />
          <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
            Inquiries
          </span>
        </div>
        <p className="text-3xl font-bold text-slate-800 dark:text-slate-100">
          {stats.inquiries?.total || 0}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {stats.inquiries?.pending || 0} pending
        </p>
      </div>
    </div>
  );
};

export default OverviewTab;
