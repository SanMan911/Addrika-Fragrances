'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Handshake, ShieldCheck, Truck, Coins, Smartphone, FileText, LogIn, PhoneCall,
  Download, CheckCircle2, ArrowRight, Boxes, BadgePercent, PlayCircle,
} from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';
import RetailerPartnershipModal from '../../components/RetailerPartnershipModal';
import BRAND from '../../lib/brand.config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STEPS = [
  { n: '01', title: 'Enter your GSTIN', body: 'We auto-fill your business name and address from the GST registry — no typing.' },
  { n: '02', title: 'Verify your phone', body: 'One SMS OTP to your +91 number. Takes 30 seconds.' },
  { n: '03', title: 'Upload GST certificate', body: 'PDF or photo. Our team approves most accounts within one working day.' },
  { n: '04', title: 'Start ordering', body: 'Wholesale catalogue, live stock, carton math and GST invoices — on web or the Aaroviah app.' },
];

const PERKS = [
  { Icon: BadgePercent, title: 'Wholesale pricing', body: 'Tiered carton pricing with quantity discounts and a cash-discount option on prepaid orders.' },
  { Icon: Boxes, title: 'Live stock, no surprises', body: 'Every SKU shows real-time availability. Pre-order out-of-stock lines with a 50% token.' },
  { Icon: Coins, title: 'Fragrance Rewards', body: 'Earn trade credit on every paid order and redeem it against your next invoice.' },
  { Icon: Truck, title: 'Distance-based shipping', body: 'Transparent Shiprocket rates by pincode, or pick up from a partner store.' },
  { Icon: Smartphone, title: 'Order from your phone', body: 'Build carts in the Aaroviah app and finish checkout on the web — signed in automatically.' },
  { Icon: ShieldCheck, title: 'GST-compliant invoices', body: 'HSN-coded PDF invoices for every order, synced to our books.' },
];

export default function WholesalePage() {
  const [callbackOpen, setCallbackOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: '#0f1419' }} data-testid="wholesale-page">
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.2fr_1fr] gap-12 items-center">
          <div>
            <p className="text-xs tracking-[3px] uppercase mb-4" style={{ color: BRAND.colors.gold }}>For business · Wholesale</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight" style={{ fontFamily: "'Playfair Display', serif", color: '#e8e6e3' }}>
              Stock {BRAND.name} at your store.
            </h1>
            <p className="text-base md:text-lg mt-6 max-w-xl" style={{ color: 'rgba(232,230,227,0.72)' }}>
              A self-serve wholesale portal for retailers, gift shops and spiritual stores. GST-verified onboarding in under five minutes — then order cartons any time, from web, phone, or through your {BRAND.name} field representative.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Link
                href="/retailer/register"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform hover:-translate-y-0.5"
                style={{ background: `linear-gradient(135deg, ${BRAND.colors.gold} 0%, ${BRAND.colors.goldDark} 100%)`, color: BRAND.colors.ink }}
                data-testid="wholesale-register-cta"
              >
                <Handshake size={18} /> Register as a retailer <ArrowRight size={16} />
              </Link>
              <Link
                href="/retailer/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm border transition-colors hover:bg-white/5"
                style={{ borderColor: 'rgba(212,175,55,0.45)', color: '#e8e6e3' }}
                data-testid="wholesale-login-cta"
              >
                <LogIn size={18} /> Retailer login
              </Link>
              <Link
                href="/retailer/onboarding"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm border transition-colors hover:bg-white/5"
                style={{ borderColor: 'rgba(212,175,55,0.45)', color: '#e8e6e3' }}
                data-testid="wholesale-walkthrough-cta"
              >
                <PlayCircle size={18} /> Watch the 60-sec walkthrough
              </Link>
            </div>
            <div className="flex flex-wrap gap-4 mt-6 text-xs" style={{ color: 'rgba(232,230,227,0.55)' }}>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} style={{ color: BRAND.colors.gold }} /> GSTIN required</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} style={{ color: BRAND.colors.gold }} /> SMS OTP verified</span>
              <span className="inline-flex items-center gap-1"><CheckCircle2 size={14} style={{ color: BRAND.colors.gold }} /> Pan-India shipping</span>
            </div>
          </div>

          <div className="rounded-3xl p-8 relative overflow-hidden" style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0f1419 100%)', border: '1px solid rgba(212,175,55,0.3)' }}>
            <div className="text-[10px] font-bold tracking-[2px]" style={{ color: BRAND.colors.gold }}>HOW ONBOARDING WORKS</div>
            <ol className="mt-5 space-y-5">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="text-2xl font-bold leading-none" style={{ fontFamily: "'Playfair Display', serif", color: 'rgba(212,175,55,0.7)' }}>{s.n}</span>
                  <div>
                    <div className="font-semibold" style={{ color: '#e8e6e3' }}>{s.title}</div>
                    <div className="text-sm mt-0.5" style={{ color: 'rgba(232,230,227,0.6)' }}>{s.body}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ background: '#131a22' }}>
        <div className="max-w-6xl mx-auto">
          <h2 className="text-base md:text-lg font-semibold tracking-wide uppercase" style={{ color: BRAND.colors.gold }}>What partners get</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {PERKS.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-2xl p-6 transition-transform hover:-translate-y-1" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.18)' }}>
                <Icon size={22} style={{ color: BRAND.colors.gold }} />
                <div className="font-semibold mt-4" style={{ color: '#e8e6e3' }}>{title}</div>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(232,230,227,0.62)' }}>{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Secondary actions */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6">
          <a
            href={`${API_URL}/api/brochure/download`}
            className="rounded-2xl p-6 flex flex-col gap-3 hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(212,175,55,0.3)' }}
            data-testid="wholesale-brochure-link"
          >
            <Download size={22} style={{ color: BRAND.colors.gold }} />
            <div className="font-semibold" style={{ color: '#e8e6e3' }}>Download the trade brochure</div>
            <p className="text-sm" style={{ color: 'rgba(232,230,227,0.6)' }}>Full range, carton sizes and MRP — share it with your buying team.</p>
          </a>
          <button
            type="button"
            onClick={() => setCallbackOpen(true)}
            className="rounded-2xl p-6 flex flex-col gap-3 text-left hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(212,175,55,0.3)' }}
            data-testid="wholesale-callback-btn"
          >
            <PhoneCall size={22} style={{ color: BRAND.colors.gold }} />
            <div className="font-semibold" style={{ color: '#e8e6e3' }}>Prefer a callback?</div>
            <p className="text-sm" style={{ color: 'rgba(232,230,227,0.6)' }}>Leave your GSTIN and a {BRAND.name} representative will call you back and onboard you personally.</p>
          </button>
          <Link
            href="/find-retailers"
            className="rounded-2xl p-6 flex flex-col gap-3 hover:bg-white/5 transition-colors"
            style={{ border: '1px solid rgba(212,175,55,0.3)' }}
            data-testid="wholesale-find-retailers-link"
          >
            <FileText size={22} style={{ color: BRAND.colors.gold }} />
            <div className="font-semibold" style={{ color: '#e8e6e3' }}>See our partner stores</div>
            <p className="text-sm" style={{ color: 'rgba(232,230,227,0.6)' }}>Browse the retailers already stocking {BRAND.name} across India.</p>
          </Link>
        </div>
      </section>

      <Footer />
      <RetailerPartnershipModal open={callbackOpen} onClose={() => setCallbackOpen(false)} />
    </div>
  );
}
