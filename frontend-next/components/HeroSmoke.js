'use client';

/**
 * Subtle, lightweight smoke wisps for hero sections.
 * - Pure CSS / SVG — no video, no GIF, ~3 KB on the wire.
 * - Pointer-events: none, behind text (z-index controlled by parent).
 * - Honors prefers-reduced-motion (animation disabled there).
 *
 * Usage:
 *   <section className="relative overflow-hidden">
 *     <HeroSmoke />
 *     <div className="relative z-10">… text + CTA …</div>
 *   </section>
 *
 * Color theme is locked to a warm gold/cream so it works on dark hero
 * backgrounds. Override via the `tint` prop if needed.
 */
export default function HeroSmoke({ tint = 'rgba(212, 175, 55, 0.18)', density = 3 }) {
  const wisps = Array.from({ length: density }, (_, i) => i);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden hero-smoke-root"
    >
      {wisps.map((i) => (
        <span
          key={i}
          className={`hero-smoke-wisp wisp-${i % 3}`}
          style={{
            // stagger
            animationDelay: `-${(i * 5.5) % 18}s`,
            left: `${(i * 23 + 10) % 90}%`,
            // slightly different sizes
            width: `${320 + ((i * 87) % 280)}px`,
            height: `${320 + ((i * 87) % 280)}px`,
            background: `radial-gradient(circle at 50% 50%, ${tint} 0%, ${tint.replace(/[\d.]+\)$/, '0)')} 60%)`,
          }}
        />
      ))}

      <style jsx>{`
        .hero-smoke-root {
          /* Ensures the wisps don't paint over text */
          mix-blend-mode: screen;
        }
        .hero-smoke-wisp {
          position: absolute;
          bottom: -30%;
          border-radius: 50%;
          filter: blur(40px);
          opacity: 0;
          will-change: transform, opacity;
          animation: wisp-drift 22s linear infinite;
        }
        .wisp-0 {
          animation-duration: 22s;
        }
        .wisp-1 {
          animation-duration: 28s;
          opacity: 0.85;
        }
        .wisp-2 {
          animation-duration: 34s;
          filter: blur(60px);
        }

        @keyframes wisp-drift {
          0% {
            transform: translate3d(-10%, 20%, 0) scale(0.6);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          50% {
            transform: translate3d(10%, -40%, 0) scale(1.05);
          }
          85% {
            opacity: 0.6;
          }
          100% {
            transform: translate3d(20%, -110%, 0) scale(1.3);
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .hero-smoke-wisp {
            animation: none;
            opacity: 0.35;
            transform: translate3d(0, -50%, 0) scale(1);
          }
        }

        @media (max-width: 640px) {
          /* Lighter on mobile to avoid jank */
          .hero-smoke-wisp {
            filter: blur(30px);
          }
        }
      `}</style>
    </div>
  );
}
