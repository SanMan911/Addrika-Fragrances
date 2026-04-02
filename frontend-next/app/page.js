'use client';

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
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <FragranceGrid />
      <USPSection />
      <PackagingSection />
      <CSRSection />
      <InstagramFeed />
      <CTASection />
      <Footer />
    </div>
  );
}
