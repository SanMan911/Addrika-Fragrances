import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Home, Truck, RefreshCcw, Shield, Mail, Phone, Instagram, AlertTriangle, MapPin, Clock } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const ShippingReturns = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title="Shipping & Returns Policy | Addrika Premium Incense"
        description="Free shipping on orders above Rs. 499. Easy 7-day returns for unused products. Fast delivery across India with real-time tracking for all Addrika incense orders."
        url="https://centraders.com/shipping-returns"
        keywords="addrika shipping, incense delivery india, agarbatti returns policy, free shipping incense, addrika return policy"
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
              data-testid="back-btn"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="home-btn"
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
              Shipping & Return Policy
            </h1>
            <p style={{ color: 'var(--text-subtle)' }}>
              Last updated: February 2026
            </p>
          </div>

          {/* Important Notice - No Returns */}
          <section 
            className="bg-amber-50 dark:bg-amber-900/20 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '2px solid #d97706' }}
          >
            <div className="flex items-start gap-4">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: '#d97706' }}
              >
                <AlertTriangle size={24} color="white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-3" style={{ color: '#92400e' }}>
                  Important: No Returns, Refunds, or Exchanges
                </h2>
                <p className="text-amber-800 dark:text-amber-200 mb-4">
                  Due to the nature of our products (incense sticks and fragrance items), we regret to inform that 
                  <strong> all sales are final</strong>. Once an order is placed, cancellations, returns, refunds, 
                  and exchanges are <strong>not admissible</strong>.
                </p>
                <p className="text-amber-700 dark:text-amber-300 text-sm">
                  Agarbattis and fragrance products are sensitive items that can absorb moisture and external odors. 
                  For hygiene and quality reasons, we cannot accept returns on any purchased items.
                </p>
              </div>
            </div>
          </section>

          {/* Shipping Policy */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Truck size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Shipping Policy
              </h2>
            </div>

            <div className="space-y-6" style={{ color: 'var(--text-dark)' }}>
              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                  Shipping Partner
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  All orders are shipped via <strong>ShipRocket</strong> and their network of courier partners. 
                  By placing an order, you acknowledge and agree to the shipping policies and terms of service 
                  of our logistics partners.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                  Delivery Timeline
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-3">
                  Orders are typically processed within 1-2 business days. Delivery times vary by location:
                </p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-2">
                  <li><strong>Metro cities (Delhi, Mumbai, Bangalore, etc.):</strong> 3-5 business days</li>
                  <li><strong>Other cities:</strong> 5-7 business days</li>
                  <li><strong>Remote areas:</strong> 7-10 business days</li>
                </ul>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-3">
                  * Delivery times are estimates and may vary based on courier partner availability and local conditions.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                  Shipping Charges
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Shipping charges are calculated in real-time at checkout based on your delivery pincode and order weight.
                </p>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-2">
                  <li><strong>FREE shipping</strong> on orders above ₹999</li>
                  <li><strong>FREE shipping</strong> for Delhi NCR and Bhagalpur (regardless of order value)</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                  Order Tracking
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  Once your order is shipped, you will receive an email with tracking details. 
                  You can track your order status anytime on our{' '}
                  <a 
                    href="/track-order" 
                    className="font-semibold hover:underline"
                    style={{ color: 'var(--metallic-gold)' }}
                  >
                    Track Order
                  </a>{' '}
                  page.
                </p>
              </div>
            </div>
          </section>

          {/* Address Change Policy */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 mb-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--japanese-indigo)' }}
              >
                <MapPin size={24} color="white" />
              </div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                Address Change Requests
              </h2>
            </div>

            <div className="space-y-4" style={{ color: 'var(--text-dark)' }}>
              <div 
                className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20"
                style={{ border: '1px solid #3b82f6' }}
              >
                <div className="flex items-start gap-3">
                  <Clock size={20} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-1" />
                  <div>
                    <p className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                      Request Before Shipping
                    </p>
                    <p className="text-blue-700 dark:text-blue-200 text-sm">
                      You may request a change of delivery address <strong>anytime before your order is shipped</strong>. 
                      Contact us immediately via email or phone with your order number and the new address.
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-gray-600 dark:text-gray-300">
                While we will make every effort to accommodate your address change request, please note that 
                <strong> we cannot guarantee</strong> that the change will be processed due to operational constraints. 
                Once an order is handed over to the courier partner, address modifications are generally not possible.
              </p>

              <p className="text-gray-600 dark:text-gray-300">
                For address change requests, please contact us at{' '}
                <a 
                  href="mailto:contact.us@centraders.com" 
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  contact.us@centraders.com
                </a>{' '}
                or call{' '}
                <a 
                  href="tel:+919667269711" 
                  className="font-semibold hover:underline"
                  style={{ color: 'var(--metallic-gold)' }}
                >
                  +91 9667-269-711
                </a>.
              </p>
            </div>
          </section>

          {/* Damaged Products */}
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
                Damaged Products
              </h2>
            </div>

            <div className="space-y-4" style={{ color: 'var(--text-dark)' }}>
              <p className="text-gray-600 dark:text-gray-300">
                We take utmost care in packing and dispatching every order to ensure that products reach you in 
                perfect condition. However, in the rare and unlikely event that you receive a damaged product, 
                please contact us <strong>within 24 hours of delivery</strong>.
              </p>

              <div 
                className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20"
                style={{ border: '1px solid #22c55e' }}
              >
                <p className="font-semibold text-green-800 dark:text-green-300 mb-2">
                  Important: Record Your Unboxing
                </p>
                <p className="text-green-700 dark:text-green-200 text-sm">
                  We strongly recommend recording a complete unboxing video when you receive your package. 
                  This video serves as essential proof in case of any damage claims and helps us resolve 
                  issues faster.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                  To report damaged products, provide:
                </h3>
                <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 ml-2">
                  <li>Your order number and registered email</li>
                  <li><strong>Unboxing video</strong> showing the package being opened</li>
                  <li>Clear photographs of the damaged product and packaging</li>
                  <li>2-3 short videos (approx. 10 seconds each) showing the damage clearly</li>
                </ul>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Note: The 24-hour reporting window begins from the time of delivery as recorded by the courier partner.
              </p>

              <div 
                className="p-4 rounded-lg"
                style={{ backgroundColor: 'var(--cream)' }}
              >
                <p className="text-gray-700 dark:text-gray-800">
                  Upon verification of genuine damage (with unboxing video as proof), you will receive a{' '}
                  <span style={{ color: 'var(--metallic-gold)', fontWeight: 'bold' }}>
                    one-time 10% discount code
                  </span>{' '}
                  for your next order as a gesture of goodwill.
                </p>
              </div>
            </div>
          </section>

          {/* Contact Information */}
          <section 
            className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8"
            style={{ border: '1px solid var(--border)' }}
          >
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--japanese-indigo)' }}>
              Contact Us
            </h2>
            
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              For any queries regarding shipping, address changes, or damaged products:
            </p>

            <div className="space-y-3">
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
              <div className="flex items-center gap-3">
                <Phone size={20} style={{ color: 'var(--metallic-gold)' }} />
                <a 
                  href="tel:+919667269711" 
                  className="hover:underline"
                  style={{ color: 'var(--japanese-indigo)' }}
                >
                  +91 9667-269-711
                </a>
              </div>
              <div className="flex items-center gap-3">
                <Instagram size={20} style={{ color: 'var(--metallic-gold)' }} />
                <a 
                  href="https://www.instagram.com/addrika.fragrances/" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                  style={{ color: 'var(--japanese-indigo)' }}
                >
                  @addrika.fragrances
                </a>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-6">
              We typically respond within 24-48 business hours.
            </p>
          </section>

          {/* Policy Summary */}
          <div 
            className="mt-8 p-6 rounded-lg text-center"
            style={{ backgroundColor: 'var(--cream)' }}
          >
            <p className="text-sm text-gray-600 dark:text-gray-700">
              By placing an order on our website, you acknowledge that you have read, understood, and agree to 
              our shipping and return policies as outlined above.
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default ShippingReturns;
