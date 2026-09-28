/**
 * Aarohmm design tokens — one source of truth for the app's look.
 * Deep-navy ground, brass/gold accents, warm parchment surfaces:
 * the palette of the packaging, not a generic material theme.
 */
export const colors = {
  ink: '#0d1f2d',
  navy: '#1e3a52',
  navySoft: '#2b4c68',
  navyLine: '#33546f',
  gold: '#d4af37',
  goldSoft: '#e8cd7a',
  parchment: '#f5f0e8',
  parchmentDim: '#e4dccd',
  white: '#ffffff',
  text: '#0d1f2d',
  textMuted: '#6b6357',
  textOnDark: '#f3ece0',
  textOnDarkMuted: '#a9bccd',
  success: '#16794a',
  successBg: '#e4f3ea',
  warn: '#b45309',
  warnBg: '#fdf1dd',
  danger: '#b4232a',
  dangerBg: '#fbe9ea',
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 22,
  xl: 34,
  xxl: 52,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '700' as const, letterSpacing: -0.4 },
  h1: { fontSize: 23, fontWeight: '700' as const, letterSpacing: -0.2 },
  h2: { fontSize: 17, fontWeight: '700' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  small: { fontSize: 12, fontWeight: '400' as const },
  micro: { fontSize: 10.5, fontWeight: '700' as const, letterSpacing: 1.1 },
} as const;

export const shadow = {
  card: {
    shadowColor: '#0d1f2d',
    shadowOpacity: 0.09,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  lifted: {
    shadowColor: '#0d1f2d',
    shadowOpacity: 0.17,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
} as const;

export function inr(amount?: number | null): string {
  const n = Number(amount || 0);
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}
