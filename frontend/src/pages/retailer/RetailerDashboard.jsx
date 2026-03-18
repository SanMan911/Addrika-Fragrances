/**
 * Retailer Dashboard - Main dashboard with performance metrics and profile summary
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Store, Package, MessageSquare, AlertTriangle, ShoppingBag,
  TrendingUp, Clock, DollarSign, LogOut, Menu, X, 
  ChevronRight, Bell, User, Trophy, FileText, CheckCircle, XCircle, Info, Award, FileEdit
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RetailerDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [profileSummary, setProfileSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const { retailer, logout, fetchWithAuth } = useRetailerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch metrics and profile summary in parallel
      const [metricsRes, profileRes] = await Promise.all([
        fetchWithAuth(`${API_URL}/api/retailer-dashboard/performance`),
        fetchWithAuth(`${API_URL}/api/retailers/profile/summary`)
      ]);
      
      if (metricsRes.ok) {
        const data = await metricsRes.json();
        setMetrics(data.metrics);
      }
      
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfileSummary(data.profile_summary);
        
        // Show alerts if any
        if (data.profile_summary?.alerts?.length > 0) {
          setShowProfileModal(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/retailer/login');
  };

  const navItems = [
    { icon: Store, label: 'Dashboard', path: '/retailer/dashboard', active: true },
    { icon: Package, label: 'Orders', path: '/retailer/orders', badge: metrics?.pending_orders },
    { icon: Trophy, label: 'Leaderboard', path: '/retailer/leaderboard' },
    { icon: Award, label: 'Badges', path: '/retailer/badges' },
    { icon: FileEdit, label: 'Profile Requests', path: '/retailer/profile-requests' },
    { icon: AlertTriangle, label: 'Grievances', path: '/retailer/grievances', badge: metrics?.open_grievances },
    { icon: MessageSquare, label: 'Messages', path: '/retailer/messages', badge: metrics?.unread_messages },
    { icon: ShoppingBag, label: 'B2B Orders', path: '/retailer/b2b' },
  ];

  const MetricCard = ({ icon: Icon, label, value, subtext, color }) => (
    <div 
      className="p-5 rounded-xl"
      style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        <div 
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <span className="text-sm font-medium" style={{ color: 'var(--text-subtle)' }}>
          {label}
        </span>
      </div>
      <div className="text-3xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
        {value}
      </div>
      {subtext && (
        <div className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
          {subtext}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-64 z-50 transform transition-transform lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ backgroundColor: 'var(--japanese-indigo)' }}
      >
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div 
              className="p-2 rounded-lg"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <Store className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Addrika</h1>
              <p className="text-xs text-white/60">Retailer Portal</p>
            </div>
          </div>
        </div>

        {/* Nav Items */}
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                item.active 
                  ? 'bg-white/10 text-white' 
                  : 'text-white/70 hover:bg-white/5 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
              {item.badge > 0 && (
                <span 
                  className="px-2 py-0.5 text-xs font-semibold rounded-full"
                  style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User Info */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">{retailer?.name}</div>
              <div className="text-xs text-white/60">{retailer?.district}</div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full text-white border-white/20 hover:bg-white/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64">
        {/* Header */}
        <header 
          className="sticky top-0 z-30 px-4 py-4 flex items-center justify-between"
          style={{ backgroundColor: 'white', borderBottom: '1px solid var(--border)' }}
        >
          <button 
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <h1 
            className="text-xl font-bold"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            Dashboard
          </h1>

          <div className="flex items-center gap-3">
            <button className="p-2 rounded-lg hover:bg-gray-100 relative">
              <Bell className="w-5 h-5" style={{ color: 'var(--japanese-indigo)' }} />
              {metrics?.unread_messages > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
              )}
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6">
          {/* Welcome */}
          <div className="mb-6">
            <h2 
              className="text-2xl font-bold"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Welcome back, {retailer?.name}!
            </h2>
            <p style={{ color: 'var(--text-subtle)' }}>
              Here's your store performance overview
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* Primary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <MetricCard
                  icon={Package}
                  label="Total Orders"
                  value={metrics?.total_orders || 0}
                  subtext={`${metrics?.recent_orders_30d || 0} in last 30 days`}
                  color="#3B82F6"
                />
                <MetricCard
                  icon={TrendingUp}
                  label="Completion Rate"
                  value={`${metrics?.completion_rate || 0}%`}
                  subtext={`${metrics?.completed_orders || 0} completed`}
                  color="#10B981"
                />
                <MetricCard
                  icon={Clock}
                  label="Pending Orders"
                  value={metrics?.pending_orders || 0}
                  subtext="Awaiting action"
                  color="#F59E0B"
                />
                <MetricCard
                  icon={DollarSign}
                  label="Total Revenue"
                  value={`₹${(metrics?.total_revenue || 0).toLocaleString()}`}
                  subtext="From completed orders"
                  color="#8B5CF6"
                />
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <MetricCard
                  icon={Store}
                  label="Pickups Completed"
                  value={metrics?.pickups_completed || 0}
                  color="#06B6D4"
                />
                <MetricCard
                  icon={Clock}
                  label="Avg Pickup Time"
                  value={metrics?.avg_pickup_hours ? `${metrics.avg_pickup_hours}h` : 'N/A'}
                  subtext="Average completion time"
                  color="#EC4899"
                />
                <MetricCard
                  icon={AlertTriangle}
                  label="Open Grievances"
                  value={metrics?.open_grievances || 0}
                  color="#EF4444"
                />
              </div>

              {/* Quick Actions */}
              <div 
                className="p-6 rounded-xl"
                style={{ backgroundColor: 'var(--cream)', border: '1px solid var(--border)' }}
              >
                <h3 
                  className="text-lg font-semibold mb-4"
                  style={{ color: 'var(--japanese-indigo)' }}
                >
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Link 
                    to="/retailer/orders"
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white transition-colors"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <Package className="w-5 h-5" style={{ color: 'var(--metallic-gold)' }} />
                      <span>View Orders</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>
                  <Link 
                    to="/retailer/grievances"
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white transition-colors"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5" style={{ color: 'var(--metallic-gold)' }} />
                      <span>Submit Grievance</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </Link>
                  <button 
                    onClick={() => setShowProfileModal(true)}
                    className="flex items-center justify-between p-4 rounded-lg hover:bg-white transition-colors text-left"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5" style={{ color: 'var(--metallic-gold)' }} />
                      <span>View Profile & Documents</span>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Profile Summary Modal */}
      {showProfileModal && profileSummary && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                  Business Profile & Documents
                </h2>
                <button 
                  onClick={() => setShowProfileModal(false)} 
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Alerts Section */}
              {profileSummary.alerts?.length > 0 && (
                <div 
                  className="p-4 rounded-lg"
                  style={{ backgroundColor: '#FEF3C7', border: '1px solid #F59E0B' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-5 h-5" style={{ color: '#D97706' }} />
                    <span className="font-semibold" style={{ color: '#D97706' }}>Action Required</span>
                  </div>
                  <ul className="space-y-1">
                    {profileSummary.alerts.map((alert, idx) => (
                      <li key={idx} className="text-sm flex items-start gap-2" style={{ color: '#92400E' }}>
                        <span>•</span>
                        <span>{alert}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Verification Status */}
              <div className="flex flex-wrap gap-3">
                <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                  profileSummary.is_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {profileSummary.is_verified ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {profileSummary.is_verified ? 'Verified' : 'Pending Verification'}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                  profileSummary.gst_verified ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {profileSummary.gst_verified ? <CheckCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  GST {profileSummary.gst_verified ? 'Verified' : 'Pending'}
                </div>
                <div className={`px-3 py-1 rounded-full text-sm flex items-center gap-1 ${
                  profileSummary.documents_complete ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {profileSummary.documents_complete ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  Documents {profileSummary.documents_complete ? 'Complete' : 'Incomplete'}
                </div>
              </div>

              {/* Business Details */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
                <h3 className="font-semibold mb-3" style={{ color: 'var(--japanese-indigo)' }}>
                  Business Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Business Name</span>
                    <p className="font-medium">{profileSummary.business_name}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">GST Number</span>
                    <p className="font-medium font-mono">{profileSummary.gst_number}</p>
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-gray-500">Registered Address</span>
                    <p className="font-medium">
                      {profileSummary.registered_address}, {profileSummary.city}, {profileSummary.state} - {profileSummary.pincode}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500">Email</span>
                    <p className="font-medium">{profileSummary.email}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone</span>
                    <p className="font-medium">{profileSummary.phone}</p>
                  </div>
                </div>
              </div>

              {/* SPOC Details */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
                <h3 className="font-semibold mb-3" style={{ color: 'var(--japanese-indigo)' }}>
                  Single Point of Contact (SPOC)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Name</span>
                    <p className="font-medium">{profileSummary.spoc_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Designation</span>
                    <p className="font-medium">{profileSummary.spoc_designation || 'Not provided'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone</span>
                    <p className="font-medium">{profileSummary.spoc_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>

              {/* Document Status */}
              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--cream)' }}>
                <h3 className="font-semibold mb-3" style={{ color: 'var(--japanese-indigo)' }}>
                  Document Status
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">GST Certificate</span>
                    {profileSummary.gst_certificate_uploaded ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" /> Uploaded
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="w-4 h-4" /> Not Uploaded
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">SPOC ID Proof</span>
                    {profileSummary.spoc_id_uploaded ? (
                      <span className="flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle className="w-4 h-4" /> Uploaded
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <XCircle className="w-4 h-4" /> Not Uploaded
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Help Text */}
              <div className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  To update your business details or upload documents, please contact the admin at{' '}
                  <a href="mailto:contact.us@centraders.com" className="underline" style={{ color: 'var(--metallic-gold)' }}>
                    contact.us@centraders.com
                  </a>
                </span>
              </div>

              {/* Last Updated */}
              {profileSummary.last_updated && (
                <div className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                  Last updated: {new Date(profileSummary.last_updated).toLocaleDateString('en-IN', {
                    day: '2-digit', month: 'short', year: 'numeric'
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t bg-gray-50">
              <Button 
                onClick={() => setShowProfileModal(false)}
                className="w-full"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetailerDashboard;
