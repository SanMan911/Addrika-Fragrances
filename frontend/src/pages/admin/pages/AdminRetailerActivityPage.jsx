import React, { useState, useEffect } from 'react';
import { 
  Activity, ShoppingCart, Package, TrendingUp, Star, Award,
  Users, RefreshCw, Search, Eye, AlertTriangle, CheckCircle, 
  MapPin, BadgeCheck, Store, ArrowUpRight, ArrowDownRight,
  Trophy, Target, X
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, Area, AreaChart
} from 'recharts';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Color palette
const COLORS = {
  primary: '#d97706',
  success: '#16a34a',
  danger: '#dc2626',
  info: '#2563eb',
  purple: '#7c3aed',
  slate: '#64748b'
};

const PIE_COLORS = ['#d97706', '#16a34a', '#2563eb', '#7c3aed', '#ec4899', '#14b8a6'];

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, subValue, color, trend }) => (
  <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-start justify-between">
      <div className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-sm font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(trend)}%
        </div>
      )}
    </div>
    <p className="text-2xl font-bold text-gray-900 mt-4">{value}</p>
    <p className="text-sm text-gray-500">{label}</p>
    {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
  </div>
);

// Star Badge Component
const StarBadge = ({ eligible }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
    eligible ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
  }`}>
    <Star className={`w-3 h-3 ${eligible ? 'fill-amber-500' : ''}`} />
    {eligible ? 'Star Eligible' : 'Not Eligible'}
  </span>
);

// Verified Badge Component
const VerifiedBadge = ({ verified, partner }) => (
  <div className="flex gap-1 flex-wrap">
    {verified && (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
        <CheckCircle className="w-3 h-3" /> Verified
      </span>
    )}
    {partner && (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        <BadgeCheck className="w-3 h-3" /> Partner
      </span>
    )}
  </div>
);

// Top Performer Card
const TopPerformerCard = ({ rank, retailer, metric, metricLabel, icon: Icon }) => (
  <div className={`flex items-center gap-3 p-3 rounded-lg ${
    rank === 1 ? 'bg-amber-50 border border-amber-200' : 
    rank === 2 ? 'bg-gray-50 border border-gray-200' : 
    'bg-orange-50/50 border border-orange-200'
  }`}>
    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
      rank === 1 ? 'bg-amber-500' : rank === 2 ? 'bg-gray-400' : 'bg-orange-400'
    }`}>
      {rank === 1 ? <Trophy className="w-5 h-5" /> : rank}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-medium text-gray-900 truncate">{retailer.business_name || retailer.name}</p>
      <p className="text-xs text-gray-500">{retailer.city}</p>
    </div>
    <div className="text-right">
      <p className="font-bold text-gray-900">{metric}</p>
      <p className="text-xs text-gray-500">{metricLabel}</p>
    </div>
  </div>
);

// Custom Tooltip for Charts
const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString('en-IN') : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AdminRetailerActivityPage = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [retailerDetail, setRetailerDetail] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [pickupReport, setPickupReport] = useState(null);
  const [reportPeriod, setReportPeriod] = useState('quarter');

  const fetchWithAuth = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || 'Request failed');
    }
    return response.json();
  };

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth(`${API_URL}/api/admin/retailers/activity-dashboard`);
      setDashboardData(data);
    } catch (error) {
      toast.error('Failed to load dashboard: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadRetailerDetail = async (retailerId) => {
    try {
      const data = await fetchWithAuth(`${API_URL}/api/admin/retailers/${retailerId}/activity`);
      setRetailerDetail(data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error('Failed to load retailer details: ' + error.message);
    }
  };

  const loadPickupReport = async () => {
    try {
      const data = await fetchWithAuth(`${API_URL}/api/admin/retailers/self-pickup-report?period=${reportPeriod}`);
      setPickupReport(data);
    } catch (error) {
      toast.error('Failed to load pickup report: ' + error.message);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'pickup-report') {
      loadPickupReport();
    }
  }, [activeTab, reportPeriod]);

  const filteredRetailers = dashboardData?.retailers?.filter(r => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      r.business_name?.toLowerCase().includes(search) ||
      r.retailer_id?.toLowerCase().includes(search) ||
      r.city?.toLowerCase().includes(search)
    );
  }) || [];

  // Prepare chart data
  const getTopPerformersData = () => {
    if (!dashboardData?.retailers) return [];
    return dashboardData.retailers
      .filter(r => r.completed_pickups > 0)
      .sort((a, b) => b.completed_pickups - a.completed_pickups)
      .slice(0, 8)
      .map(r => ({
        name: r.business_name?.substring(0, 15) || 'Unknown',
        pickups: r.completed_pickups,
        items: r.items_90d,
        revenue: r.revenue_90d
      }));
  };

  const getAbandonedByCity = () => {
    if (!dashboardData?.retailers) return [];
    const cityMap = {};
    dashboardData.retailers.forEach(r => {
      const city = r.city || 'Unknown';
      if (!cityMap[city]) {
        cityMap[city] = { name: city, abandoned: 0, value: 0 };
      }
      cityMap[city].abandoned += r.abandoned_carts_30d || 0;
      cityMap[city].value += r.abandoned_value_30d || 0;
    });
    return Object.values(cityMap)
      .filter(c => c.abandoned > 0)
      .sort((a, b) => b.abandoned - a.abandoned)
      .slice(0, 6);
  };

  const getPickupDistribution = () => {
    if (!dashboardData?.retailers) return [];
    const starEligible = dashboardData.retailers.filter(r => r.star_eligible).length;
    const active = dashboardData.retailers.filter(r => !r.star_eligible && r.completed_pickups > 0).length;
    const inactive = dashboardData.retailers.filter(r => r.completed_pickups === 0).length;
    return [
      { name: 'Star Eligible', value: starEligible },
      { name: 'Active', value: active },
      { name: 'Inactive', value: inactive }
    ].filter(d => d.value > 0);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Activity },
    { id: 'abandoned', label: 'Abandoned Carts', icon: ShoppingCart },
    { id: 'pickup-report', label: 'Self-Pickup Report', icon: Package },
  ];

  return (
    <div className="space-y-6" data-testid="admin-retailer-activity-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Retailer Activity Dashboard</h1>
          <p className="text-gray-500 mt-1">Track performance, abandoned carts & Star Retailer eligibility</p>
        </div>
        <button
          onClick={loadDashboard}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          data-testid="refresh-dashboard-btn"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      {dashboardData && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={Store}
            label="Active Retailers"
            value={dashboardData.summary.active_retailers}
            subValue={`${dashboardData.summary.total_retailers} total`}
            color="bg-blue-500"
          />
          <StatCard 
            icon={Star}
            label="Star Eligible"
            value={dashboardData.summary.star_eligible_retailers}
            subValue="50+ items in 90 days"
            color="bg-amber-500"
          />
          <StatCard 
            icon={AlertTriangle}
            label="Abandoned Carts (30d)"
            value={dashboardData.summary.abandoned_carts_30d}
            subValue={`₹${dashboardData.summary.abandoned_value_30d?.toLocaleString('en-IN') || 0}`}
            color="bg-red-500"
          />
          <StatCard 
            icon={Package}
            label="Pickups Completed"
            value={dashboardData.summary.total_pickups_completed}
            subValue={`${dashboardData.summary.total_pickups_pending} pending`}
            color="bg-green-500"
          />
        </div>
      )}

      {/* Tabs Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 p-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`tab-${tab.id}`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <RefreshCw className="w-8 h-8 text-amber-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* ============ OVERVIEW TAB ============ */}
              {activeTab === 'overview' && dashboardData && (
                <div className="space-y-8">
                  
                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Top Performers Bar Chart */}
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        Top Performers by Pickups
                      </h3>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={getTopPerformersData()} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="pickups" fill={COLORS.success} radius={[0, 4, 4, 0]} name="Pickups" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Retailer Distribution Pie Chart */}
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Target className="w-5 h-5 text-blue-500" />
                        Retailer Performance Distribution
                      </h3>
                      <div className="h-64 flex items-center justify-center">
                        {getPickupDistribution().length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={getPickupDistribution()}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                              >
                                {getPickupDistribution().map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <p className="text-gray-500">No data available</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Top 3 Performers Quick View */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Top by Pickups
                      </h4>
                      <div className="space-y-2">
                        {filteredRetailers
                          .sort((a, b) => b.completed_pickups - a.completed_pickups)
                          .slice(0, 3)
                          .map((r, idx) => (
                            <TopPerformerCard 
                              key={r.retailer_id}
                              rank={idx + 1}
                              retailer={r}
                              metric={r.completed_pickups}
                              metricLabel="pickups"
                            />
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <Star className="w-4 h-4" /> Top by Items (90d)
                      </h4>
                      <div className="space-y-2">
                        {filteredRetailers
                          .sort((a, b) => b.items_90d - a.items_90d)
                          .slice(0, 3)
                          .map((r, idx) => (
                            <TopPerformerCard 
                              key={r.retailer_id}
                              rank={idx + 1}
                              retailer={r}
                              metric={r.items_90d}
                              metricLabel="items"
                            />
                          ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Top by Revenue (90d)
                      </h4>
                      <div className="space-y-2">
                        {filteredRetailers
                          .sort((a, b) => b.revenue_90d - a.revenue_90d)
                          .slice(0, 3)
                          .map((r, idx) => (
                            <TopPerformerCard 
                              key={r.retailer_id}
                              rank={idx + 1}
                              retailer={r}
                              metric={`₹${(r.revenue_90d || 0).toLocaleString('en-IN')}`}
                              metricLabel="revenue"
                            />
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Search & Full Table */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                      <h3 className="text-lg font-semibold text-gray-900">All Retailers</h3>
                      <div className="relative max-w-md flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search by name, ID, or city..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          data-testid="search-retailers"
                        />
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full" data-testid="retailers-activity-table">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Retailer</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Abandoned (30d)</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Pickups</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Items (90d)</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Revenue (90d)</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredRetailers.slice(0, 50).map((retailer) => (
                            <tr key={retailer.retailer_id} className={`hover:bg-gray-50 ${retailer.star_eligible ? 'bg-amber-50/30' : ''}`}>
                              <td className="px-4 py-3">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  retailer.rank <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {retailer.rank}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{retailer.business_name}</p>
                                  <p className="text-sm text-gray-500 flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {retailer.city}, {retailer.state}
                                  </p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className={retailer.abandoned_carts_30d > 5 ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                                  {retailer.abandoned_carts_30d}
                                  {retailer.abandoned_value_30d > 0 && (
                                    <p className="text-xs text-gray-400">₹{retailer.abandoned_value_30d?.toLocaleString('en-IN')}</p>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-green-600 font-semibold">{retailer.completed_pickups}</span>
                                <span className="text-gray-400">/{retailer.total_pickups}</span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-semibold ${retailer.items_90d >= 50 ? 'text-amber-600' : 'text-gray-600'}`}>
                                  {retailer.items_90d}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-700">
                                ₹{retailer.revenue_90d?.toLocaleString('en-IN') || 0}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <StarBadge eligible={retailer.star_eligible} />
                                  <VerifiedBadge verified={retailer.is_verified} partner={retailer.is_addrika_verified_partner} />
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => loadRetailerDetail(retailer.retailer_id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
                                  data-testid={`view-${retailer.retailer_id}`}
                                >
                                  <Eye className="w-4 h-4" />
                                  Details
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {filteredRetailers.length === 0 && (
                      <div className="text-center py-12">
                        <Store className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">No retailers found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ============ ABANDONED CARTS TAB ============ */}
              {activeTab === 'abandoned' && dashboardData && (
                <div className="space-y-6">
                  {/* Alert Banner */}
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-red-800">Abandoned Carts Summary</h3>
                        <p className="text-sm text-red-700 mt-1">
                          <strong>{dashboardData.summary.abandoned_carts_30d}</strong> carts abandoned in the last 30 days 
                          with a total value of <strong>₹{(dashboardData.summary.abandoned_value_30d || 0).toLocaleString('en-IN')}</strong>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Abandoned by City Bar Chart */}
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Abandoned Carts by City</h3>
                      <div className="h-64">
                        {getAbandonedByCity().length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getAbandonedByCity()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="abandoned" fill={COLORS.danger} radius={[4, 4, 0, 0]} name="Abandoned Carts" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-gray-500">No abandoned carts data</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lost Value by City */}
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Lost Value by City (₹)</h3>
                      <div className="h-64">
                        {getAbandonedByCity().length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={getAbandonedByCity()}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="value" fill={COLORS.primary} radius={[4, 4, 0, 0]} name="Lost Value (₹)" />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center">
                            <p className="text-gray-500">No data available</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Retailers with most abandoned carts */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Retailers by Abandoned Carts (30 days)</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Retailer</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Abandoned Carts</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Lost Value</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Completed Pickups</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Conversion Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredRetailers
                            .filter(r => r.abandoned_carts_30d > 0)
                            .sort((a, b) => b.abandoned_carts_30d - a.abandoned_carts_30d)
                            .slice(0, 20)
                            .map((retailer) => {
                              const totalCarts = retailer.abandoned_carts_30d + retailer.completed_pickups;
                              const conversionRate = totalCarts > 0 ? (retailer.completed_pickups / totalCarts * 100) : 0;
                              return (
                                <tr key={retailer.retailer_id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3">
                                    <p className="font-medium text-gray-900">{retailer.business_name}</p>
                                    <p className="text-sm text-gray-500">{retailer.city}</p>
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className="text-red-600 font-bold text-lg">{retailer.abandoned_carts_30d}</span>
                                  </td>
                                  <td className="px-4 py-3 text-center text-red-600">
                                    ₹{(retailer.abandoned_value_30d || 0).toLocaleString('en-IN')}
                                  </td>
                                  <td className="px-4 py-3 text-center text-green-600 font-semibold">
                                    {retailer.completed_pickups}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`font-semibold ${conversionRate >= 80 ? 'text-green-600' : conversionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                      {conversionRate.toFixed(1)}%
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                      {filteredRetailers.filter(r => r.abandoned_carts_30d > 0).length === 0 && (
                        <div className="text-center py-8">
                          <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                          <p className="text-gray-500">No abandoned carts in the last 30 days</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ============ SELF-PICKUP REPORT TAB ============ */}
              {activeTab === 'pickup-report' && (
                <div className="space-y-6">
                  {/* Period Filter */}
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium text-gray-700">Period:</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'month', label: 'This Month' },
                        { value: 'quarter', label: 'This Quarter' },
                        { value: 'year', label: 'This Year' },
                        { value: 'all', label: 'All Time' }
                      ].map(p => (
                        <button
                          key={p.value}
                          onClick={() => setReportPeriod(p.value)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                            reportPeriod === p.value 
                              ? 'bg-amber-500 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                          data-testid={`period-${p.value}`}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Star Retailer Criteria Banner */}
                  <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-5">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                        <Star className="w-6 h-6 text-white fill-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-amber-900 text-lg">Star Retailer Program</h3>
                        <p className="text-sm text-amber-700 mt-1">
                          {pickupReport?.star_retailer_criteria?.description || 'Retailers who have fulfilled 50+ items via self-pickup'}
                        </p>
                        <div className="flex items-center gap-4 mt-3">
                          <div className="bg-white rounded-lg px-4 py-2 border border-amber-200">
                            <p className="text-2xl font-bold text-amber-600">{pickupReport?.summary?.star_eligible_retailers || 0}</p>
                            <p className="text-xs text-amber-700">Eligible</p>
                          </div>
                          <div className="bg-white rounded-lg px-4 py-2 border border-amber-200">
                            <p className="text-2xl font-bold text-gray-600">{(pickupReport?.summary?.total_retailers_with_pickups || 0) - (pickupReport?.summary?.star_eligible_retailers || 0)}</p>
                            <p className="text-xs text-gray-600">Progressing</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Report Summary Cards */}
                  {pickupReport && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
                        <p className="text-3xl font-bold text-gray-900">{pickupReport.summary.total_retailers_with_pickups}</p>
                        <p className="text-sm text-gray-500 mt-1">Retailers with Pickups</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
                        <p className="text-3xl font-bold text-green-600">{pickupReport.summary.total_pickups}</p>
                        <p className="text-sm text-gray-500 mt-1">Total Pickups</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
                        <p className="text-3xl font-bold text-blue-600">{pickupReport.summary.total_items_fulfilled}</p>
                        <p className="text-sm text-gray-500 mt-1">Items Fulfilled</p>
                      </div>
                      <div className="bg-white rounded-xl border border-gray-200 p-5 text-center shadow-sm">
                        <p className="text-3xl font-bold text-amber-600">₹{pickupReport.summary.total_revenue?.toLocaleString('en-IN')}</p>
                        <p className="text-sm text-gray-500 mt-1">Revenue Generated</p>
                      </div>
                    </div>
                  )}

                  {/* Pickup Performance Chart */}
                  {pickupReport?.report?.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-5">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Items Fulfilled - Top 10 Retailers</h3>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={pickupReport.report.slice(0, 10)} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis 
                              dataKey="business_name" 
                              type="category" 
                              width={120} 
                              tick={{ fontSize: 11 }}
                              tickFormatter={(value) => value?.substring(0, 15) + (value?.length > 15 ? '...' : '')}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Bar dataKey="total_items" fill={COLORS.primary} radius={[0, 4, 4, 0]} name="Items" />
                            <Bar dataKey="pickup_count" fill={COLORS.success} radius={[0, 4, 4, 0]} name="Pickups" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Leaderboard Table */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-gray-900">Self-Pickup Leaderboard - {pickupReport?.period_label}</h3>
                    <div className="overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full" data-testid="pickup-leaderboard">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rank</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Retailer</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Pickups</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Items</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Revenue</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Customers</th>
                            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase">Star Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {pickupReport?.report?.slice(0, 30).map((retailer) => (
                            <tr key={retailer.retailer_id} className={`hover:bg-gray-50 ${retailer.star_eligible ? 'bg-amber-50/50' : ''}`}>
                              <td className="px-4 py-3">
                                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                  retailer.rank <= 3 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                                }`}>
                                  {retailer.rank === 1 ? <Trophy className="w-4 h-4" /> : retailer.rank}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-gray-900">{retailer.business_name}</p>
                                  <p className="text-sm text-gray-500">{retailer.city}, {retailer.state}</p>
                                  {retailer.current_label && (
                                    <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded mt-1 inline-block">
                                      {retailer.current_label.replace('_', ' ')}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center font-semibold text-gray-700">
                                {retailer.pickup_count}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`font-bold ${retailer.star_eligible ? 'text-amber-600' : 'text-gray-600'}`}>
                                  {retailer.total_items}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center text-gray-700">
                                ₹{retailer.total_revenue?.toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-3 text-center text-blue-600 font-medium">
                                {retailer.unique_customers}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <StarBadge eligible={retailer.star_eligible} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {(!pickupReport?.report || pickupReport.report.length === 0) && (
                        <div className="text-center py-12">
                          <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                          <p className="text-gray-500">No pickup data for this period</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ============ RETAILER DETAIL MODAL ============ */}
      {showDetailModal && retailerDetail && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" data-testid="retailer-detail-modal">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{retailerDetail.retailer.business_name}</h2>
                <p className="text-sm text-gray-500 flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {retailerDetail.retailer.city}, {retailerDetail.retailer.state}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)] space-y-6">
              {/* 90-Day Performance */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                  90-Day Performance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{retailerDetail.performance_90d.pickups_completed}</p>
                    <p className="text-sm text-green-700">Pickups</p>
                  </div>
                  <div className="bg-blue-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-blue-600">{retailerDetail.performance_90d.items_fulfilled}</p>
                    <p className="text-sm text-blue-700">Items</p>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-amber-600">₹{retailerDetail.performance_90d.revenue?.toLocaleString('en-IN')}</p>
                    <p className="text-sm text-amber-700">Revenue</p>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <StarBadge eligible={retailerDetail.performance_90d.star_eligible} />
                    <p className="text-sm text-purple-700 mt-2">Star Status</p>
                  </div>
                </div>
              </div>

              {/* Monthly Trends Chart */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-4">Monthly Trends (6 months)</h3>
                <div className="bg-gray-50 rounded-xl p-4 h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={retailerDetail.monthly_trends}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend />
                      <Area type="monotone" dataKey="pickups_completed" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.3} name="Pickups" />
                      <Area type="monotone" dataKey="abandoned_carts" stroke={COLORS.danger} fill={COLORS.danger} fillOpacity={0.3} name="Abandoned" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two Column Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Abandoned Carts */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Abandoned Carts ({retailerDetail.abandoned_carts.total_30d} in 30d)
                  </h3>
                  {retailerDetail.abandoned_carts.recent.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {retailerDetail.abandoned_carts.recent.slice(0, 5).map((cart, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-red-50 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{cart.items?.length || 0} items</p>
                            <p className="text-xs text-gray-500">
                              {new Date(cart.updated_at).toLocaleDateString('en-IN')}
                            </p>
                          </div>
                          <p className="text-red-600 font-semibold">₹{cart.total?.toLocaleString('en-IN') || 0}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                      <p className="text-green-700 text-sm">No abandoned carts</p>
                    </div>
                  )}
                </div>

                {/* Recent Pickup Orders */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Package className="w-4 h-4 text-green-500" />
                    Recent Pickups ({retailerDetail.pickup_orders.total} total)
                  </h3>
                  {retailerDetail.pickup_orders.recent.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {retailerDetail.pickup_orders.recent.slice(0, 5).map((order, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{order.order_id}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(order.created_at).toLocaleDateString('en-IN')} • {order.order_status}
                            </p>
                          </div>
                          <p className="text-green-600 font-semibold">₹{order.total?.toLocaleString('en-IN') || 0}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-50 rounded-lg p-4 text-center">
                      <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No pickup orders yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRetailerActivityPage;
