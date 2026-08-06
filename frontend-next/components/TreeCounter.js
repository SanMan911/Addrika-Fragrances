'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Trees, ArrowRight } from 'lucide-react';
import { useImpact } from '../context/ImpactContext';

/**
 * Slow-ticking tree-plantation counter.
 *
 * The **authoritative** value comes from the shared <ImpactProvider> —
 * a single `/api/impact/trees` fetch feeds every impact widget on the
 * page (see /app/frontend-next/context/ImpactContext.js).
 *
 * Once we know the target we count from 0 up to it visually (spring
 * easing), so returning visitors always feel the number growing.
 */
export default function TreeCounter() {
  const { trees: target, note, ctaHref } = useImpact();
  const [displayed, setDisplayed] = useState(0);
  const rafRef = useRef(null);

  // count-up animation
  useEffect(() => {
    if (target === null || target === undefined) return;
    const duration = 2400;
    const start = performance.now();
    const initial = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayed(Math.round(initial + (target - initial) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [target]);

  if (target === null || target === undefined) return null;

  return (
    <div
      className="relative inline-flex items-center gap-4 px-6 py-3 rounded-full"
      style={{
        background:
          'linear-gradient(135deg, rgba(212,175,55,0.14), rgba(16,185,129,0.10))',
        border: '1px solid rgba(212,175,55,0.35)',
        color: '#fff',
        backdropFilter: 'blur(6px)',
      }}
      data-testid="home-tree-counter"
      title={note || undefined}
    >
      <span
        className="inline-flex items-center justify-center rounded-full"
        style={{
          width: 36,
          height: 36,
          background: 'linear-gradient(135deg, #16a34a 0%, #059669 100%)',
        }}
      >
        <Trees size={18} strokeWidth={2.2} />
      </span>
      <span className="text-sm sm:text-base leading-tight">
        <span
          className="block text-[10px] tracking-[2.5px] font-semibold uppercase"
          style={{ color: '#D4AF37' }}
        >
          Every scent, a tree
        </span>
        <span className="flex items-baseline gap-1">
          <span
            className="text-2xl sm:text-3xl font-bold tabular-nums"
            style={{ color: '#fff' }}
            data-testid="tree-counter-value"
          >
            {displayed.toLocaleString('en-IN')}
          </span>
          <span className="text-xs text-white/70">trees planted so far</span>
        </span>
      </span>
      <Link
        href={ctaHref}
        className="ml-2 inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap"
        style={{ color: '#D4AF37' }}
        data-testid="tree-counter-cta"
      >
        Learn more <ArrowRight size={12} />
      </Link>
    </div>
  );
}
