'use client';

import { useTheme } from '../context/ThemeContext';

const MARQUEE_ITEMS = [
  { text: 'New Launch', highlight: 'Mystical Meharishi — Bambooless Premium Dhoop', icon: '✦', type: 'launch' },
  { text: 'Coming Soon', highlight: 'Grated Omani Bakhoor', icon: '✦', type: 'soon' },
  { text: 'Coming Soon', highlight: 'Yemeni Bakhoor Chips', icon: '✦', type: 'soon' },
  { text: 'Free Delivery', highlight: 'on orders above ₹499', icon: '✦', type: 'promo' },
  { text: '60%+ Less Smoke', highlight: 'Zero Charcoal Formula', icon: '✦', type: 'usp' },
  { text: 'Plant a Tree', highlight: '₹5 donation at checkout', icon: '✦', type: 'csr' },
  { text: 'Ethical Sourcing', highlight: 'Supporting Artisan Communities', icon: '✦', type: 'usp' },
];

function MarqueeItem({ item, isDarkMode }) {
  const colors = {
    launch: { badge: '#D4AF37', badgeBg: 'rgba(212,175,55,0.15)', text: isDarkMode ? '#D4AF37' : '#8B6914' },
    soon: { badge: '#a855f7', badgeBg: 'rgba(168,85,247,0.15)', text: isDarkMode ? '#c084fc' : '#7c3aed' },
    promo: { badge: '#10b981', badgeBg: 'rgba(16,185,129,0.15)', text: isDarkMode ? '#6ee7b7' : '#059669' },
    usp: { badge: isDarkMode ? '#e8e6e3' : '#2a3b49', badgeBg: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(42,59,73,0.08)', text: isDarkMode ? '#e8e6e3' : '#2a3b49' },
    csr: { badge: '#f59e0b', badgeBg: 'rgba(245,158,11,0.15)', text: isDarkMode ? '#fbbf24' : '#d97706' },
  };
  const c = colors[item.type] || colors.usp;

  return (
    <span className="inline-flex items-center gap-3 mx-6 whitespace-nowrap select-none" data-testid={`marquee-item-${item.type}`}>
      <span className="text-xs opacity-30" style={{ color: c.badge }}>{item.icon}</span>
      <span
        className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
        style={{ color: c.badge, background: c.badgeBg }}
      >
        {item.text}
      </span>
      <span className="text-sm font-medium" style={{ color: c.text }}>
        {item.highlight}
      </span>
    </span>
  );
}

export default function AnnouncementMarquee() {
  const { isDarkMode } = useTheme();

  // Duplicate items for seamless loop
  const items = [...MARQUEE_ITEMS, ...MARQUEE_ITEMS];

  return (
    <div
      className="relative overflow-hidden py-2.5"
      style={{
        background: isDarkMode
          ? 'linear-gradient(90deg, rgba(15,20,25,0.95) 0%, rgba(26,35,50,0.95) 50%, rgba(15,20,25,0.95) 100%)'
          : 'linear-gradient(90deg, #f8f6f1 0%, #f0ece3 50%, #f8f6f1 100%)',
        borderBottom: isDarkMode
          ? '1px solid rgba(212,175,55,0.12)'
          : '1px solid rgba(212,175,55,0.2)',
        borderTop: isDarkMode
          ? '1px solid rgba(212,175,55,0.06)'
          : '1px solid rgba(212,175,55,0.1)',
      }}
      data-testid="announcement-marquee"
    >
      {/* Fade edges */}
      <div
        className="absolute left-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{
          background: isDarkMode
            ? 'linear-gradient(90deg, rgba(15,20,25,1) 0%, transparent 100%)'
            : 'linear-gradient(90deg, #f8f6f1 0%, transparent 100%)',
        }}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-16 z-10 pointer-events-none"
        style={{
          background: isDarkMode
            ? 'linear-gradient(270deg, rgba(15,20,25,1) 0%, transparent 100%)'
            : 'linear-gradient(270deg, #f8f6f1 0%, transparent 100%)',
        }}
      />

      {/* Scrolling content */}
      <div className="flex animate-marquee-scroll">
        {items.map((item, i) => (
          <MarqueeItem key={i} item={item} isDarkMode={isDarkMode} />
        ))}
      </div>

      <style jsx>{`
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-scroll {
          animation: marquee-scroll 35s linear infinite;
          will-change: transform;
        }
        .animate-marquee-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
