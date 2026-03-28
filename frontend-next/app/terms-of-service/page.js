import Link from 'next/link';
import { FileText } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'Terms of Service | Addrika by Centsibl Traders',
  description: 'Read Addrika\'s terms of service. Understand the terms and conditions for purchasing premium incense products from Centsibl Traders.',
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <div 
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <FileText className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Terms of Service
            </h1>
          </div>
          
          <p className="text-gray-400 mb-8">
            Last updated: March 2026
          </p>

          <div 
            className="p-8 rounded-2xl space-y-8"
            style={{ 
              background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <section>
              <h2 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
              <p className="text-gray-300 leading-relaxed">
                By accessing and using this website, you accept and agree to be bound by these 
                Terms of Service and our Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. Products and Pricing</h2>
              <p className="text-gray-300 leading-relaxed">
                All products are subject to availability. We reserve the right to discontinue 
                any product at any time. Prices are subject to change without notice.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. Orders and Payment</h2>
              <p className="text-gray-300 leading-relaxed">
                When you place an order, you are making an offer to purchase. We reserve the 
                right to accept or decline your order. Payment must be received before order 
                processing begins.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. Shipping</h2>
              <p className="text-gray-300 leading-relaxed">
                We ship to addresses within India. Shipping times are estimates and may vary 
                based on location and carrier delays. Free shipping is available on orders 
                above Rs. 499.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Returns and Refunds</h2>
              <p className="text-gray-300 leading-relaxed">
                We accept returns of unused, unopened products within 7 days of delivery. 
                Please refer to our Shipping & Returns policy for complete details.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Intellectual Property</h2>
              <p className="text-gray-300 leading-relaxed">
                All content on this website, including text, images, logos, and designs, is 
                the property of Centsibl Traders Private Limited and is protected by 
                copyright laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. Limitation of Liability</h2>
              <p className="text-gray-300 leading-relaxed">
                Centsibl Traders shall not be liable for any indirect, incidental, special, 
                or consequential damages arising from your use of our products or services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. Contact Information</h2>
              <p className="text-gray-300 mb-4">
                For questions about these Terms, contact us at:
              </p>
              <div className="text-gray-300">
                <p><span className="text-[#D4AF37]">Email:</span> contact.us@centraders.com</p>
                <p><span className="text-[#D4AF37]">Phone:</span> (+91) 9667-269-711</p>
              </div>
            </section>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
