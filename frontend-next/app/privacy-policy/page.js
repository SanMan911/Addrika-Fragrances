import Link from 'next/link';
import { Shield, Eye, Database, Lock, UserCheck, Mail } from 'lucide-react';

export const metadata = {
  title: 'Privacy Policy | Addrika by Centsibl Traders',
  description: 'Read Addrika\'s privacy policy. Learn how we collect, use, and protect your personal information when you shop for premium incense products.',
  robots: { index: true, follow: true },
};

export default function PrivacyPolicyPage() {
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

      <main className="pt-24 pb-16 min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-8 h-8 text-[#D4AF37]" />
            <h1 className="text-3xl font-bold text-[#2B3A4A] font-serif">Privacy Policy</h1>
          </div>
          
          <p className="text-gray-600 mb-8">
            Last updated: March 2026
          </p>

          <div className="prose prose-lg max-w-none prose-headings:text-[#2B3A4A]">
            <h2>1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us, including name, email address, 
              phone number, shipping address, and payment information when you make a purchase.
            </p>

            <h2>2. How We Use Your Information</h2>
            <p>We use the information we collect to:</p>
            <ul>
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Respond to your comments and questions</li>
              <li>Improve our products and services</li>
              <li>Send promotional communications (with your consent)</li>
            </ul>

            <h2>3. Information Sharing</h2>
            <p>
              We do not sell your personal information. We share your information only with:
            </p>
            <ul>
              <li>Payment processors to complete transactions</li>
              <li>Shipping partners to deliver your orders</li>
              <li>Service providers who assist our operations</li>
            </ul>

            <h2>4. Data Security</h2>
            <p>
              We implement appropriate security measures to protect your personal information 
              against unauthorized access, alteration, disclosure, or destruction.
            </p>

            <h2>5. Your Rights</h2>
            <p>You have the right to:</p>
            <ul>
              <li>Access your personal information</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Opt out of marketing communications</li>
            </ul>

            <h2>6. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p>
              <strong>Email:</strong> contact.us@centraders.com<br />
              <strong>Phone:</strong> (+91) 9667-269-711
            </p>
          </div>
        </div>
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
