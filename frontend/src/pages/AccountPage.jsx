import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Package, LogOut, ChevronRight, ArrowLeft, Home, ShieldCheck, ChevronDown, ChevronUp, Bell, Lock, MapPin, Trash2, Edit2, Coins, CheckCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import ChangePasswordModal from '../components/ChangePasswordModal';
import AddressManager from '../components/AddressManager';
import DeleteAccountModal from '../components/DeleteAccountModal';
import EditOrderAddressModal from '../components/EditOrderAddressModal';
import RewardsSection from '../components/RewardsSection';

const AccountPage = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, isAdmin, logout, getUserOrders } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showAddressManager, setShowAddressManager] = useState(false);
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [editingOrderAddress, setEditingOrderAddress] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { state: { from: '/account' } });
    }
  }, [isAuthenticated, isLoading, navigate]);

  const fetchOrders = async () => {
    if (isAuthenticated) {
      setLoadingOrders(true);
      const userOrders = await getUserOrders();
      setOrders(userOrders);
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [isAuthenticated]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: '#f59e0b',
      confirmed: '#22c55e',
      processing: '#3b82f6',
      shipped: '#8b5cf6',
      delivered: '#22c55e',
      rto: '#f97316',
      cancelled: '#ef4444'
    };
    return colors[status] || '#6b7280';
  };
  
  const toggleOrderExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
             style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-16" style={{ backgroundColor: 'var(--cream)' }}>
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Navigation */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
          </div>

          {/* Profile Card */}
          <div 
            className="bg-white rounded-2xl shadow-lg p-6 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-4">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                {user?.picture ? (
                  <img 
                    src={user.picture} 
                    alt={user.name} 
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  user?.name?.charAt(0).toUpperCase() || 'U'
                )}
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                  {user?.name || 'User'}
                </h1>
                <p style={{ color: 'var(--text-subtle)' }}>{user?.email}</p>
                {isAdmin && (
                  <span 
                    className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full mt-1"
                    style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
                  >
                    <ShieldCheck size={12} />
                    Admin
                  </span>
                )}
              </div>
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
                style={{ borderColor: 'var(--japanese-indigo)', color: 'var(--japanese-indigo)' }}
                data-testid="logout-btn"
              >
                <LogOut size={18} />
                Logout
              </Button>
            </div>
          </div>

          {/* Admin Access Card */}
          {isAdmin && (
            <div 
              className="bg-white rounded-2xl shadow-lg p-6 mb-8 cursor-pointer hover:shadow-xl transition-shadow"
              style={{ border: '2px solid var(--metallic-gold)' }}
              onClick={() => navigate('/admin')}
              data-testid="admin-dashboard-link"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--metallic-gold)' }}
                  >
                    <ShieldCheck size={24} color="white" />
                  </div>
                  <div>
                    <h2 className="font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                      Admin Dashboard
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      Manage orders, discounts & more
                    </p>
                  </div>
                </div>
                <ChevronRight size={24} style={{ color: 'var(--metallic-gold)' }} />
              </div>
            </div>
          )}

          {/* Rewards Section */}
          <div className="bg-white rounded-2xl shadow-lg mb-8" style={{ border: '1px solid var(--border)' }}>
            <RewardsSection />
          </div>

          {/* Notification Preferences Card */}
          <div 
            className="bg-white rounded-2xl shadow-lg p-6 mb-8 cursor-pointer hover:shadow-xl transition-shadow"
            style={{ border: '1px solid var(--border)' }}
            onClick={() => navigate('/notifications')}
            data-testid="notification-preferences-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  <Bell size={24} color="white" />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                    Notification Preferences
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    Manage email, push & SMS alerts
                  </p>
                </div>
              </div>
              <ChevronRight size={24} style={{ color: 'var(--metallic-gold)' }} />
            </div>
          </div>

          {/* Change Password Card - Only show for non-OAuth users */}
          {user && !user.google_id && (
            <div 
              className="bg-white rounded-2xl shadow-lg p-6 mb-8 cursor-pointer hover:shadow-xl transition-shadow"
              style={{ border: '1px solid var(--border)' }}
              onClick={() => setShowChangePassword(true)}
              data-testid="change-password-link"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--metallic-gold)' }}
                  >
                    <Lock size={24} color="white" />
                  </div>
                  <div>
                    <h2 className="font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                      Change Password
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                      Update your account password
                    </p>
                  </div>
                </div>
                <ChevronRight size={24} style={{ color: 'var(--metallic-gold)' }} />
              </div>
            </div>
          )}

          {/* Saved Addresses Card */}
          <div 
            className="bg-white rounded-2xl shadow-lg p-6 mb-8 cursor-pointer hover:shadow-xl transition-shadow"
            style={{ border: '1px solid var(--border)' }}
            onClick={() => setShowAddressManager(true)}
            data-testid="saved-addresses-link"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  <MapPin size={24} color="white" />
                </div>
                <div>
                  <h2 className="font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                    Saved Addresses
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                    Manage your delivery addresses
                  </p>
                </div>
              </div>
              <ChevronRight size={24} style={{ color: 'var(--metallic-gold)' }} />
            </div>
          </div>

          {/* Order History */}
          <div 
            className="bg-white rounded-2xl shadow-lg p-6"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <Package size={24} style={{ color: 'var(--metallic-gold)' }} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Order History
              </h2>
            </div>

            {loadingOrders ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin mx-auto"
                     style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }} />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12">
                <Package size={64} className="mx-auto mb-4 opacity-20" />
                <p className="text-lg mb-4" style={{ color: 'var(--text-subtle)' }}>
                  No orders yet
                </p>
                <Button
                  onClick={() => navigate('/')}
                  className="text-white"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  Start Shopping
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map((order) => {
                  const orderNumber = order.orderNumber || order.order_number;
                  const orderStatus = order.orderStatus || order.order_status || 'pending';
                  const paymentStatus = order.paymentStatus || order.payment_status || 'pending';
                  const paymentMode = order.paymentMode || order.payment_mode || '';
                  const total = order.total || order.pricing?.final_total || 0;
                  const subtotal = order.subtotal || order.pricing?.subtotal || 0;
                  const bulkDiscount = order.bulkDiscount || order.pricing?.bulk_discount || 0;
                  const couponDiscount = order.couponDiscount || order.pricing?.coupon_discount || 0;
                  const shippingCharge = order.shippingCharge || order.pricing?.shipping || 0;
                  const discountCode = order.discountCode || order.discount_code;
                  const items = order.items || [];
                  const shippingDetails = order.shippingDetails || order.shipping_details;
                  const isExpanded = expandedOrder === orderNumber;
                  
                  // Parse date - DDMMMYYYY format
                  const dateStr = order.createdAt || order.created_at;
                  let formattedDate = 'N/A';
                  if (dateStr) {
                    try {
                      const date = new Date(dateStr);
                      if (!isNaN(date.getTime())) {
                        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                        const day = String(date.getDate()).padStart(2, '0');
                        const month = months[date.getMonth()];
                        const year = date.getFullYear();
                        formattedDate = `${day}${month}${year}`;
                      }
                    } catch (e) {}
                  }
                  
                  return (
                    <div
                      key={orderNumber}
                      className="border rounded-lg overflow-hidden"
                      style={{ borderColor: 'var(--border)' }}
                    >
                      {/* Order Header - Clickable */}
                      <div
                        className="p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => toggleOrderExpand(orderNumber)}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                              #{orderNumber}
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                              {formattedDate}
                            </p>
                          </div>
                          <div className="text-right flex items-center gap-3">
                            <div>
                              <p className="font-bold" style={{ color: 'var(--metallic-gold)' }}>
                                ₹{total.toFixed(2)}
                              </p>
                              <span 
                                className="text-xs px-2 py-1 rounded-full inline-block"
                                style={{ 
                                  backgroundColor: getStatusColor(orderStatus) + '20',
                                  color: getStatusColor(orderStatus)
                                }}
                              >
                                {orderStatus === 'rto' ? 'RTO' : orderStatus?.charAt(0).toUpperCase() + orderStatus?.slice(1)}
                              </span>
                            </div>
                            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
                          <span>{items.length || 0} item(s)</span>
                          {paymentStatus === 'paid' && paymentMode && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">Paid via {paymentMode}</span>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Expanded Order Details */}
                      {isExpanded && (
                        <div className="border-t p-4 bg-gray-50" style={{ borderColor: 'var(--border)' }}>
                          {/* Items List */}
                          <div className="mb-4">
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                              Items Ordered
                            </h4>
                            <div className="space-y-2">
                              {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between text-sm bg-white p-2 rounded">
                                  <div>
                                    <span className="font-medium">{item.name}</span>
                                    <span className="text-gray-500 ml-2">({item.size})</span>
                                    <span className="text-gray-500 ml-2">× {item.quantity}</span>
                                  </div>
                                  <span style={{ color: 'var(--metallic-gold)' }}>
                                    ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Price Breakdown */}
                          <div className="mb-4 bg-white p-3 rounded">
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                              Price Summary
                            </h4>
                            <div className="space-y-1 text-sm">
                              <div className="flex justify-between">
                                <span>Subtotal:</span>
                                <span>₹{subtotal.toFixed(2)}</span>
                              </div>
                              {bulkDiscount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>Bulk Discount:</span>
                                  <span>-₹{bulkDiscount.toFixed(2)}</span>
                                </div>
                              )}
                              {couponDiscount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>Coupon Discount {discountCode && `(${discountCode})`}:</span>
                                  <span>-₹{couponDiscount.toFixed(2)}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>Shipping:</span>
                                <span>{shippingCharge > 0 ? `₹${shippingCharge.toFixed(2)}` : 'FREE'}</span>
                              </div>
                              <div className="flex justify-between font-bold pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                <span>Total Paid:</span>
                                <span style={{ color: 'var(--metallic-gold)' }}>₹{total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Payment Info */}
                          <div className="mb-4 bg-white p-3 rounded">
                            <h4 className="font-semibold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                              Payment Details
                            </h4>
                            <div className="text-sm space-y-1">
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <span className={paymentStatus === 'paid' ? 'text-green-600 font-semibold' : 'text-yellow-600'}>
                                  {paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
                                </span>
                              </div>
                              {paymentMode && (
                                <div className="flex justify-between">
                                  <span>Payment Mode:</span>
                                  <span>{paymentMode}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Shipping/Tracking Info */}
                          {shippingDetails && (shippingDetails.carrier_name || shippingDetails.tracking_number) && (
                            <div className="mb-4 bg-blue-50 p-3 rounded">
                              <h4 className="font-semibold mb-2 text-blue-800">
                                🚚 Shipping Information
                              </h4>
                              <div className="text-sm space-y-1">
                                {shippingDetails.carrier_name && (
                                  <div className="flex justify-between">
                                    <span>Carrier:</span>
                                    <span className="font-medium">{shippingDetails.carrier_name}</span>
                                  </div>
                                )}
                                {shippingDetails.tracking_number && (
                                  <div className="flex justify-between">
                                    <span>Tracking #:</span>
                                    <span className="font-mono font-medium">{shippingDetails.tracking_number}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          {/* Edit Address Button - Only for shipping orders that haven't shipped */}
                          {order.delivery_mode !== 'self-pickup' && 
                           !['shipped', 'out_for_delivery', 'delivered', 'cancelled', 'rto', 'rto_delivered'].includes(orderStatus.toLowerCase()) && (
                            <Button
                              onClick={(e) => { e.stopPropagation(); setEditingOrderAddress(order); }}
                              variant="outline"
                              className="w-full mb-2"
                              style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
                              data-testid="edit-order-address-btn"
                            >
                              <Edit2 size={16} className="mr-2" />
                              Edit Shipping Address
                            </Button>
                          )}
                          
                          {/* Track Order Button - Green "Delivered on" for delivered orders */}
                          {orderStatus === 'delivered' ? (
                            <div 
                              className="w-full py-3 px-4 rounded-lg text-center font-semibold flex items-center justify-center gap-2"
                              style={{ backgroundColor: '#dcfce7', color: '#16a34a' }}
                            >
                              <CheckCircle size={18} />
                              Delivered on {(() => {
                                const deliveredDate = order.delivered_at || order.deliveredAt || order.updated_at || order.updatedAt;
                                if (deliveredDate) {
                                  const date = new Date(deliveredDate);
                                  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                                }
                                return 'N/A';
                              })()}
                            </div>
                          ) : (
                            <Button
                              onClick={() => navigate(`/track-order?order=${orderNumber}`)}
                              className="w-full text-white"
                              style={{ backgroundColor: 'var(--japanese-indigo)' }}
                            >
                              Track Order
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Delete Account Card - Danger Zone */}
          <div 
            className="bg-white rounded-2xl shadow-lg p-6 mt-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-600">Danger Zone</h3>
                <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
                  Irreversible account actions
                </p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: 'var(--text-subtle)' }}>
              Once you delete your account, all your personal data will be permanently removed. 
              Your order history will be anonymized but retained for legal compliance.
            </p>
            <Button
              variant="outline"
              className="w-full border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowDeleteAccount(true)}
              data-testid="delete-account-btn"
            >
              Delete My Account
            </Button>
          </div>
        </div>
      </main>

      <Footer />
      
      {/* Change Password Modal */}
      <ChangePasswordModal 
        isOpen={showChangePassword} 
        onClose={() => setShowChangePassword(false)} 
      />
      
      {/* Address Manager Modal */}
      <AddressManager 
        isOpen={showAddressManager} 
        onClose={() => setShowAddressManager(false)} 
      />
      
      {/* Delete Account Modal */}
      <DeleteAccountModal 
        isOpen={showDeleteAccount} 
        onClose={() => setShowDeleteAccount(false)}
        userHasPassword={user && !user.google_id}
      />
      
      {/* Edit Order Address Modal */}
      <EditOrderAddressModal 
        isOpen={!!editingOrderAddress}
        onClose={() => setEditingOrderAddress(null)}
        order={editingOrderAddress}
        onUpdate={() => fetchOrders()}
      />
    </div>
  );
};

export default AccountPage;
