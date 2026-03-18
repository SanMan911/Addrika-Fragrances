import Link from 'next/link';
import { FileText } from 'lucide-react';

export const metadata = {
  title: 'Terms of Service | Addrika by Centsibl Traders',
  description: 'Read Addrika\'s terms of service. Understand the terms and conditions for purchasing premium incense products from Centsibl Traders.',
  robots: { index: true, follow: true },
};

export default function TermsOfServicePage() {
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
            <FileText className="w-8 h-8 text-[#D4AF37]" />
            <h1 className="text-3xl font-bold text-[#2B3A4A] font-serif">Terms of Service</h1>
          </div>
          
          <p className="text-gray-600 mb-8">
            Last updated: March 2026
          </p>

          <div className="prose prose-lg max-w-none prose-headings:text-[#2B3A4A]">
            <h2>1. Acceptance of Terms</h2>
            <p>
              By accessing and using this website, you accept and agree to be bound by these 
              Terms of Service and our Privacy Policy.
            </p>

            <h2>2. Products and Pricing</h2>
            <p>
              All products are subject to availability. We reserve the right to discontinue 
              any product at any time. Prices are subject to change without notice.
            </p>

            <h2>3. Orders and Payment</h2>
            <p>
              When you place an order, you are making an offer to purchase. We reserve the 
              right to accept or decline your order. Payment must be received before order 
              processing begins.
            </p>

            <h2>4. Shipping</h2>
            <p>
              We ship to addresses within India. Shipping times are estimates and may vary 
              based on location and carrier delays. Free shipping is available on orders 
              above ₹499.
            </p>

            <h2>5. Returns and Refunds</h2>
            <p>
              We accept returns of unused, unopened products within 7 days of delivery. 
              Please refer to our Shipping & Returns policy for complete details.
            </p>

            <h2>6. Intellectual Property</h2>
            <p>
              All content on this website, including text, images, logos, and designs, is 
              the property of Centsibl Traders Private Limited and is protected by 
              copyright laws.
            </p>

            <h2>7. Limitation of Liability</h2>
            <p>
              Centsibl Traders shall not be liable for any indirect, incidental, special, 
              or consequential damages arising from your use of our products or services.
            </p>

            <h2>8. Contact Information</h2>
            <p>
              For questions about these Terms, contact us at:
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
