import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Mail, Smartphone, MessageSquare, ArrowLeft, Home, Save, Loader2 } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Button } from '../components/ui/button';
import { Switch } from '../components/ui/switch';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import { isFirebaseConfigured, subscribeToPushNotifications, unsubscribeFromPushNotifications } from '../lib/firebase';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NotificationPreferences = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  
  const [preferences, setPreferences] = useState({
    // Email Notifications
    email_order_updates: true,
    email_shipping_updates: true,
    email_promotions: false,
    email_blog_posts: false,
    email_new_products: false,
    
    // Push Notifications
    push_enabled: false,
    push_order_updates: true,
    push_shipping_updates: true,
    push_promotions: false,
    
    // SMS Notifications (future)
    sms_enabled: false,
    sms_order_updates: false
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    
    // Check push notification support
    if ('Notification' in window && 'serviceWorker' in navigator) {
      setPushSupported(true);
      setPushPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { state: { from: '/notifications' } });
      return;
    }
    
    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [isAuthenticated, authLoading, navigate]);

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`${API_URL}/api/auth/notification-preferences`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          setPreferences(prev => ({ ...prev, ...data.preferences }));
        }
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleEnablePush = async () => {
    if (!isFirebaseConfigured()) {
      toast.info('Push notifications are not yet configured. Coming soon!');
      return;
    }
    
    setSaving(true);
    
    try {
      const result = await subscribeToPushNotifications(API_URL);
      
      if (result.success) {
        setPreferences(prev => ({ ...prev, push_enabled: true }));
        setPushPermission('granted');
        toast.success('Push notifications enabled!');
      } else {
        toast.error(result.error || 'Failed to enable push notifications');
      }
    } catch (error) {
      toast.error('Failed to enable push notifications');
    } finally {
      setSaving(false);
    }
  };

  const handleDisablePush = async () => {
    setSaving(true);
    
    try {
      await unsubscribeFromPushNotifications(API_URL);
      setPreferences(prev => ({ ...prev, push_enabled: false }));
      toast.success('Push notifications disabled');
    } catch (error) {
      toast.error('Failed to disable push notifications');
    } finally {
      setSaving(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    
    try {
      const response = await fetch(`${API_URL}/api/auth/notification-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ preferences })
      });
      
      if (response.ok) {
        toast.success('Preferences saved successfully!');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <Loader2 className="animate-spin" size={32} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-2xl mx-auto px-4 py-8">
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

          {/* Header */}
          <div className="text-center mb-8">
            <div 
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              <Bell size={32} color="white" />
            </div>
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Notification Preferences
            </h1>
            <p style={{ color: 'var(--text-subtle)' }}>
              Choose how you'd like to stay updated
            </p>
          </div>

          {/* Email Notifications */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Mail size={24} style={{ color: 'var(--japanese-indigo)' }} />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                Email Notifications
              </h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Order Updates</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Order confirmations and status changes</p>
                </div>
                <Switch
                  checked={preferences.email_order_updates}
                  onCheckedChange={() => handleToggle('email_order_updates')}
                  data-testid="email-order-updates"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Shipping Updates</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tracking information and delivery alerts</p>
                </div>
                <Switch
                  checked={preferences.email_shipping_updates}
                  onCheckedChange={() => handleToggle('email_shipping_updates')}
                  data-testid="email-shipping-updates"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Promotions & Offers</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Discounts, sales, and special offers</p>
                </div>
                <Switch
                  checked={preferences.email_promotions}
                  onCheckedChange={() => handleToggle('email_promotions')}
                  data-testid="email-promotions"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Blog Posts</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">New articles and fragrance tips</p>
                </div>
                <Switch
                  checked={preferences.email_blog_posts}
                  onCheckedChange={() => handleToggle('email_blog_posts')}
                  data-testid="email-blog-posts"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">New Products</Label>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Be first to know about new fragrances</p>
                </div>
                <Switch
                  checked={preferences.email_new_products}
                  onCheckedChange={() => handleToggle('email_new_products')}
                  data-testid="email-new-products"
                />
              </div>
            </div>
          </div>

          {/* Push Notifications */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Bell size={24} style={{ color: 'var(--japanese-indigo)' }} />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                Push Notifications
              </h2>
              {!pushSupported && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
                  Not supported
                </span>
              )}
            </div>
            
            {!pushSupported ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Push notifications are not supported in your browser.
              </p>
            ) : pushPermission === 'denied' ? (
              <div className="p-4 bg-red-50 dark:bg-red-950/50 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Push notifications are blocked in your browser settings. 
                  To enable them, click the lock icon in your address bar and allow notifications.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {!preferences.push_enabled ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                      Get instant alerts on your device for order updates, shipping status, and more.
                    </p>
                    <Button
                      onClick={handleEnablePush}
                      disabled={saving}
                      className="text-white"
                      style={{ backgroundColor: 'var(--japanese-indigo)' }}
                      data-testid="enable-push-btn"
                    >
                      {saving ? (
                        <Loader2 className="animate-spin mr-2" size={16} />
                      ) : (
                        <Bell className="mr-2" size={16} />
                      )}
                      Enable Push Notifications
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Bell size={18} className="text-green-600 dark:text-green-400" />
                        <span className="text-sm text-green-700 dark:text-green-300 font-medium">
                          Push notifications are enabled
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDisablePush}
                        disabled={saving}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Disable
                      </Button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Order Updates</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Instant alerts for order changes</p>
                      </div>
                      <Switch
                        checked={preferences.push_order_updates}
                        onCheckedChange={() => handleToggle('push_order_updates')}
                        data-testid="push-order-updates"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Shipping Updates</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Real-time delivery tracking</p>
                      </div>
                      <Switch
                        checked={preferences.push_shipping_updates}
                        onCheckedChange={() => handleToggle('push_shipping_updates')}
                        data-testid="push-shipping-updates"
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-medium">Promotions</Label>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Flash sales and limited offers</p>
                      </div>
                      <Switch
                        checked={preferences.push_promotions}
                        onCheckedChange={() => handleToggle('push_promotions')}
                        data-testid="push-promotions"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* SMS Notifications (Coming Soon) */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-6 opacity-60"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Smartphone size={24} style={{ color: 'var(--japanese-indigo)' }} />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                SMS Notifications
              </h2>
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                Coming Soon
              </span>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              SMS notifications for order updates and delivery alerts will be available soon.
            </p>
          </div>

          {/* WhatsApp (Coming Soon) */}
          <div 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-6 mb-8 opacity-60"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare size={24} style={{ color: 'var(--japanese-indigo)' }} />
              <h2 className="text-lg font-semibold" style={{ color: 'var(--japanese-indigo)' }}>
                WhatsApp Updates
              </h2>
              <span className="text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                Coming Soon
              </span>
            </div>
            
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Receive order updates and tracking info directly on WhatsApp.
            </p>
          </div>

          {/* Save Button */}
          <Button
            onClick={savePreferences}
            disabled={saving}
            className="w-full text-white font-semibold py-3"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
            data-testid="save-preferences-btn"
          >
            {saving ? (
              <>
                <Loader2 className="animate-spin mr-2" size={18} />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2" size={18} />
                Save Preferences
              </>
            )}
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default NotificationPreferences;
