import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Shield, Eye, Database, Lock, UserCheck, Mail } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const PrivacyPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title="Privacy Policy | Addrika by Centsibl Traders"
        description="Read Addrika's privacy policy. Learn how we collect, use, and protect your personal information when you shop for premium incense products."
        url="https://centraders.com/privacy-policy"
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
              Privacy Policy
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
            <p className="text-gray-600 leading-relaxed">
              At Addrika ("we," "our," or "us"), we are committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
              when you visit our website or make a purchase. Please read this policy carefully.
            </p>
          </section>

          {/* Information We Collect */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Database size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Information We Collect
              </h2>
            </div>

            <div className="space-y-4 text-gray-600 dark:text-gray-300">
              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Personal Information
                </h3>
                <p>When you place an order or submit an inquiry, we collect:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Full name</li>
                  <li>Email address</li>
                  <li>Phone number</li>
                  <li>Shipping address (street, city, state, pincode)</li>
                  <li>Payment information (processed securely by Razorpay)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--text-dark)' }}>
                  Automatically Collected Information
                </h3>
                <p>When you visit our website, we may automatically collect:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Browser type and version</li>
                  <li>Device information</li>
                  <li>IP address</li>
                  <li>Pages visited and time spent</li>
                  <li>Referring website</li>
                </ul>
              </div>
            </div>
          </section>

          {/* How We Use Information */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <Eye size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                How We Use Your Information
              </h2>
            </div>

            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Process and fulfill your orders</li>
              <li>Send order confirmations and shipping updates</li>
              <li>Respond to your inquiries and customer service requests</li>
              <li>Improve our website and product offerings</li>
              <li>Send promotional communications (only with your consent)</li>
              <li>Prevent fraudulent transactions</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          {/* Data Security */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Lock size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Data Security
              </h2>
            </div>

            <div className="text-gray-600 space-y-3">
              <p>
                We implement appropriate technical and organizational security measures to protect 
                your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
              <p>
                Payment transactions are processed through Razorpay, a PCI-DSS compliant payment gateway. 
                We do not store your credit/debit card details on our servers.
              </p>
            </div>
          </section>

          {/* Your Rights */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <UserCheck size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Your Rights
              </h2>
            </div>

            <div className="text-gray-600 space-y-3">
              <p>You have the right to:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Access the personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information</li>
                <li>Opt-out of marketing communications</li>
                <li>Withdraw consent where applicable</li>
              </ul>
              <p className="mt-4">
                To exercise any of these rights, please contact us at{' '}
                <a 
                  href="mailto:contact.us@centraders.com" 
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  contact.us@centraders.com
                </a>
              </p>
            </div>
          </section>

          {/* Third-Party Services */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Shield size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Third-Party Services
              </h2>
            </div>

            <div className="text-gray-600 space-y-3">
              <p>We may use third-party services that collect information, including:</p>
              <ul className="list-disc list-inside space-y-1">
                <li><strong>Razorpay:</strong> For secure payment processing</li>
                <li><strong>Shipping Partners:</strong> For order delivery</li>
                <li><strong>Analytics Services:</strong> To understand website usage</li>
              </ul>
              <p className="mt-3">
                These third parties have their own privacy policies governing the use of your information.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--japanese-indigo)' }}>
              Contact Us
            </h2>
            
            <p className="text-gray-600 mb-4">
              If you have any questions about this Privacy Policy, please contact us:
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

export default PrivacyPolicy;
