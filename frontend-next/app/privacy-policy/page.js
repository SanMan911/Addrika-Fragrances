import Link from 'next/link';
import { Shield } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'Privacy Policy | Addrika by Centsible Traders',
  description: 'Read Addrika\'s privacy policy. Learn how we collect, use, and protect your personal information when you shop for premium incense products.',
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
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
              <Shield className="w-6 h-6 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-3xl font-bold text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Privacy Policy
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
              <h2 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h2>
              <p className="text-gray-300 leading-relaxed">
                We collect information you provide directly to us, including name, email address, 
                phone number, shipping address, and payment information when you make a purchase.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h2>
              <p className="text-gray-300 mb-3">We use the information we collect to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Process and fulfill your orders</li>
                <li>Send order confirmations and shipping updates</li>
                <li>Respond to your comments and questions</li>
                <li>Improve our products and services</li>
                <li>Send promotional communications (with your consent)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">3. Information Sharing</h2>
              <p className="text-gray-300 mb-3">
                We do not sell your personal information. We share your information only with:
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Payment processors to complete transactions</li>
                <li>Shipping partners to deliver your orders</li>
                <li>Service providers who assist our operations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">4. Data Security</h2>
              <p className="text-gray-300 leading-relaxed">
                We implement appropriate security measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">5. Your Rights</h2>
              <p className="text-gray-300 mb-3">You have the right to:</p>
              <ul className="list-disc list-inside text-gray-300 space-y-2 ml-4">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Opt out of marketing communications</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. Contact Us</h2>
              <p className="text-gray-300 mb-4">
                If you have any questions about this Privacy Policy, please contact us at:
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
