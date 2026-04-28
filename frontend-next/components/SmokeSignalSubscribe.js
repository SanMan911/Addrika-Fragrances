'use client';

import { useState } from 'react';
import { Flame, Send, Check, AlertCircle } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';

export default function SmokeSignalSubscribe() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setMessage('Please drop us a valid email address.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      const res = await fetch(`${API_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          name: name.trim() || null,
          preferences: {
            blog_posts: true,
            new_retailers: false,
            promotions: true,
            instagram_updates: false,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || 'Could not light the signal. Try again.');
      }

      setStatus('success');
      setMessage(
        data.message === 'Already subscribed'
          ? "You're already on the list — your inbox is waiting."
          : 'Smoke rising. Check your inbox for a warm welcome.'
      );
      setEmail('');
      setName('');
    } catch (err) {
      setStatus('error');
      setMessage(err.message || 'The wind blew it out. Try again in a moment.');
    }
  };

  return (
    <section className="py-16 px-4" data-testid="smoke-signal-section">
      <div className="max-w-4xl mx-auto">
        <div
          className="relative rounded-3xl overflow-hidden"
          style={{
            background:
              'linear-gradient(135deg, rgba(212,175,55,0.08) 0%, rgba(30,58,82,0.4) 60%, rgba(15,20,25,0.9) 100%)',
            border: '1px solid rgba(212,175,55,0.25)',
            boxShadow:
              '0 30px 80px -20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(212,175,55,0.15)',
          }}
        >
          {/* Smoke wisps — pure CSS */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-40"
            style={{
              background:
                'radial-gradient(circle at 15% 110%, rgba(212,175,55,0.25) 0%, transparent 40%), radial-gradient(circle at 85% 0%, rgba(212,175,55,0.15) 0%, transparent 50%)',
            }}
          />
          {/* Grain texture */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay"
            style={{
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.85\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
            }}
          />

          <div className="relative px-6 sm:px-12 py-12 sm:py-16">
            <div className="grid md:grid-cols-[auto,1fr] gap-8 items-start">
              {/* Left: Flame icon + label */}
              <div className="flex md:flex-col items-center md:items-start gap-4">
                <div
                  className="relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background:
                      'linear-gradient(135deg, #d4af37 0%, #8b6f1f 100%)',
                    boxShadow:
                      '0 0 40px rgba(212,175,55,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
                  }}
                >
                  <Flame
                    className="w-8 h-8 text-[#1a1410]"
                    strokeWidth={2.5}
                  />
                  <span
                    aria-hidden
                    className="absolute -inset-2 rounded-2xl animate-ping opacity-30"
                    style={{
                      background:
                        'radial-gradient(circle, rgba(212,175,55,0.4) 0%, transparent 70%)',
                      animationDuration: '3s',
                    }}
                  />
                </div>
                <span
                  className="hidden md:inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase"
                  style={{
                    background: 'rgba(212,175,55,0.12)',
                    color: '#D4AF37',
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  The Smoke Signal
                </span>
              </div>

              {/* Right: Copy + form */}
              <div>
                <span
                  className="md:hidden inline-block px-3 py-1 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase mb-4"
                  style={{
                    background: 'rgba(212,175,55,0.12)',
                    color: '#D4AF37',
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                >
                  The Smoke Signal
                </span>
                <h2
                  className="text-3xl sm:text-4xl font-bold text-white mb-3 leading-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Whispers from the Journal,
                  <br />
                  <span style={{ color: '#D4AF37' }}>
                    sent the moment they&apos;re lit.
                  </span>
                </h2>
                <p className="text-gray-300 text-base sm:text-lg mb-8 max-w-xl leading-relaxed">
                  New essays on incense, fragrance lore, and quiet rituals —
                  delivered the instant a fresh post catches flame. No noise.
                  No spam. Just smoke signals, when it matters.
                </p>

                {status === 'success' ? (
                  <div
                    role="status"
                    data-testid="smoke-signal-success"
                    className="flex items-center gap-3 p-4 rounded-xl"
                    style={{
                      background: 'rgba(34,197,94,0.1)',
                      border: '1px solid rgba(34,197,94,0.3)',
                    }}
                  >
                    <Check className="w-5 h-5 text-green-400 shrink-0" />
                    <p className="text-green-200 text-sm">{message}</p>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-3"
                    data-testid="smoke-signal-form"
                  >
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        placeholder="Your name (optional)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={status === 'loading'}
                        data-testid="smoke-signal-name-input"
                        className="flex-1 px-4 py-3 rounded-xl text-white placeholder:text-gray-500 outline-none transition-all focus:border-[#D4AF37] disabled:opacity-50"
                        style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          backdropFilter: 'blur(8px)',
                        }}
                      />
                      <input
                        type="email"
                        required
                        placeholder="you@somewhere.lovely"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === 'loading'}
                        data-testid="smoke-signal-email-input"
                        className="flex-[1.5] px-4 py-3 rounded-xl text-white placeholder:text-gray-500 outline-none transition-all focus:border-[#D4AF37] disabled:opacity-50"
                        style={{
                          background: 'rgba(0,0,0,0.35)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          backdropFilter: 'blur(8px)',
                        }}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <button
                        type="submit"
                        disabled={status === 'loading'}
                        data-testid="smoke-signal-submit-button"
                        className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-semibold text-[#1a1410] transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
                        style={{
                          background:
                            'linear-gradient(135deg, #f0c849 0%, #d4af37 50%, #a8842b 100%)',
                          boxShadow:
                            '0 10px 30px -10px rgba(212,175,55,0.5), inset 0 1px 0 rgba(255,255,255,0.3)',
                        }}
                      >
                        {status === 'loading' ? (
                          <>
                            <span className="w-4 h-4 border-2 border-[#1a1410] border-t-transparent rounded-full animate-spin" />
                            Lighting...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" strokeWidth={2.5} />
                            Send the Signal
                          </>
                        )}
                      </button>
                      <p className="text-xs text-gray-500 sm:ml-2">
                        Free. Unsubscribe in one click. We won&apos;t share your email.
                      </p>
                    </div>

                    {status === 'error' && (
                      <div
                        role="alert"
                        data-testid="smoke-signal-error"
                        className="flex items-center gap-2 text-sm text-red-300 mt-2"
                      >
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{message}</span>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
