import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, FileText, Scale, ShoppingBag, AlertTriangle, Mail } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const TermsOfService = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title="Terms of Service | Addrika by Centsibl Traders"
        description="Read Addrika's terms of service. Understand the terms and conditions for purchasing premium incense products from Centsibl Traders."
        url="https://centraders.com/terms-of-service"
        noIndex={false}
      />
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Navigation buttons */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <Home size={20} />
              <span>Home</span>
            </button>
          </div>

          {/* Header */}
          <div className="text-center mb-12">
            <h1 
              className="text-4xl font-bold mb-4"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Terms of Service
            </h1>
            <p style={{ color: 'var(--text-subtle)' }}>
              Last updated: January 2026
            </p>
          </div>

          {/* Introduction */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Welcome to Addrika. By accessing our website and placing orders, you agree to be bound by 
              these Terms of Service. Please read them carefully before using our services.
            </p>
          </section>

          {/* General Terms */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <FileText size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                General Terms
              </h2>
            </div>

            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Acceptance of Terms
                </h3>
                <p>
                  By using this website, you confirm that you are at least 18 years of age and have 
                  the legal capacity to enter into binding contracts. If you do not agree with any 
                  part of these terms, please do not use our services.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Changes to Terms
                </h3>
                <p>
                  We reserve the right to modify these terms at any time. Changes will be effective 
                  immediately upon posting on this page. Your continued use of the website after 
                  changes constitutes acceptance of the modified terms.
                </p>
              </div>
            </div>
          </section>

          {/* Products & Orders */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <ShoppingBag size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Products & Orders
              </h2>
            </div>

            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Product Information
                </h3>
                <p>
                  We strive to provide accurate product descriptions and images. However, we do not 
                  warrant that product descriptions, pricing, or other content is accurate, complete, 
                  or error-free. Colors may vary slightly due to screen settings.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Pricing
                </h3>
                <p>
                  All prices are in Indian Rupees (INR) and include applicable taxes. We reserve the 
                  right to change prices at any time without prior notice. Promotional discounts may 
                  have specific terms and conditions.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Order Acceptance
                </h3>
                <p>
                  An order is confirmed only after successful payment processing. We reserve the right 
                  to refuse or cancel any order for reasons including but not limited to product 
                  availability, errors in pricing, or suspected fraudulent activity.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Returns & Refunds
                </h3>
                <p>
                  Due to the nature of fragrance products, <strong>all sales are final</strong>. 
                  We do not accept returns or exchanges. Please refer to our{' '}
                  <a 
                    href="/shipping-returns" 
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--metallic-gold)' }}
                  >
                    Shipping & Return Policy
                  </a>{' '}
                  for complete details.
                </p>
              </div>
            </div>
          </section>

          {/* Intellectual Property */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Scale size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Intellectual Property
              </h2>
            </div>

            <div className="text-gray-600 dark:text-gray-300 space-y-3">
              <p>
                All content on this website, including but not limited to text, graphics, logos, 
                images, and software, is the property of Addrika and is protected by copyright and 
                trademark laws.
              </p>
              <p>
                You may not reproduce, distribute, modify, or create derivative works from any 
                content without our prior written consent.
              </p>
            </div>
          </section>

          {/* Limitation of Liability */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <AlertTriangle size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Limitation of Liability
              </h2>
            </div>

            <div className="text-gray-600 dark:text-gray-300 space-y-3">
              <p>
                To the fullest extent permitted by law, Addrika shall not be liable for any indirect, 
                incidental, special, consequential, or punitive damages arising from your use of our 
                products or services.
              </p>
              <p>
                Our total liability shall not exceed the amount paid by you for the specific product 
                or service giving rise to the claim.
              </p>
            </div>
          </section>

          {/* Governing Law */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
              Governing Law
            </h2>
            <p className="text-gray-600 dark:text-gray-300">
              These Terms of Service shall be governed by and construed in accordance with the laws 
              of India. Any disputes arising from these terms shall be subject to the exclusive 
              jurisdiction of the courts in New Delhi, India.
            </p>
          </section>

          {/* Contact */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--japanese-indigo)' }}>
              Contact Us
            </h2>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              For any questions regarding these Terms of Service, please contact us:
            </p>

            <div className="flex items-center gap-3">
              <Mail size={20} style={{ color: 'var(--metallic-gold)' }} />
              <a 
                href="mailto:contact.us@centraders.com" 
                className="hover:underline"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                contact.us@centraders.com
              </a>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
