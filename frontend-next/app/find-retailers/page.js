import Link from 'next/link';
import { Store, MapPin, Phone, Mail } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://forgot-pass-4.preview.emergentagent.com';

export const metadata = {
  title: 'Find Addrika Retailers Near You | Store Locator India',
  description: 'Find authorized Addrika premium incense retailers near you. Locate stores selling Kesar Chandan, Regal Rose, Oriental Oudh & Bold Bakhoor across India.',
  keywords: ['addrika retailers', 'incense store near me', 'buy agarbatti delhi', 'premium incense stores india', 'addrika dealers'],
  openGraph: {
    title: 'Find Retailers | Addrika',
    description: 'Locate authorized Addrika retailers near you.',
    url: 'https://centraders.com/find-retailers',
  },
};

async function getRetailers() {
  try {
    const res = await fetch(`${API_URL}/api/retailers/public`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

async function getStates() {
  try {
    const res = await fetch(`${API_URL}/api/retailers/states`, {
      next: { revalidate: 86400 }
    });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

// LocalBusiness structured data
function RetailersStructuredData({ retailers }) {
  if (!retailers || retailers.length === 0) return null;
  
  const structuredData = retailers.slice(0, 10).map((retailer) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": retailer.business_name,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": retailer.address,
      "addressLocality": retailer.district,
      "addressRegion": retailer.state,
      "addressCountry": "IN"
    },
    "telephone": retailer.phone,
    "email": retailer.email
  }));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export default async function FindRetailersPage() {
  const [retailers, states] = await Promise.all([
    getRetailers(),
    getStates()
  ]);

  return (
    <>
      <RetailersStructuredData retailers={retailers} />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#fragrances" className="hover:text-[#D4AF37] transition-colors">Fragrances</Link>
            <Link href="/our-story" className="hover:text-[#D4AF37] transition-colors">Our Story</Link>
            <Link href="/about-us" className="hover:text-[#D4AF37] transition-colors">About Us</Link>
            <Link href="/find-retailers" className="text-[#D4AF37]">Find Retailers</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16 min-h-screen bg-[#F5F0E8]">
        {/* Hero */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f]">
          <div className="max-w-4xl mx-auto text-center">
            <Store className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
            <h1 className="text-4xl sm:text-5xl font-bold text-white font-serif mb-4">
              Find Addrika Near You
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Discover authorized retailers where you can experience and purchase our premium incense collection.
            </p>
          </div>
        </section>

        {/* States Overview */}
        <section className="py-12 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              We&apos;re Available In
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {states.length > 0 ? (
                states.map((state) => (
                  <span
                    key={state}
                    className="px-4 py-2 rounded-full text-sm font-medium bg-[#F5F0E8] text-[#2B3A4A]"
                  >
                    {state}
                  </span>
                ))
              ) : (
                <p className="text-gray-600">Expanding across India soon!</p>
              )}
            </div>
          </div>
        </section>

        {/* Retailers List */}
        <section className="py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Our Retail Partners
            </h2>
            
            {retailers.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-xl">
                <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-[#2B3A4A] mb-2">
                  Retail Network Growing
                </h3>
                <p className="text-gray-600 mb-6">
                  We&apos;re expanding our retail presence. In the meantime, shop online!
                </p>
                <Link
                  href="/#fragrances"
                  className="inline-flex items-center gap-2 bg-[#2B3A4A] text-white px-6 py-3 rounded-lg font-semibold hover:bg-[#1a252f] transition-colors"
                >
                  Shop Online
                </Link>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {retailers.map((retailer, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <h3 className="text-lg font-semibold text-[#2B3A4A] mb-2">
                      {retailer.business_name}
                    </h3>
                    <div className="space-y-2 text-sm text-gray-600">
                      <p className="flex items-start gap-2">
                        <MapPin size={16} className="flex-shrink-0 mt-0.5 text-[#D4AF37]" />
                        {retailer.address}, {retailer.district}, {retailer.state}
                      </p>
                      {retailer.phone && (
                        <p className="flex items-center gap-2">
                          <Phone size={16} className="text-[#D4AF37]" />
                          {retailer.phone}
                        </p>
                      )}
                      {retailer.email && (
                        <p className="flex items-center gap-2">
                          <Mail size={16} className="text-[#D4AF37]" />
                          {retailer.email}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Become a Retailer CTA */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
              Become an Addrika Retailer
            </h2>
            <p className="text-gray-600 mb-8">
              Interested in stocking Addrika products? Join our growing network of retail partners.
            </p>
            <Link
              href="mailto:contact.us@centraders.com?subject=Retailer%20Inquiry"
              className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Contact Us
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
