/**
 * DeleteAccountModal - GDPR-compliant account deletion with confirmation
 */
import React, { useState } from 'react';
import { X, AlertTriangle, Loader2, Trash2, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const DeleteAccountModal = ({ isOpen, onClose, userHasPassword }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();
  
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleClose = () => {
    setStep(1);
    setPassword('');
    setReason('');
    setConfirmText('');
    setError('');
    onClose();
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE MY ACCOUNT') {
      setError("Please type 'DELETE MY ACCOUNT' exactly");
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      await axios.post(
        `${API_URL}/api/user/delete-account`,
        {
          password: password,
          reason: reason || undefined,
          confirm_text: confirmText
        },
        { withCredentials: true }
      );
      
      toast.success('Account deleted successfully');
      
      // Logout and redirect
      await logout();
      navigate('/');
      
    } catch (error) {
      setError(error.response?.data?.detail || 'Failed to delete account');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      
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
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <Trash2 size={24} className="text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-600">
              Delete Account
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              This action cannot be undone
            </p>
          </div>
        </div>

        {step === 1 && (
          /* Step 1: Warning */
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="text-red-600 flex-shrink-0 mt-0.5" size={20} />
                <div className="text-sm">
                  <p className="font-semibold text-red-700 dark:text-red-400 mb-2">
                    What happens when you delete your account:
                  </p>
                  <ul className="space-y-1 text-red-600 dark:text-red-300">
                    <li>• Your profile and personal data will be permanently deleted</li>
                    <li>• Your saved addresses will be removed</li>
                    <li>• Your wishlist will be cleared</li>
                    <li>• Your order history will be anonymized (kept for legal compliance)</li>
                    <li>• You will not be able to recover your account</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="text-amber-600 flex-shrink-0 mt-0.5" size={20} />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  <strong>GDPR Compliance:</strong> Your order history will be retained in anonymized form 
                  for tax and legal purposes, but all personally identifiable information will be removed.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => setStep(2)}
                className="flex-1"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          /* Step 2: Verification */
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">
                {userHasPassword ? 'Enter your password to confirm' : 'Enter your email to confirm'}
              </Label>
              <Input
                id="password"
                type={userHasPassword ? 'password' : 'email'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder={userHasPassword ? 'Your current password' : 'your.email@example.com'}
                className="mt-1"
                data-testid="delete-account-password"
              />
              {!userHasPassword && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                  Since you signed in with Google, enter your email address to confirm.
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="reason">Reason for leaving (optional)</Label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Help us improve by sharing your reason..."
                className="w-full mt-1 px-3 py-2 rounded-md border text-sm resize-none"
                style={{ borderColor: 'var(--border)', minHeight: '80px' }}
              />
            </div>

            <div>
              <Label htmlFor="confirmText" className="text-red-600">
                Type "DELETE MY ACCOUNT" to confirm
              </Label>
              <Input
                id="confirmText"
                value={confirmText}
                onChange={(e) => { setConfirmText(e.target.value); setError(''); }}
                placeholder="DELETE MY ACCOUNT"
                className="mt-1"
                data-testid="delete-account-confirm"
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 text-red-600 text-sm p-3 rounded-lg">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={loading || confirmText !== 'DELETE MY ACCOUNT'}
                className="flex-1"
                data-testid="delete-account-final-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </span>
                ) : (
                  'Delete My Account'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeleteAccountModal;
