import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Store, MapPin, Phone, Mail, Navigation, Building2 } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

// Production backend URL - hardcoded as fallback for Vercel
const PRODUCTION_BACKEND = 'https://product-size-sync.preview.emergentagent.com';

// Dynamically import map component (client-side only) to preserve SSR/SEO
const RetailerMap = dynamic(() => import('../../components/RetailerMap'), {
  ssr: false,
  loading: () => (
    <div 
      className="w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden flex items-center justify-center"
      style={{ 
        background: 'linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}
    >
      <div className="text-center">
        <MapPin size={48} className="mx-auto mb-4 text-[#D4AF37] animate-pulse" />
        <p className="text-gray-400">Loading map...</p>
      </div>
    </div>
  )
});

export const metadata = {
  title: 'Find Addrika Retailers | Authorized Stores in Delhi & Bihar | Store Locator',
  description: 'Find authorized Addrika premium incense retailers. Visit M.G. Shoppie in Dwarka, Delhi or Mela Stores in Bhagalpur, Bihar. Get directions, phone numbers, and store details.',
  keywords: [
    'addrika retailers', 
    'incense store near me', 
    'buy agarbatti delhi', 
    'premium incense stores india', 
    'addrika dealers',
    'M.G. Shoppie Dwarka',
    'Mela Stores Bhagalpur',
    'addrika store locator',
    'buy dhoop near me'
  ],
  openGraph: {
    title: 'Find Addrika Retailers Near You | Store Locator',
    description: 'Visit our authorized retailers in Delhi (M.G. Shoppie, Dwarka) and Bihar (Mela Stores, Bhagalpur) to experience premium incense in person.',
    url: 'https://centraders.com/find-retailers',
    type: 'website',
  },
  alternates: {
    canonical: 'https://centraders.com/find-retailers',
  },
};

async function getRetailers() {
  const backendUrls = [
    process.env.NEXT_PUBLIC_BACKEND_URL,
    PRODUCTION_BACKEND,
  ].filter(Boolean);

  for (const apiUrl of backendUrls) {
    try {
      const res = await fetch(`${apiUrl}/api/retailers`, {
        next: { revalidate: 3600 }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.retailers && data.retailers.length > 0) {
          return data.retailers;
        }
      }
    } catch (error) {
      console.error(`Failed to fetch from ${apiUrl}:`, error.message);
    }
  }
  return [];
}

// Structured data for SEO - LocalBusiness schema for each retailer
function RetailersStructuredData({ retailers }) {
  if (!retailers || retailers.length === 0) return null;
  
  const structuredData = retailers.map((retailer) => ({
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": retailer.business_name,
    "description": `Authorized Addrika retailer selling premium zero-charcoal incense, agarbatti, and dhoop`,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": retailer.address,
      "addressLocality": retailer.city || retailer.district,
      "addressRegion": retailer.state,
      "postalCode": retailer.pincode,
      "addressCountry": "IN"
    },
    "telephone": `+91${retailer.phone}`,
    "email": retailer.email,
    "geo": retailer.coordinates ? {
      "@type": "GeoCoordinates",
      "latitude": retailer.coordinates.lat,
      "longitude": retailer.coordinates.lng
    } : undefined,
    "openingHours": "Mo-Sa 10:00-20:00",
    "priceRange": "₹₹",
    "image": "https://centraders.com/logo.png",
    "sameAs": ["https://centraders.com"],
    "parentOrganization": {
      "@type": "Organization",
      "name": "Addrika by Centsibl Traders",
      "url": "https://centraders.com"
    }
  }));

  // Also add a StoreLocator action
  const storeLocatorSchema = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "Find Addrika Retailers",
    "description": "Locate authorized Addrika incense retailers across India",
    "url": "https://centraders.com/find-retailers",
    "mainEntity": {
      "@type": "ItemList",
      "itemListElement": retailers.map((retailer, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "LocalBusiness",
          "name": retailer.business_name,
          "address": `${retailer.address}, ${retailer.district}, ${retailer.state}`
        }
      }))
    }
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(storeLocatorSchema) }}
      />
    </>
  );
}

export default async function FindRetailersPage() {
  const retailers = await getRetailers();

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <RetailersStructuredData retailers={retailers} />
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="py-12 md:py-16">
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
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
              Visit our authorized retailers to experience premium zero-charcoal incense in person. 
              Available in <strong className="text-[#D4AF37]">Delhi</strong> and <strong className="text-[#D4AF37]">Bihar</strong>.
            </p>
          </div>
        </section>

        {/* Map Section */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Navigation size={20} className="text-[#D4AF37]" />
                Store Locations
              </h2>
              <p className="text-sm text-gray-400">
                Click markers for directions
              </p>
            </div>
            <RetailerMap retailers={retailers} />
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
                  href="mailto:contact.us@centraders.com"
                  className="inline-flex items-center gap-2 text-[#D4AF37] hover:underline"
                >
                  <Mail size={16} />
                  Contact Us
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
                  <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Building2 size={20} className="text-[#D4AF37]" />
                    Authorized Retailers
                  </h2>
                  <p className="text-gray-400">
                    <span className="text-[#D4AF37] font-semibold">{retailers.length}</span> stores across India
                  </p>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {retailers.map((retailer, index) => (
                    <article 
                      key={retailer.id || index}
                      className="p-6 md:p-8 rounded-2xl transition-all hover:-translate-y-1 hover:shadow-2xl"
                      style={{ 
                        background: 'linear-gradient(165deg, rgba(26,26,46,0.95) 0%, rgba(22,33,62,0.95) 100%)',
                        border: '1px solid rgba(212,175,55,0.2)'
                      }}
                      itemScope
                      itemType="https://schema.org/LocalBusiness"
                    >
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.2) 0%, rgba(212,175,55,0.1) 100%)' }}
                        >
                          <Store size={28} className="text-[#D4AF37]" />
                        </div>
                        <div className="flex-1">
                          <h3 
                            className="font-bold text-xl md:text-2xl text-white mb-2"
                            style={{ fontFamily: "'Playfair Display', serif" }}
                            itemProp="name"
                          >
                            {retailer.business_name}
                          </h3>
                          
                          {/* Location Badge */}
                          <span 
                            className="inline-block px-3 py-1 rounded-full text-xs font-medium mb-4"
                            style={{ 
                              background: 'rgba(212,175,55,0.15)', 
                              color: '#D4AF37',
                              border: '1px solid rgba(212,175,55,0.3)'
                            }}
                          >
                            {retailer.state}
                          </span>
                          
                          {/* Address */}
                          <div 
                            className="flex items-start gap-3 text-gray-300 mb-4"
                            itemProp="address"
                            itemScope
                            itemType="https://schema.org/PostalAddress"
                          >
                            <MapPin size={18} className="flex-shrink-0 mt-1 text-[#D4AF37]" />
                            <span>
                              <span itemProp="streetAddress">{retailer.address}</span>, 
                              <span itemProp="addressLocality"> {retailer.district}</span>, 
                              <span itemProp="addressRegion"> {retailer.state}</span> - 
                              <span itemProp="postalCode"> {retailer.pincode}</span>
                            </span>
                          </div>
                          
                          {/* Contact Info */}
                          <div className="space-y-2 mb-6">
                            {retailer.phone && (
                              <a 
                                href={`tel:+91${retailer.phone}`}
                                className="flex items-center gap-3 text-gray-300 hover:text-[#D4AF37] transition-colors"
                                itemProp="telephone"
                              >
                                <Phone size={16} className="text-[#D4AF37]" />
                                +91 {retailer.phone}
                              </a>
                            )}
                            {retailer.email && (
                              <a 
                                href={`mailto:${retailer.email}`}
                                className="flex items-center gap-3 text-gray-300 hover:text-[#D4AF37] transition-colors"
                                itemProp="email"
                              >
                                <Mail size={16} className="text-[#D4AF37]" />
                                {retailer.email}
                              </a>
                            )}
                          </div>
                          
                          {/* Action Button */}
                          {retailer.coordinates && (
                            <a
                              href={`https://www.google.com/maps/dir/?api=1&destination=${retailer.coordinates.lat},${retailer.coordinates.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-105"
                              style={{ 
                                background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                                color: '#1a1a2e',
                                boxShadow: '0 4px 20px rgba(212,175,55,0.3)'
                              }}
                            >
                              <Navigation size={16} />
                              Get Directions
                            </a>
                          )}
                        </div>
                      </div>
                    </article>
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
                zero-charcoal incense to your customers.
              </p>
              <a
                href="mailto:contact.us@centraders.com?subject=Retailer Partnership Inquiry"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all hover:scale-105"
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
