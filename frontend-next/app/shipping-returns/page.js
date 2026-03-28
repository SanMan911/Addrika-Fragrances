import Link from 'next/link';
import { Truck, RefreshCcw, Clock, AlertTriangle } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'Shipping & Returns Policy | Addrika Premium Incense',
  description: 'Free shipping on orders above Rs. 499. Easy 7-day returns for unused products. Fast delivery across India with real-time tracking for all Addrika incense orders.',
  keywords: ['addrika shipping', 'incense delivery india', 'agarbatti returns policy', 'free shipping incense'],
};

export default function ShippingReturnsPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="pt-24 pb-16">
        {/* Hero */}
        <section className="py-16 px-4">
          <div 
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ 
              background: 'radial-gradient(ellipse at center top, rgba(212,175,55,0.1) 0%, transparent 50%)'
            }}
          />
          <div className="max-w-4xl mx-auto text-center relative">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <Truck className="w-10 h-10 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-4xl sm:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Shipping & Returns
            </h1>
            <p className="text-lg text-gray-300">
              Fast delivery across India with hassle-free returns
            </p>
          </div>
        </section>

        {/* Quick Info Cards */}
        <section className="py-8 px-4">
          <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
            <div 
              className="p-6 rounded-xl text-center"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div 
                className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.15)' }}
              >
                <Truck className="w-7 h-7 text-[#D4AF37]" />
              </div>
              <h3 className="font-semibold text-white mb-2">Free Shipping</h3>
              <p className="text-gray-400 text-sm">On orders above Rs. 499</p>
            </div>
            <div 
              className="p-6 rounded-xl text-center"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div 
                className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.15)' }}
              >
                <Clock className="w-7 h-7 text-[#D4AF37]" />
              </div>
              <h3 className="font-semibold text-white mb-2">Fast Delivery</h3>
              <p className="text-gray-400 text-sm">3-7 business days</p>
            </div>
            <div 
              className="p-6 rounded-xl text-center"
              style={{ 
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <div 
                className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(212,175,55,0.15)' }}
              >
                <RefreshCcw className="w-7 h-7 text-[#D4AF37]" />
              </div>
              <h3 className="font-semibold text-white mb-2">Easy Returns</h3>
              <p className="text-gray-400 text-sm">7-day return policy</p>
            </div>
          </div>
        </section>

        {/* Detailed Policies */}
        <section className="py-12 px-4">
          <div className="max-w-3xl mx-auto">
            {/* Shipping Policy */}
            <div 
              className="p-8 rounded-2xl mb-8"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <h2 
                className="text-2xl font-bold text-white mb-6"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Shipping Policy
              </h2>
              
              <div className="space-y-6 text-gray-300">
                <div>
                  <h3 className="font-semibold text-white mb-2">Delivery Charges</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li><span className="text-white">Orders above Rs. 499:</span> FREE shipping</li>
                    <li><span className="text-white">Orders below Rs. 499:</span> Rs. 49 flat rate</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">Delivery Time</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li><span className="text-white">Metro cities:</span> 3-5 business days</li>
                    <li><span className="text-white">Other cities:</span> 5-7 business days</li>
                    <li><span className="text-white">Remote areas:</span> 7-10 business days</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">Order Tracking</h3>
                  <p className="text-gray-400">
                    Once your order is shipped, you will receive a tracking number via email 
                    and SMS. You can track your order on our website or the courier partner&apos;s website.
                  </p>
                </div>
              </div>
            </div>

            {/* Returns Policy */}
            <div 
              className="p-8 rounded-2xl mb-8"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <h2 
                className="text-2xl font-bold text-white mb-6"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Returns Policy
              </h2>
              
              <div className="space-y-6 text-gray-300">
                <div>
                  <h3 className="font-semibold text-white mb-2">Return Window</h3>
                  <p className="text-gray-400">
                    You may return unused, unopened products within <span className="text-[#D4AF37] font-semibold">7 days</span> of delivery.
                  </p>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">Return Conditions</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-400">
                    <li>Product must be unused and in original packaging</li>
                    <li>All tags and seals must be intact</li>
                    <li>Original invoice must be included</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-semibold text-white mb-2">Refund Process</h3>
                  <p className="text-gray-400">
                    Refunds are processed within 5-7 business days after we receive and inspect 
                    the returned item. The amount will be credited to your original payment method.
                  </p>
                </div>
                
                <div 
                  className="p-4 rounded-lg flex gap-3"
                  style={{ 
                    background: 'rgba(234,179,8,0.1)',
                    border: '1px solid rgba(234,179,8,0.3)'
                  }}
                >
                  <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-400">Non-Returnable Items</h4>
                    <p className="text-sm text-yellow-300/80">
                      Opened or used incense products cannot be returned due to hygiene reasons.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div 
              className="text-center p-8 rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.2) 100%)',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              <h3 className="font-semibold text-white mb-2">Need Help?</h3>
              <p className="text-gray-400 mb-4">
                Contact our support team for any shipping or return queries.
              </p>
              <div className="text-gray-300">
                <p><span className="text-[#D4AF37]">Email:</span> contact.us@centraders.com</p>
                <p><span className="text-[#D4AF37]">Phone:</span> (+91) 9667-269-711</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
