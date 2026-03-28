'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Eye, EyeOff, Lock, User } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
export default function RetailerLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useRetailerAuth();
  
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/retailer/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);
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
      router.push('/retailer/dashboard');
    } else {
      toast.error(result.error || 'Login failed');
    }
  };
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2B3A4A]">
        <div className="w-12 h-12 border-4 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#2B3A4A]">
      <div className="w-full max-w-md p-8 rounded-xl shadow-2xl bg-[#F5F0E8]">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 bg-[#D4AF37]">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#2B3A4A]">Retailer Portal</h1>
          <p className="text-gray-500">Sign in to manage your store</p>
        </div>
        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
              Email or Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="email@example.com or username"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
                data-testid="retailer-identifier-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#D4AF37] focus:border-transparent outline-none"
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
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#2B3A4A] text-white rounded-xl font-semibold hover:bg-[#1a252f] transition-colors disabled:opacity-50"
            data-testid="retailer-login-btn"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <a 
              href="mailto:contact.us@centraders.com" 
              className="font-medium text-[#D4AF37] hover:underline"
            >
              Contact Admin
            </a>
          </p>
        </div>
        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-xs text-gray-500">Addrika Retailer Portal</p>
          <Link href="/" className="text-xs text-[#D4AF37] hover:underline">
            Visit Main Store
          </Link>
        </div>
      </div>
    </div>
  );
}
