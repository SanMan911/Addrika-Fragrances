'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CreditCard, ArrowLeft, Plus, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

export default function PaymentsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPaymentMethods();
    }
  }, [isAuthenticated]);

  const fetchPaymentMethods = async () => {
    try {
      const response = await fetch(`${API_URL}/api/user/payment-methods`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.payment_methods || []);
      }
    } catch (error) {
      console.error('Failed to fetch payment methods:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (methodId) => {
    try {
      const response = await fetch(`${API_URL}/api/user/payment-methods/${methodId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Payment method removed');
        setDeleteConfirm(null);
        fetchPaymentMethods();
      } else {
        toast.error('Failed to remove payment method');
      }
    } catch (error) {
      toast.error('Failed to remove payment method');
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

  return (
    <div className="min-h-screen bg-[#F5F0E8]">
      {/* Header */}
      <header className="bg-[#2B3A4A] text-white py-4 px-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/account" className="p-2 hover:bg-white/10 rounded-lg">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <CreditCard size={24} className="text-[#D4AF37]" />
            <h1 className="text-xl font-bold">Payment Methods</h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {paymentMethods.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl">
              <CreditCard size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500 mb-4">No saved payment methods</p>
              <p className="text-sm text-gray-400">
                Payment methods are saved securely during checkout
              </p>
            </div>
          ) : (
            paymentMethods.map((method) => (
              <div
                key={method.id}
                className="bg-white p-4 rounded-xl border border-gray-200"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center">
                      {method.type === 'card' ? (
                        <CreditCard size={20} className="text-gray-600" />
                      ) : (
                        <span className="text-xs font-medium text-gray-600">UPI</span>
                      )}
                    </div>
                    <div>
                      {method.type === 'card' ? (
                        <>
                          <p className="font-medium text-[#2B3A4A]">
                            •••• •••• •••• {method.last4}
                          </p>
                          <p className="text-sm text-gray-500">
                            Expires {method.expiry_month}/{method.expiry_year}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="font-medium text-[#2B3A4A]">{method.upi_id}</p>
                          <p className="text-sm text-gray-500">UPI</p>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setDeleteConfirm(method.id)}
                    className="p-2 rounded hover:bg-red-50"
                    title="Remove"
                  >
                    <Trash2 size={16} className="text-red-500" />
                  </button>
                </div>

                {/* Delete confirmation */}
                {deleteConfirm === method.id && (
                  <div className="mt-3 p-3 bg-red-50 rounded border border-red-200">
                    <div className="flex items-center gap-2 text-red-600 mb-2">
                      <AlertTriangle size={16} />
                      <span className="font-medium text-sm">Remove this payment method?</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(method.id)}
                        className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(null)}
                        className="px-3 py-1 border rounded text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Payment methods are automatically saved when you complete a purchase with Razorpay. 
              You can use saved methods for faster checkout.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
