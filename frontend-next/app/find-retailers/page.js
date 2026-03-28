import Link from 'next/link';
import { Store, MapPin, Phone, Mail, Search } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ecommerce-nextjs-2.preview.emergentagent.com';

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
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <RetailersStructuredData retailers={retailers} />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-4 text-center">
            <span 
              className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
              style={{ 
                background: 'rgba(212,175,55,0.1)', 
                color: '#D4AF37',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              STORE LOCATOR
            </span>
            <h1 
              className="text-4xl sm:text-5xl font-bold mb-6 text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Find Addrika Retailers
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Discover authorized Addrika retailers near you and experience our 
              premium incense collection in person.
            </p>
          </div>
        </section>

        {/* Retailers Grid */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4">
            {retailers.length === 0 ? (
              <div 
                className="text-center py-16 rounded-2xl"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Store size={48} className="mx-auto mb-4 text-gray-500" />
                <h3 className="text-xl font-semibold text-white mb-2">No Retailers Found</h3>
                <p className="text-gray-400 mb-6">
                  We're expanding our network. Check back soon or contact us for assistance.
                </p>
                <Link
                  href="mailto:care@centraders.com"
                  className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline"
                >
                  <Mail size={16} />
                  Contact Us
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8">
                  <p className="text-gray-400">
                    Showing <span className="text-[#D4AF37] font-semibold">{retailers.length}</span> authorized retailers
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {retailers.map((retailer, index) => (
                    <div 
                      key={index}
                      className="p-6 rounded-xl transition-all hover:-translate-y-1"
                      style={{ 
                        background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'rgba(212,175,55,0.15)' }}
                        >
                          <Store size={24} className="text-[#D4AF37]" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-white text-lg mb-1">
                            {retailer.business_name}
                          </h3>
                          <div className="flex items-start gap-2 text-sm text-gray-400 mb-2">
                            <MapPin size={14} className="flex-shrink-0 mt-1" />
                            <span>{retailer.address}, {retailer.district}, {retailer.state}</span>
                          </div>
                          {retailer.phone && (
                            <a 
                              href={`tel:${retailer.phone}`}
                              className="flex items-center gap-2 text-sm text-[#D4AF37] hover:underline"
                            >
                              <Phone size={14} />
                              {retailer.phone}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Become a Retailer CTA */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4">
            <div 
              className="text-center p-8 sm:p-12 rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.2) 100%)',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              <h2 
                className="text-2xl sm:text-3xl font-bold mb-4 text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Become an Addrika Retailer
              </h2>
              <p className="text-gray-300 mb-6 max-w-lg mx-auto">
                Join our growing network of authorized retailers and bring premium 
                incense to your customers.
              </p>
              <a
                href="mailto:care@centraders.com?subject=Retailer Partnership Inquiry"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                <Mail size={18} />
                Contact for Partnership
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
