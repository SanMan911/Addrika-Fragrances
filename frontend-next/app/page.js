'use client';

import { useState } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import FragranceGrid from '../components/FragranceGrid';
import USPSection from '../components/USPSection';
import PackagingSection from '../components/PackagingSection';
import CSRSection from '../components/CSRSection';
import InstagramFeed from '../components/InstagramFeed';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';

export default function HomePage() {
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Header onInquiryClick={() => setIsInquiryOpen(true)} />
      <Hero />
      <FragranceGrid />
      <USPSection />
      <PackagingSection />
      <CSRSection />
      <InstagramFeed />
      <CTASection />
      <Footer />

      {/* Inquiry Modal */}
      {isInquiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-[#2B3A4A] dark:text-white" style={{ fontFamily: "'Playfair Display', serif" }}>
                Wholesale Inquiry
              </h3>
              <button 
                onClick={() => setIsInquiryOpen(false)} 
                className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              >
                <span className="text-2xl text-gray-500">×</span>
              </button>
            </div>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Interested in becoming a retail partner or placing bulk orders? 
              We'd love to hear from you!
            </p>
            <div className="space-y-4 mb-8">
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                <a 
                  href="mailto:care@centraders.com" 
                  className="text-lg font-semibold hover:underline"
                  style={{ color: '#D4AF37' }}
                >
                  care@centraders.com
                </a>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Phone</p>
                <a 
                  href="tel:+919876543210" 
                  className="text-lg font-semibold hover:underline"
                  style={{ color: '#D4AF37' }}
                >
                  +91 98765 43210
                </a>
              </div>
            </div>
            <button 
              onClick={() => setIsInquiryOpen(false)}
              className="w-full py-4 rounded-xl text-white font-semibold text-lg transition-all hover:opacity-90"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
