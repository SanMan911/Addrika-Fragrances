'use client';

import { useState } from 'react';
import Header from '../components/Header';
import Hero from '../components/Hero';
import FragranceGrid from '../components/FragranceGrid';
import Footer from '../components/Footer';

export default function HomePage() {
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Header onInquiryClick={() => setIsInquiryOpen(true)} />
      <Hero />
      <FragranceGrid />
      
      {/* CSR Section Placeholder */}
      <section id="csr" className="py-20 bg-[#faf7f2] dark:bg-[#0f1419]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span 
            className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
            style={{ 
              background: 'rgba(212,175,55,0.1)', 
              color: '#D4AF37',
              border: '1px solid rgba(212,175,55,0.2)'
            }}
          >
            OUR COMMITMENT
          </span>
          <h2 
            className="text-4xl sm:text-5xl font-bold mb-6 text-[#2B3A4A] dark:text-white"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            Corporate Social Responsibility
          </h2>
          <p className="text-lg max-w-3xl mx-auto text-[#666] dark:text-gray-300 mb-8">
            At Addrika, we believe in giving back to the community. A portion of every purchase 
            goes towards supporting artisan communities and environmental conservation efforts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
            <div className="p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(212,175,55,0.1)' }}>
                <span className="text-2xl">🌱</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#2B3A4A] dark:text-white">Eco-Friendly</h3>
              <p className="text-sm text-[#666] dark:text-gray-400">100% natural ingredients with zero harmful chemicals</p>
            </div>
            <div className="p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(212,175,55,0.1)' }}>
                <span className="text-2xl">👥</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#2B3A4A] dark:text-white">Community Support</h3>
              <p className="text-sm text-[#666] dark:text-gray-400">Supporting local artisans and their families</p>
            </div>
            <div className="p-6 rounded-xl bg-white dark:bg-slate-800 shadow-lg">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(212,175,55,0.1)' }}>
                <span className="text-2xl">🇮🇳</span>
              </div>
              <h3 className="text-xl font-semibold mb-2 text-[#2B3A4A] dark:text-white">Made in India</h3>
              <p className="text-sm text-[#666] dark:text-gray-400">Proudly crafted in India with traditional methods</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {/* Inquiry Modal */}
      {isInquiryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#2B3A4A] dark:text-white">Wholesale Inquiry</h3>
              <button onClick={() => setIsInquiryOpen(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              For wholesale inquiries, please contact us at:
            </p>
            <div className="space-y-2 mb-6">
              <p className="font-medium">Email: <a href="mailto:care@centraders.com" className="text-[#D4AF37]">care@centraders.com</a></p>
              <p className="font-medium">Phone: <a href="tel:+919876543210" className="text-[#D4AF37]">+91 98765 43210</a></p>
            </div>
            <button 
              onClick={() => setIsInquiryOpen(false)}
              className="w-full py-3 rounded-xl text-white font-semibold"
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
