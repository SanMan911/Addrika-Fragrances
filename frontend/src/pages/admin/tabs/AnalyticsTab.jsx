import React from 'react';
import { TrendingUp, TrendingDown, RefreshCw, BarChart3 } from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, Area, AreaChart 
} from 'recharts';
import { Button } from '../../../components/ui/button';

const AnalyticsTab = ({
  revenueTrends,
  orderStats,
  analyticsPeriod,
  setAnalyticsPeriod,
  analyticsDays,
  setAnalyticsDays,
  loadingAnalytics,
  fetchAnalytics
}) => {
  return (
    <div className="space-y-6" data-testid="analytics-tab">
      {/* Analytics Header with Controls */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Revenue Analytics</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Track your business performance over time</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Period Selector */}
            <select
              value={analyticsPeriod}
              onChange={(e) => setAnalyticsPeriod(e.target.value)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              data-testid="analytics-period-select"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            
            {/* Days Selector */}
            <select
              value={analyticsDays}
              onChange={(e) => setAnalyticsDays(parseInt(e.target.value))}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              data-testid="analytics-days-select"
            >
              <option value={7}>Last 7 Days</option>
              <option value={30}>Last 30 Days</option>
              <option value={90}>Last 90 Days</option>
              <option value={180}>Last 6 Months</option>
              <option value={365}>Last Year</option>
            </select>
            
            <Button
              onClick={fetchAnalytics}
              variant="outline"
              size="sm"
              disabled={loadingAnalytics}
              className="flex items-center gap-2"
            >
              <RefreshCw size={16} className={loadingAnalytics ? 'animate-spin' : ''} />
              Refresh
            </Button>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Revenue</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              ₹{(revenueTrends.summary?.total_revenue || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Total Orders</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              {revenueTrends.summary?.total_orders || 0}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Avg Order Value</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              ₹{(revenueTrends.summary?.avg_order_value || 0).toLocaleString('en-IN')}
            </p>
          </div>
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Growth</p>
            <div className="flex items-center gap-2">
              {(revenueTrends.summary?.growth_percentage || 0) >= 0 ? (
                <TrendingUp className="text-green-500" size={20} />
              ) : (
                <TrendingDown className="text-red-500" size={20} />
              )}
              <p className={`text-2xl font-bold ${
                (revenueTrends.summary?.growth_percentage || 0) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {revenueTrends.summary?.growth_percentage || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Revenue Line Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Revenue Trend</h3>
        {loadingAnalytics ? (
          <div className="h-80 flex items-center justify-center">
            <RefreshCw className="animate-spin text-slate-400" size={32} />
          </div>
        ) : revenueTrends.data?.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueTrends.data}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis 
                  dataKey="label" 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickLine={{ stroke: 'currentColor' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickLine={{ stroke: 'currentColor' }}
                  tickFormatter={(value) => `₹${value.toLocaleString('en-IN')}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--tooltip-bg, #fff)', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                  formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#8884d8" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <TrendingUp size={48} className="mx-auto mb-4 opacity-30" />
              <p>No revenue data available for the selected period</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Orders Bar Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Orders by Period</h3>
        {loadingAnalytics ? (
          <div className="h-80 flex items-center justify-center">
            <RefreshCw className="animate-spin text-slate-400" size={32} />
          </div>
        ) : revenueTrends.data?.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueTrends.data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                <XAxis 
                  dataKey="label" 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickLine={{ stroke: 'currentColor' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'currentColor' }}
                  tickLine={{ stroke: 'currentColor' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--tooltip-bg, #fff)', 
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px'
                  }}
                  formatter={(value, name) => {
                    if (name === 'orders') return [value, 'Orders'];
                    return [`₹${value.toLocaleString('en-IN')}`, 'Avg Order'];
                  }}
                />
                <Legend />
                <Bar dataKey="orders" fill="#22c55e" name="Orders" radius={[4, 4, 0, 0]} />
                <Bar dataKey="avg_order" fill="#3b82f6" name="Avg Order (₹)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <BarChart3 size={48} className="mx-auto mb-4 opacity-30" />
              <p>No order data available for the selected period</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Order Status & Payment Distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Order Status Distribution</h3>
          <div className="space-y-3">
            {Object.entries(orderStats.status_distribution || {}).map(([status, data]) => {
              const total = Object.values(orderStats.status_distribution || {}).reduce((sum, d) => sum + d.count, 0);
              const percentage = total > 0 ? Math.round((data.count / total) * 100) : 0;
              const statusColors = {
                pending: 'bg-yellow-500',
                confirmed: 'bg-blue-500',
                processing: 'bg-purple-500',
                shipped: 'bg-indigo-500',
                delivered: 'bg-green-500',
                rto: 'bg-orange-500',
                cancelled: 'bg-red-500'
              };
              return (
                <div key={status} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${statusColors[status] || 'bg-gray-500'}`}></div>
                    <span className="text-sm capitalize text-slate-700 dark:text-slate-300">{status}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{data.count}</span>
                    <div className="w-24 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${statusColors[status] || 'bg-gray-500'}`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500 w-10">{percentage}%</span>
                  </div>
                </div>
              );
            })}
            {Object.keys(orderStats.status_distribution || {}).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No order data available</p>
            )}
          </div>
        </div>
        
        {/* Payment Method Distribution */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">Payment Methods</h3>
          <div className="space-y-3">
            {Object.entries(orderStats.payment_distribution || {}).map(([method, data]) => {
              const total = Object.values(orderStats.payment_distribution || {}).reduce((sum, d) => sum + d.revenue, 0);
              const percentage = total > 0 ? Math.round((data.revenue / total) * 100) : 0;
              return (
                <div key={method} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-sm text-slate-700 dark:text-slate-300">{method}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      ₹{data.revenue.toLocaleString('en-IN')}
                    </span>
                    <div className="w-24 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-500 w-10">{percentage}%</span>
                  </div>
                </div>
              );
            })}
            {Object.keys(orderStats.payment_distribution || {}).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No payment data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
