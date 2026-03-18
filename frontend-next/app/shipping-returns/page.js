import Link from 'next/link';
import { Truck, RefreshCcw, Clock, MapPin, AlertTriangle } from 'lucide-react';

export const metadata = {
  title: 'Shipping & Returns Policy | Addrika Premium Incense',
  description: 'Free shipping on orders above Rs. 499. Easy 7-day returns for unused products. Fast delivery across India with real-time tracking for all Addrika incense orders.',
  keywords: ['addrika shipping', 'incense delivery india', 'agarbatti returns policy', 'free shipping incense'],
};

export default function ShippingReturnsPage() {
  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
        </div>
      </header>

      <main className="pt-16 min-h-screen bg-[#F5F0E8]">
        {/* Hero */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f]">
          <div className="max-w-4xl mx-auto text-center">
            <Truck className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
            <h1 className="text-4xl font-bold text-white font-serif mb-4">
              Shipping & Returns
            </h1>
            <p className="text-lg text-gray-300">
              Fast delivery across India with hassle-free returns
            </p>
          </div>
        </section>

        {/* Quick Info Cards */}
        <section className="py-12 px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <Truck className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
              <h3 className="font-semibold text-[#2B3A4A] mb-2">Free Shipping</h3>
              <p className="text-gray-600 text-sm">On orders above ₹499</p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <Clock className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
              <h3 className="font-semibold text-[#2B3A4A] mb-2">Fast Delivery</h3>
              <p className="text-gray-600 text-sm">3-7 business days</p>
            </div>
            <div className="bg-white rounded-xl p-6 text-center shadow-sm">
              <RefreshCcw className="w-10 h-10 text-[#D4AF37] mx-auto mb-3" />
              <h3 className="font-semibold text-[#2B3A4A] mb-2">Easy Returns</h3>
              <p className="text-gray-600 text-sm">7-day return policy</p>
            </div>
          </div>
        </section>

        {/* Detailed Policies */}
        <section className="py-12 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif mb-8">
              Shipping Policy
            </h2>
            
            <div className="space-y-6 text-gray-600">
              <div>
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Delivery Charges</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Orders above ₹499:</strong> FREE shipping</li>
                  <li><strong>Orders below ₹499:</strong> ₹49 flat rate</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Delivery Time</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Metro cities:</strong> 3-5 business days</li>
                  <li><strong>Other cities:</strong> 5-7 business days</li>
                  <li><strong>Remote areas:</strong> 7-10 business days</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Order Tracking</h3>
                <p>
                  Once your order is shipped, you will receive a tracking number via email 
                  and SMS. You can track your order on our website or the courier partner&apos;s website.
                </p>
              </div>
            </div>

            <hr className="my-12 border-gray-200" />

            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif mb-8">
              Returns Policy
            </h2>
            
            <div className="space-y-6 text-gray-600">
              <div>
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Return Window</h3>
                <p>
                  You may return unused, unopened products within <strong>7 days</strong> of delivery.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Return Conditions</h3>
                <ul className="list-disc list-inside space-y-1">
                  <li>Product must be unused and in original packaging</li>
                  <li>All tags and seals must be intact</li>
                  <li>Original invoice must be included</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Refund Process</h3>
                <p>
                  Refunds are processed within 5-7 business days after we receive and inspect 
                  the returned item. The amount will be credited to your original payment method.
                </p>
              </div>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800">Non-Returnable Items</h4>
                  <p className="text-sm text-yellow-700">
                    Opened or used incense products cannot be returned due to hygiene reasons.
                  </p>
                </div>
              </div>
            </div>

            <hr className="my-12 border-gray-200" />

            <div className="text-center">
              <h3 className="font-semibold text-[#2B3A4A] mb-2">Need Help?</h3>
              <p className="text-gray-600 mb-4">
                Contact our support team for any shipping or return queries.
              </p>
              <p className="text-gray-600">
                <strong>Email:</strong> contact.us@centraders.com<br />
                <strong>Phone:</strong> (+91) 9667-269-711
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
