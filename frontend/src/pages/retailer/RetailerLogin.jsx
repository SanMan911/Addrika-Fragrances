/**
 * Retailer Login Page
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Eye, EyeOff, Lock, Mail, User } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const RetailerLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { login, isAuthenticated } = useRetailerAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/retailer/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!identifier || !password) {
      toast.error('Please enter email/username and password');
      return;
    }

    setLoading(true);
    const result = await login(identifier, password);
    setLoading(false);

    if (result.success) {
      toast.success('Login successful!');
      navigate('/retailer/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: 'var(--japanese-indigo)' }}
    >
      <div 
        className="w-full max-w-md p-8 rounded-xl shadow-2xl"
        style={{ backgroundColor: 'var(--cream)' }}
      >
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div 
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
            style={{ backgroundColor: 'var(--metallic-gold)' }}
          >
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 
            className="text-2xl font-bold"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            Retailer Portal
          </h1>
          <p style={{ color: 'var(--text-subtle)' }}>
            Sign in to manage your store
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="identifier" className="text-sm font-medium">
              Email or Username
            </Label>
            <div className="relative mt-1">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or username"
                className="pl-10"
                data-testid="retailer-identifier-input"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium">
              Password
            </Label>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10 pr-10"
                data-testid="retailer-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full py-6 text-lg font-semibold"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
            data-testid="retailer-login-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm" style={{ color: 'var(--text-subtle)' }}>
            Don't have an account?{' '}
            <a 
              href="mailto:contact.us@centraders.com" 
              style={{ color: 'var(--metallic-gold)' }}
              className="font-medium hover:underline"
            >
              Contact Admin
            </a>
          </p>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-xs" style={{ color: 'var(--text-subtle)' }}>
            Addrika Retailer Portal
          </p>
          <a 
            href="https://centraders.com" 
            className="text-xs hover:underline"
            style={{ color: 'var(--metallic-gold)' }}
          >
            Visit Main Store
          </a>
        </div>
      </div>
    </div>
  );
};

export default RetailerLogin;
