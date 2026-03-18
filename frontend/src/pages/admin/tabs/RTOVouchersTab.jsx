import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { 
  Ticket, RefreshCw, XCircle, Ban, CheckCircle, Clock, 
  AlertTriangle, Search, ChevronDown, ChevronUp, Package
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../components/ui/select';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RTOVouchersTab = () => {
  const [vouchers, setVouchers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedVoucher, setExpandedVoucher] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Fetch vouchers
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      params.append('limit', '100');

      const response = await axios.get(
        `${API_URL}/api/admin/rto-vouchers?${params.toString()}`,
        { withCredentials: true }
      );
      setVouchers(response.data.vouchers || []);
    } catch (error) {
      console.error('Failed to fetch RTO vouchers:', error);
      toast.error('Failed to load RTO vouchers');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API_URL}/api/admin/rto-vouchers/stats/summary`,
        { withCredentials: true }
      );
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    fetchVouchers();
    fetchStats();
  }, [fetchVouchers, fetchStats]);

  // Cancel voucher
  const handleCancelVoucher = async (voucherCode, updateOrderStatus = null) => {
    setActionLoading(voucherCode);
    try {
      const body = {
        reason: 'Cancelled by admin - RTO issue resolved'
      };
      if (updateOrderStatus) {
        body.new_order_status = updateOrderStatus;
      }

      await axios.post(
        `${API_URL}/api/admin/rto-vouchers/${voucherCode}/cancel`,
        body,
        { withCredentials: true }
      );
      toast.success(`Voucher ${voucherCode} cancelled successfully`);
      fetchVouchers();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel voucher');
    } finally {
      setActionLoading(null);
    }
  };

  // Void voucher
  const handleVoidVoucher = async (voucherCode) => {
    setActionLoading(voucherCode);
    try {
      await axios.post(
        `${API_URL}/api/admin/rto-vouchers/${voucherCode}/void`,
        { reason: 'Voided by admin' },
        { withCredentials: true }
      );
      toast.success(`Voucher ${voucherCode} voided successfully`);
      fetchVouchers();
      fetchStats();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to void voucher');
    } finally {
      setActionLoading(null);
    }
  };

  // Filter vouchers by search
  const filteredVouchers = vouchers.filter(v => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      v.voucher_code?.toLowerCase().includes(query) ||
      v.order_number?.toLowerCase().includes(query) ||
      v.user_email?.toLowerCase().includes(query) ||
      v.customer_name?.toLowerCase().includes(query)
    );
  });

  // Status badge component
  const StatusBadge = ({ status }) => {
    const config = {
      active: { color: 'bg-green-500/20 text-green-400 border-green-500/30', icon: CheckCircle },
      used: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: Ticket },
      cancelled: { color: 'bg-red-500/20 text-red-400 border-red-500/30', icon: XCircle },
      voided: { color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: Ban },
      expired: { color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', icon: Clock }
    };
    const { color, icon: Icon } = config[status] || config.active;
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${color}`}>
        <Icon size={12} />
        {status?.toUpperCase()}
      </span>
    );
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Ticket className="text-amber-500" size={28} />
          <div>
            <h2 className="text-2xl font-bold text-slate-100">RTO Vouchers</h2>
            <p className="text-sm text-slate-400">Manage Return-to-Origin vouchers</p>
          </div>
        </div>
        <Button
          onClick={() => { fetchVouchers(); fetchStats(); }}
          variant="outline"
          size="sm"
          className="border-slate-600"
        >
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-green-400 mb-1">
              <CheckCircle size={16} />
              <span className="text-xs font-medium">Active</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{stats.by_status.active.count}</p>
            <p className="text-xs text-slate-400">₹{stats.by_status.active.total_value.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-blue-400 mb-1">
              <Ticket size={16} />
              <span className="text-xs font-medium">Used</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{stats.by_status.used.count}</p>
            <p className="text-xs text-slate-400">₹{stats.by_status.used.total_value.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <XCircle size={16} />
              <span className="text-xs font-medium">Cancelled</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{stats.by_status.cancelled.count}</p>
            <p className="text-xs text-slate-400">₹{stats.by_status.cancelled.total_value.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
            <div className="flex items-center gap-2 text-orange-400 mb-1">
              <Ban size={16} />
              <span className="text-xs font-medium">Voided</span>
            </div>
            <p className="text-2xl font-bold text-slate-100">{stats.by_status.voided.count}</p>
            <p className="text-xs text-slate-400">₹{stats.by_status.voided.total_value.toLocaleString()}</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <AlertTriangle size={16} />
              <span className="text-xs font-medium">Active Liability</span>
            </div>
            <p className="text-2xl font-bold text-amber-400">₹{stats.active_liability.toLocaleString()}</p>
            <p className="text-xs text-slate-400">Potential redemption</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <Input
            placeholder="Search by code, order, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40 bg-slate-800 border-slate-700">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="used">Used</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Vouchers List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="animate-spin text-amber-500" size={32} />
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Ticket size={48} className="mx-auto mb-4 opacity-50" />
          <p>No RTO vouchers found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredVouchers.map((voucher) => (
            <div
              key={voucher.voucher_code}
              className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
            >
              {/* Main Row */}
              <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpandedVoucher(
                  expandedVoucher === voucher.voucher_code ? null : voucher.voucher_code
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="bg-amber-500/20 p-2 rounded-lg">
                    <Ticket className="text-amber-400" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-100">{voucher.voucher_code}</span>
                      <StatusBadge status={voucher.status} />
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-400 mt-1">
                      <span>Order: {voucher.order_number}</span>
                      <span>•</span>
                      <span>{voucher.user_email || voucher.customer_name || 'Unknown'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-400">₹{voucher.voucher_value}</p>
                    <p className="text-xs text-slate-400">{voucher.refund_percentage}% refund</p>
                  </div>
                  {expandedVoucher === voucher.voucher_code ? (
                    <ChevronUp className="text-slate-400" size={20} />
                  ) : (
                    <ChevronDown className="text-slate-400" size={20} />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {expandedVoucher === voucher.voucher_code && (
                <div className="border-t border-slate-700 p-4 bg-slate-900/50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Original Amount</p>
                      <p className="text-slate-100">₹{voucher.original_amount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Created</p>
                      <p className="text-slate-100">{formatDate(voucher.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Expires</p>
                      <p className="text-slate-100">{formatDate(voucher.expires_at)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Current Order Status</p>
                      <p className="text-slate-100 capitalize">{voucher.current_order_status || 'Unknown'}</p>
                    </div>
                  </div>

                  {/* Cancellation/Void reason if exists */}
                  {(voucher.cancellation_reason || voucher.void_reason) && (
                    <div className="bg-slate-800 rounded p-3 mb-4">
                      <p className="text-xs text-slate-400 mb-1">
                        {voucher.status === 'cancelled' ? 'Cancellation Reason' : 'Void Reason'}
                      </p>
                      <p className="text-slate-300">{voucher.cancellation_reason || voucher.void_reason}</p>
                    </div>
                  )}

                  {/* Actions for active vouchers */}
                  {voucher.status === 'active' && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-green-500/50 text-green-400 hover:bg-green-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelVoucher(voucher.voucher_code, 'delivered');
                        }}
                        disabled={actionLoading === voucher.voucher_code}
                      >
                        <Package size={14} className="mr-1" />
                        Cancel & Mark Delivered
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-blue-500/50 text-blue-400 hover:bg-blue-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelVoucher(voucher.voucher_code, 'handed_over');
                        }}
                        disabled={actionLoading === voucher.voucher_code}
                      >
                        <CheckCircle size={14} className="mr-1" />
                        Cancel & Mark Handed Over
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelVoucher(voucher.voucher_code);
                        }}
                        disabled={actionLoading === voucher.voucher_code}
                      >
                        <XCircle size={14} className="mr-1" />
                        Cancel Only
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVoidVoucher(voucher.voucher_code);
                        }}
                        disabled={actionLoading === voucher.voucher_code}
                      >
                        <Ban size={14} className="mr-1" />
                        Void Voucher
                      </Button>
                    </div>
                  )}

                  {/* Info for used vouchers */}
                  {voucher.status === 'used' && voucher.claimed_order_number && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                      <p className="text-sm text-blue-400">
                        Redeemed on order: <span className="font-mono">{voucher.claimed_order_number}</span>
                        {voucher.claimed_at && (
                          <span className="ml-2">({formatDate(voucher.claimed_at)})</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RTOVouchersTab;
