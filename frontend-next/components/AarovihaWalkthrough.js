'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, ShoppingCart, Smartphone, Monitor, KeyRound,
  Check, FileText, Truck, ArrowRight, Boxes,
} from 'lucide-react';

const GOLD = '#D4AF37';

const CHAPTERS = [
  {
    id: 'browse',
    seconds: 10,
    label: 'Browse',
    title: 'Open Aaroviah and browse the trade catalogue',
    body: 'Your field rep or your own phone — same wholesale catalogue, same live stock, carton pricing already applied to your account tier.',
    device: 'phone',
  },
  {
    id: 'cart',
    seconds: 10,
    label: 'Build cart',
    title: 'Add cartons — the maths is done for you',
    body: 'Pick cartons or half-cartons. Pieces, GST and your wholesale discount are calculated live, so what you see is what you pay.',
    device: 'phone',
  },
  {
    id: 'handoff',
    seconds: 10,
    label: 'Continue on web',
    title: 'Tap “Continue on web” when you are ready to pay',
    body: 'One tap. No re-typing your GSTIN, no second login, no lost cart.',
    device: 'phone',
  },
  {
    id: 'token',
    seconds: 10,
    label: 'Secure token',
    title: 'A one-time handoff token travels with you',
    body: 'Aaroviah mints a single-use token that expires in minutes. Your password never leaves the app.',
    device: 'bridge',
  },
  {
    id: 'web',
    seconds: 10,
    label: 'Auto login',
    title: 'The browser opens you already signed in',
    body: 'Same cart, same prices, same retailer account — now on a big screen with shipping options and trade credit.',
    device: 'desktop',
  },
  {
    id: 'pay',
    seconds: 10,
    label: 'Pay & track',
    title: 'Pay, get your GST invoice, track dispatch',
    body: 'HSN-coded PDF invoice the moment payment lands, Shiprocket rates by pincode, and Fragrance Rewards credited to your account.',
    device: 'desktop',
  },
];

const TOTAL_SECONDS = CHAPTERS.reduce((s, c) => s + c.seconds, 0);

function chapterAt(elapsed) {
  let acc = 0;
  for (let i = 0; i < CHAPTERS.length; i += 1) {
    acc += CHAPTERS[i].seconds;
    if (elapsed < acc) return i;
  }
  return CHAPTERS.length - 1;
}

function startOf(index) {
  return CHAPTERS.slice(0, index).reduce((s, c) => s + c.seconds, 0);
}

function fmt(sec) {
  const s = Math.floor(sec);
  return `0:${String(s).padStart(2, '0')}`;
}

function PhoneFrame({ children, label }) {
  return (
    <div
      className="relative mx-auto w-[240px] rounded-[2rem] p-3"
      style={{ background: '#0a0d12', border: '1px solid rgba(212,175,55,0.35)', boxShadow: '0 30px 70px -20px rgba(0,0,0,0.8)' }}
    >
      <div className="h-1.5 w-16 mx-auto rounded-full mb-3" style={{ background: 'rgba(255,255,255,0.15)' }} />
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(170deg,#161c26 0%,#0f1419 100%)', minHeight: 330 }}>
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(212,175,55,0.1)' }}>
          <Smartphone size={12} style={{ color: GOLD }} />
          <span className="text-[10px] font-bold tracking-widest" style={{ color: GOLD }}>AAROVIAH</span>
          <span className="ml-auto text-[9px]" style={{ color: 'rgba(232,230,227,0.45)' }}>{label}</span>
        </div>
        <div className="p-3 space-y-2">{children}</div>
      </div>
    </div>
  );
}

function DesktopFrame({ children, label }) {
  return (
    <div
      className="relative mx-auto w-full max-w-[420px] rounded-2xl overflow-hidden"
      style={{ background: '#0a0d12', border: '1px solid rgba(212,175,55,0.35)', boxShadow: '0 30px 70px -20px rgba(0,0,0,0.8)' }}
    >
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
        <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
        <span className="w-2 h-2 rounded-full" style={{ background: '#22c55e' }} />
        <span className="ml-3 text-[9px] px-2 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.4)', color: 'rgba(232,230,227,0.5)' }}>
          centraders.com{label}
        </span>
      </div>
      <div className="p-4 space-y-2.5" style={{ background: 'linear-gradient(170deg,#161c26 0%,#0f1419 100%)', minHeight: 290 }}>
        {children}
      </div>
    </div>
  );
}

function Row({ title, sub, right, highlight }) {
  return (
    <div
      className="flex items-center gap-2.5 p-2.5 rounded-xl"
      style={{
        background: highlight ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${highlight ? 'rgba(212,175,55,0.4)' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(212,175,55,0.15)' }}>
        <Boxes size={13} style={{ color: GOLD }} />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold truncate" style={{ color: '#e8e6e3' }}>{title}</div>
        <div className="text-[9px]" style={{ color: 'rgba(232,230,227,0.5)' }}>{sub}</div>
      </div>
      <div className="ml-auto text-[10px] font-bold shrink-0" style={{ color: GOLD }}>{right}</div>
    </div>
  );
}

function Stage({ index }) {
  const ch = CHAPTERS[index];

  if (ch.id === 'browse') {
    return (
      <PhoneFrame label="Catalogue">
        <Row title="Kesar Chandan · 50g" sub="12 pcs / packet · in stock" right="₹792" />
        <Row title="Regal Rose · 200g" sub="16 pcs / carton · in stock" right="₹2,144" />
        <Row title="Oriental Oudh · 200g" sub="16 pcs / carton · 8 left" right="₹2,464" />
        <Row title="Grated Omani Bakhoor" sub="32 pcs / carton" right="₹5,120" />
      </PhoneFrame>
    );
  }

  if (ch.id === 'cart') {
    return (
      <PhoneFrame label="Trade cart">
        <Row title="Kesar Chandan · 50g" sub="2 cartons × 12 pcs = 24 pcs" right="₹1,584" />
        <Row title="Regal Rose · 200g" sub="1 carton × 16 pcs = 16 pcs" right="₹2,144" />
        <div className="pt-1 space-y-1 text-[10px]" style={{ color: 'rgba(232,230,227,0.6)' }}>
          <div className="flex justify-between"><span>Subtotal</span><span>₹3,728</span></div>
          <div className="flex justify-between"><span>Trade discount</span><span style={{ color: '#4ade80' }}>−₹186</span></div>
          <div className="flex justify-between"><span>GST 18%</span><span>₹638</span></div>
          <div className="flex justify-between pt-1 text-[12px] font-bold" style={{ color: GOLD, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <span>Payable</span><span>₹4,180</span>
          </div>
        </div>
      </PhoneFrame>
    );
  }

  if (ch.id === 'handoff') {
    return (
      <PhoneFrame label="Checkout">
        <Row title="2 SKUs · 40 pieces" sub="Sharma Traders · Nagpur" right="₹4,180" />
        <div className="pt-4">
          <div
            className="relative w-full py-2.5 rounded-xl text-center text-[11px] font-bold"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #a8842b 100%)`, color: '#1a1410' }}
          >
            Continue on web
            <span
              aria-hidden
              className="absolute -inset-1 rounded-xl animate-ping"
              style={{ background: 'rgba(212,175,55,0.25)', animationDuration: '1.6s' }}
            />
          </div>
          <p className="text-[9px] text-center mt-2" style={{ color: 'rgba(232,230,227,0.45)' }}>
            Opens your browser · cart comes along
          </p>
        </div>
      </PhoneFrame>
    );
  }

  if (ch.id === 'token') {
    return (
      <div className="flex items-center justify-center gap-3 sm:gap-5 py-6">
        <div className="rounded-2xl p-4" style={{ background: '#0a0d12', border: '1px solid rgba(212,175,55,0.3)' }}>
          <Smartphone size={30} style={{ color: GOLD }} />
        </div>
        <div className="relative flex-1 max-w-[150px] h-px" style={{ background: 'linear-gradient(90deg, rgba(212,175,55,0.7), rgba(212,175,55,0.15))' }}>
          <span
            className="absolute -top-3 left-0 px-2 py-0.5 rounded-full text-[9px] font-bold whitespace-nowrap aaroviah-token"
            style={{ background: 'rgba(212,175,55,0.16)', color: GOLD, border: '1px solid rgba(212,175,55,0.45)' }}
          >
            <KeyRound size={9} className="inline mr-1" />
            one-time token
          </span>
        </div>
        <div className="rounded-2xl p-4" style={{ background: '#0a0d12', border: '1px solid rgba(212,175,55,0.3)' }}>
          <Monitor size={30} style={{ color: GOLD }} />
        </div>
        <style jsx>{`
          .aaroviah-token {
            animation: slide 2.6s ease-in-out infinite;
          }
          @keyframes slide {
            0% { transform: translateX(0); opacity: 0; }
            15% { opacity: 1; }
            85% { opacity: 1; }
            100% { transform: translateX(110px); opacity: 0; }
          }
        `}</style>
      </div>
    );
  }

  if (ch.id === 'web') {
    return (
      <DesktopFrame label="/retailer/b2b">
        <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
          <Check size={12} /> Signed in automatically as Sharma Traders · GSTIN verified
        </div>
        <Row title="Kesar Chandan · 50g" sub="2 cartons · 24 pcs" right="₹1,584" />
        <Row title="Regal Rose · 200g" sub="1 carton · 16 pcs" right="₹2,144" />
        <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg" style={{ background: 'rgba(212,175,55,0.1)', color: GOLD }}>
          <ShoppingCart size={12} /> Cart carried over from Aaroviah — nothing re-entered
        </div>
      </DesktopFrame>
    );
  }

  return (
    <DesktopFrame label="/retailer/b2b/orders">
      <div className="flex items-center gap-2 text-[10px] p-2 rounded-lg" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' }}>
        <Check size={12} /> Payment received · Order AAR-B2B-10241
      </div>
      <Row title="GST invoice (PDF)" sub="HSN-coded · emailed to you" right="Download" />
      <div className="flex items-center gap-2 p-2.5 rounded-xl text-[10px]" style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(232,230,227,0.7)' }}>
        <Truck size={13} style={{ color: GOLD }} /> Dispatch in 24h · Shiprocket ETA 3 days to 440010
      </div>
      <div className="flex items-center gap-2 p-2.5 rounded-xl text-[10px]" style={{ background: 'rgba(212,175,55,0.1)', color: GOLD }}>
        <FileText size={13} /> +418 Fragrance Rewards credited to your trade account
      </div>
    </DesktopFrame>
  );
}

export default function AarovihaWalkthrough() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef(null);
  const index = chapterAt(elapsed);

  useEffect(() => {
    if (!playing) return undefined;
    timer.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= TOTAL_SECONDS) {
          setPlaying(false);
          return TOTAL_SECONDS - 0.01;
        }
        return next;
      });
    }, 100);
    return () => clearInterval(timer.current);
  }, [playing]);

  const jump = useCallback((i) => {
    setElapsed(startOf(i));
    setPlaying(true);
  }, []);

  const restart = useCallback(() => {
    setElapsed(0);
    setPlaying(true);
  }, []);

  const ch = CHAPTERS[index];
  const chapterElapsed = elapsed - startOf(index);

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: 'linear-gradient(160deg,#141a23 0%,#0d1116 100%)', border: '1px solid rgba(212,175,55,0.25)' }}
      data-testid="aaroviah-walkthrough"
    >
      {/* Stage */}
      <div className="grid md:grid-cols-2 gap-8 p-6 sm:p-10 items-center">
        <div key={ch.id} className="aaroviah-fade">
          <Stage index={index} />
        </div>

        <div className="aaroviah-fade" key={`copy-${ch.id}`}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[10px] font-bold tracking-[2px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(212,175,55,0.12)', color: GOLD, border: '1px solid rgba(212,175,55,0.3)' }}>
              STEP {index + 1} / {CHAPTERS.length}
            </span>
            <span className="text-[10px] tracking-wide uppercase" style={{ color: 'rgba(232,230,227,0.45)' }}>{ch.label}</span>
          </div>
          <h3
            className="text-2xl sm:text-3xl font-bold leading-snug"
            style={{ fontFamily: "'Playfair Display', serif", color: '#e8e6e3' }}
            data-testid="walkthrough-chapter-title"
          >
            {ch.title}
          </h3>
          <p className="text-sm md:text-base mt-4 leading-relaxed" style={{ color: 'rgba(232,230,227,0.68)' }}>
            {ch.body}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="px-6 sm:px-10 pb-7">
        <div className="flex items-center gap-1.5 mb-4">
          {CHAPTERS.map((c, i) => {
            const fill = i < index ? 1 : i > index ? 0 : Math.min(1, chapterElapsed / c.seconds);
            return (
              <button
                key={c.id}
                onClick={() => jump(i)}
                className="group flex-1 py-2"
                aria-label={`Jump to ${c.label}`}
                data-testid={`walkthrough-chapter-${c.id}`}
              >
                <span className="block h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <span
                    className="block h-full rounded-full transition-[width] duration-100 ease-linear"
                    style={{ width: `${fill * 100}%`, background: GOLD }}
                  />
                </span>
                <span
                  className="block mt-2 text-[9px] sm:text-[10px] text-left transition-colors"
                  style={{ color: i === index ? GOLD : 'rgba(232,230,227,0.4)' }}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #a8842b 100%)`, color: '#1a1410' }}
            aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
            data-testid="walkthrough-play-toggle"
          >
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <button
            onClick={restart}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-white/5"
            style={{ border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(232,230,227,0.8)' }}
            aria-label="Restart walkthrough"
            data-testid="walkthrough-restart"
          >
            <RotateCcw size={16} />
          </button>
          <span className="text-xs tabular-nums" style={{ color: 'rgba(232,230,227,0.5)' }} data-testid="walkthrough-timecode">
            {fmt(elapsed)} / 1:00
          </span>
          <a
            href="/retailer/register"
            className="ml-auto inline-flex items-center gap-2 text-xs font-semibold px-4 py-2.5 rounded-full transition-transform hover:-translate-y-0.5"
            style={{ border: `1px solid ${GOLD}`, color: GOLD }}
            data-testid="walkthrough-register-cta"
          >
            Get my retailer account <ArrowRight size={14} />
          </a>
        </div>
      </div>

      <style jsx>{`
        .aaroviah-fade {
          animation: fadeUp 0.6s ease-out both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
