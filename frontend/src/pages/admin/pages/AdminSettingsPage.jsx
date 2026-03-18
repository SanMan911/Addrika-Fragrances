import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { Settings, Key, Shield, LogOut, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { user, changeAdminPin, logout } = useAuth();
  
  const [showPinForm, setShowPinForm] = useState(false);
  const [pinForm, setPinForm] = useState({
    oldPin: '',
    newPin: '',
    confirmPin: ''
  });
  const [loading, setLoading] = useState(false);

  const handlePinChange = async (e) => {
    e.preventDefault();
    
    if (pinForm.newPin !== pinForm.confirmPin) {
      toast.error('New PINs do not match');
      return;
    }
    
    if (pinForm.newPin.length < 4) {
      toast.error('PIN must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      const result = await changeAdminPin(pinForm.oldPin, pinForm.newPin);
      if (result.success) {
        setShowPinForm(false);
        setPinForm({ oldPin: '', newPin: '', confirmPin: '' });
        toast.success('PIN changed successfully');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Settings</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your admin account settings</p>
      </div>

      {/* Account Info */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center">
            <Shield size={24} className="text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white">Admin Account</p>
            <p className="text-sm text-slate-500">{user?.email || 'admin@centraders.com'}</p>
          </div>
        </div>
      </div>

      {/* Change PIN */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Key size={20} className="text-slate-500" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-white">Change PIN</p>
              <p className="text-sm text-slate-500">Update your admin login PIN</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowPinForm(!showPinForm)}
          >
            {showPinForm ? 'Cancel' : 'Change'}
          </Button>
        </div>

        {showPinForm && (
          <form onSubmit={handlePinChange} className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
            <div>
              <Label htmlFor="oldPin">Current PIN</Label>
              <Input
                id="oldPin"
                type="password"
                value={pinForm.oldPin}
                onChange={(e) => setPinForm({...pinForm, oldPin: e.target.value})}
                placeholder="Enter current PIN"
                required
              />
            </div>
            <div>
              <Label htmlFor="newPin">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                value={pinForm.newPin}
                onChange={(e) => setPinForm({...pinForm, newPin: e.target.value})}
                placeholder="Enter new PIN"
                required
              />
            </div>
            <div>
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                value={pinForm.confirmPin}
                onChange={(e) => setPinForm({...pinForm, confirmPin: e.target.value})}
                placeholder="Confirm new PIN"
                required
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? (
                <RefreshCw size={18} className="animate-spin mr-2" />
              ) : (
                <Key size={18} className="mr-2" />
              )}
              Update PIN
            </Button>
          </form>
        )}
      </div>

      {/* Logout */}
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <LogOut size={20} className="text-red-500" />
            <div>
              <p className="font-semibold text-slate-800 dark:text-white">Logout</p>
              <p className="text-sm text-slate-500">Sign out of admin dashboard</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
          >
            <LogOut size={16} className="mr-2" />
            Logout
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
