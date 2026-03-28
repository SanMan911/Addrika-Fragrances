'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, ArrowLeft, Mail, MessageSquare, Smartphone, Loader2, Check } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [preferences, setPreferences] = useState({
    email_marketing: true,
    email_order_updates: true,
    sms_order_updates: true,
    push_notifications: false,
    newsletter: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [isAuthenticated]);

  const fetchPreferences = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/notification-preferences`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPreferences(data.preferences || preferences);
      }
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/user/notification-preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(preferences)
      });

      if (response.ok) {
        toast.success('Preferences saved successfully');
      } else {
        toast.error('Failed to save preferences');
      }
    } catch (error) {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const ToggleSwitch = ({ checked, onChange }) => (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        checked ? 'bg-[#2B3A4A]' : 'bg-gray-300'
      }`}
    >
      <div
        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2B3A4A] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/account" className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <Bell size={24} className="text-[#D4AF37]" />
            <h1 className="text-xl font-bold">Notification Preferences</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl p-6 shadow-sm space-y-6">
          {/* Email Notifications */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Mail className="text-[#D4AF37]" size={20} />
              <h2 className="font-semibold text-[#2B3A4A]">Email Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#2B3A4A]">Order Updates</p>
                  <p className="text-sm text-gray-500">Get notified about your order status</p>
                </div>
                <ToggleSwitch
                  checked={preferences.email_order_updates}
                  onChange={() => handleToggle('email_order_updates')}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#2B3A4A]">Marketing Emails</p>
                  <p className="text-sm text-gray-500">Receive promotions and offers</p>
                </div>
                <ToggleSwitch
                  checked={preferences.email_marketing}
                  onChange={() => handleToggle('email_marketing')}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#2B3A4A]">Newsletter</p>
                  <p className="text-sm text-gray-500">Weekly updates about new products</p>
                </div>
                <ToggleSwitch
                  checked={preferences.newsletter}
                  onChange={() => handleToggle('newsletter')}
                />
              </div>
            </div>
          </div>

          <hr />

          {/* SMS Notifications */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <MessageSquare className="text-[#D4AF37]" size={20} />
              <h2 className="font-semibold text-[#2B3A4A]">SMS Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#2B3A4A]">Order Updates</p>
                  <p className="text-sm text-gray-500">Get SMS for shipping and delivery</p>
                </div>
                <ToggleSwitch
                  checked={preferences.sms_order_updates}
                  onChange={() => handleToggle('sms_order_updates')}
                />
              </div>
            </div>
          </div>

          <hr />

          {/* Push Notifications */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Smartphone className="text-[#D4AF37]" size={20} />
              <h2 className="font-semibold text-[#2B3A4A]">Push Notifications</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-[#2B3A4A]">Browser Notifications</p>
                  <p className="text-sm text-gray-500">Real-time updates in your browser</p>
                </div>
                <ToggleSwitch
                  checked={preferences.push_notifications}
                  onChange={() => handleToggle('push_notifications')}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 bg-[#2B3A4A] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check size={18} />
                Save Preferences
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
