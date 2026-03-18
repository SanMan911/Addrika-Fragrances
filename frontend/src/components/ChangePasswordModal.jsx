/**
 * ChangePasswordModal - Modal for changing user password
 */
import React, { useState } from 'react';
import { X, Lock, Eye, EyeOff, Loader2, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const ChangePasswordModal = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const toggleShowPassword = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    if (!formData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (formData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    } else if (formData.newPassword === formData.currentPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (formData.newPassword !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/auth/change-password`,
        {
          current_password: formData.currentPassword,
          new_password: formData.newPassword
        },
        { withCredentials: true }
      );
      
      setSuccess(true);
      toast.success('Password changed successfully!');
      
      // Reset form and close after a delay
      setTimeout(() => {
        setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setSuccess(false);
        onClose();
      }, 2000);
      
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Failed to change password';
      toast.error(errorMessage);
      
      // Set specific field error if it's about current password
      if (errorMessage.toLowerCase().includes('current password')) {
        setErrors(prev => ({ ...prev, currentPassword: errorMessage }));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setErrors({});
    setSuccess(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div 
        className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6"
        style={{ border: '1px solid var(--border)' }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <X size={20} style={{ color: 'var(--text-subtle)' }} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
          >
            <Lock size={24} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              Change Password
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              Update your account password
            </p>
          </div>
        </div>

        {success ? (
          <div className="text-center py-8">
            <CheckCircle size={64} className="mx-auto mb-4 text-green-500" />
            <p className="text-lg font-semibold text-green-600">Password Changed!</p>
            <p className="text-sm text-gray-500 mt-2">Your password has been updated successfully.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <Label htmlFor="currentPassword">Current Password</Label>
              <div className="relative">
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type={showPasswords.current ? 'text' : 'password'}
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="Enter current password"
                  className={`pr-10 ${errors.currentPassword ? 'border-red-500' : ''}`}
                  data-testid="current-password-input"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('current')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.current ? (
                    <EyeOff size={18} className="text-gray-400" />
                  ) : (
                    <Eye size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {errors.currentPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.currentPassword}</p>
              )}
            </div>

            {/* New Password */}
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  name="newPassword"
                  type={showPasswords.new ? 'text' : 'password'}
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Enter new password (min 6 characters)"
                  className={`pr-10 ${errors.newPassword ? 'border-red-500' : ''}`}
                  data-testid="new-password-input"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('new')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.new ? (
                    <EyeOff size={18} className="text-gray-400" />
                  ) : (
                    <Eye size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {errors.newPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.newPassword}</p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm new password"
                  className={`pr-10 ${errors.confirmPassword ? 'border-red-500' : ''}`}
                  data-testid="confirm-password-input"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('confirm')}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPasswords.confirm ? (
                    <EyeOff size={18} className="text-gray-400" />
                  ) : (
                    <Eye size={18} className="text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full py-5 text-white font-semibold"
              style={{ backgroundColor: loading ? '#999' : 'var(--japanese-indigo)' }}
              data-testid="change-password-submit"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Changing Password...
                </span>
              ) : (
                'Change Password'
              )}
            </Button>

            {/* Security Note */}
            <p className="text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
              For security, you'll need to log in again on other devices after changing your password.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

export default ChangePasswordModal;
