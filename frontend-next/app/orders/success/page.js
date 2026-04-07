'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, Package, ArrowRight, TreePine } from 'lucide-react';
import { Suspense } from 'react';

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('id');
  const treeDonation = searchParams.get('tree') === 'true';
  const [showConfetti, setShowConfetti] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F0E8] flex items-center justify-center px-4">
      {/* Simple confetti effect */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-3 h-3 animate-bounce"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10%`,
                backgroundColor: ['#D4AF37', '#2B3A4A', '#10B981', '#ffffff'][i % 4],
                animationDelay: `${Math.random() * 2}s`,
                animationDuration: `${2 + Math.random() * 2}s`
              }}
            />
          ))}
        </div>
      )}
      
      <div className="max-w-md w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={48} className="text-green-500" />
          </div>
          
          <h1 className="text-2xl font-bold text-[#2B3A4A] mb-2">Order Placed Successfully!</h1>
          <p className="text-gray-500 mb-6">
            Thank you for your purchase. We&apos;ve sent a confirmation email with your order details.
          </p>
          
          {orderId && (
            <div className="bg-[#F5F0E8] rounded-xl p-4 mb-6">
              <p className="text-sm text-gray-500 mb-1">Order ID</p>
              <p className="font-mono font-bold text-[#2B3A4A]">
                #{orderId.slice(-8).toUpperCase()}
              </p>
            </div>
          )}
          
          {/* Tree Donation Thank You */}
          {treeDonation && (
            <div 
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 mb-6"
              data-testid="tree-donation-thanks"
            >
              <div className="flex items-center justify-center gap-3 mb-3">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                  <TreePine size={24} className="text-emerald-600" />
                </div>
              </div>
              <h3 className="font-bold text-emerald-800 text-lg mb-2">
                Thank You for Planting a Tree!
              </h3>
              <p className="text-emerald-700 text-sm">
                Your Rs. 5 donation + our Rs. 5 match = 1 tree planted together. 
                You&apos;re making a real difference for our planet!
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <Link
              href="/orders"
              className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-6 py-3 rounded-xl font-semibold hover:bg-[#c9a432] transition-colors"
            >
              <Package size={20} />
              View Order Details
            </Link>
            
            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 bg-[#2B3A4A] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1a252f] transition-colors"
            >
              Continue Shopping
              <ArrowRight size={20} />
            </Link>
          </div>
        </div>
        
        {/* What's Next */}
        <div className="mt-6 bg-white rounded-xl p-6">
          <h2 className="font-bold text-[#2B3A4A] mb-4">What&apos;s Next?</h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">1</div>
              <p className="text-gray-600">You&apos;ll receive an email confirmation shortly</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">2</div>
              <p className="text-gray-600">We&apos;ll prepare your order with care</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">3</div>
              <p className="text-gray-600">Track your shipment from the Orders page</p>
            </div>
            {treeDonation && (
              <div className="flex items-start gap-3 pt-2 border-t border-gray-100">
                <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <TreePine size={12} className="text-white" />
                </div>
                <p className="text-emerald-700">Your tree will be planted as part of our reforestation initiative</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F0E8]">
        <div className="w-12 h-12 border-4 border-[#2B3A4A] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
