import Header from '../../../components/Header';
import Footer from '../../../components/Footer';
import AarovihaWalkthrough from '../../../components/AarovihaWalkthrough';
import BRAND from '../../../lib/brand.config';
import Link from 'next/link';

export const metadata = {
  title: `Aaroviah app walkthrough · ${BRAND.name} for retailers`,
  description:
    'A 60-second walkthrough of the Aaroviah trade app: build a carton cart on your phone, tap continue on web, and land in your browser already signed in.',
};

const FAQ = [
  {
    q: 'Do I need to log in twice?',
    a: 'No. Aaroviah mints a single-use handoff token when you tap “Continue on web”. The browser exchanges it for a retailer session, so you arrive signed in — your password never leaves the app.',
  },
  {
    q: 'How long is the handoff link valid?',
    a: 'A few minutes, and it can only be used once. If it expires, tap “Continue on web” again from the app.',
  },
  {
    q: 'Does my cart survive the jump?',
    a: 'Yes. Cartons, half-cartons, quantities and your tier pricing carry over exactly as you left them.',
  },
  {
    q: 'Is the app for shops only?',
    a: 'Yes — Aaroviah is strictly B2B. Retail customers shop on the website instead.',
  },
];

export default function RetailerOnboardingPage() {
  return (
    <div className="min-h-screen" style={{ background: '#0f1419' }} data-testid="retailer-onboarding-page">
      <Header />

      <section className="pt-32 pb-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs tracking-[3px] uppercase mb-4" style={{ color: BRAND.colors.gold }}>
            Retailer onboarding · 60 seconds
          </p>
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#e8e6e3' }}
          >
            Phone to browser,
            <br />
            without logging in twice.
          </h1>
          <p className="text-base md:text-lg mt-6 max-w-2xl" style={{ color: 'rgba(232,230,227,0.72)' }}>
            Watch how a carton cart built in the Aaroviah app lands in your web browser already signed in — cart, pricing and GST details intact.
          </p>
        </div>
      </section>

      <section className="px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-5xl mx-auto">
          <AarovihaWalkthrough />
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8" style={{ background: '#131a22' }}>
        <div className="max-w-5xl mx-auto">
          <h2 className="text-base md:text-lg font-semibold tracking-wide uppercase" style={{ color: BRAND.colors.gold }}>
            Questions retailers ask
          </h2>
          <div className="grid sm:grid-cols-2 gap-6 mt-8">
            {FAQ.map(({ q, a }) => (
              <div
                key={q}
                className="rounded-2xl p-6"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(212,175,55,0.18)' }}
              >
                <div className="font-semibold" style={{ color: '#e8e6e3' }}>{q}</div>
                <p className="text-sm mt-2 leading-relaxed" style={{ color: 'rgba(232,230,227,0.62)' }}>{a}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 mt-10">
            <Link
              href="/retailer/register"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, ${BRAND.colors.gold} 0%, ${BRAND.colors.goldDark} 100%)`, color: BRAND.colors.ink }}
              data-testid="onboarding-register-cta"
            >
              Register as a retailer
            </Link>
            <Link
              href="/wholesale"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm border transition-colors hover:bg-white/5"
              style={{ borderColor: 'rgba(212,175,55,0.45)', color: '#e8e6e3' }}
              data-testid="onboarding-wholesale-link"
            >
              See wholesale benefits
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
