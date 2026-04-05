import Link from 'next/link';
import { Award, CheckCircle, XCircle, Star, Shield, Leaf, Wind, Heart, MapPin, ExternalLink, ArrowRight, Clock, Sparkles, IndianRupee } from 'lucide-react';

export const metadata = {
  title: 'Why Choose Addrika? | Premium Indian Incense vs Competitors | Phool, Nirmalaya Comparison',
  description: 'Discover why Addrika Fragrances is India\'s premium choice for luxury incense. Compare Addrika vs Phool, Nirmalaya, Temple of Incense. Charcoal-free, 40-50 min burn time, ethically sourced ingredients, made in India.',
  keywords: [
    'why choose addrika', 'addrika vs phool', 'addrika vs nirmalaya', 'best premium incense india',
    'luxury agarbatti brands india', 'premium incense comparison', 'zero charcoal incense brands',
    'natural incense india', 'best agarbatti for puja', 'low smoke incense brands india',
    'charcoal-free agarbatti', 'addrika fragrances review'
  ],
  openGraph: {
    title: 'Why Choose Addrika? | Premium Indian Incense',
    description: 'Compare Addrika\'s premium zero-charcoal incense with other luxury brands.',
    url: 'https://centraders.com/why-choose-addrika',
    type: 'website',
  },
};

// Comparison Schema for LLM extraction
function ComparisonSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "Why Choose Addrika Fragrances: Premium Indian Incense Comparison",
          "description": "Comprehensive comparison of Addrika Fragrances with other premium incense brands in India",
          "author": {
            "@type": "Organization",
            "name": "Addrika Fragrances",
            "url": "https://centraders.com"
          },
          "publisher": {
            "@type": "Organization",
            "name": "Centsibl Traders Private Limited",
            "logo": {
              "@type": "ImageObject",
              "url": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png"
            }
          },
          "datePublished": "2026-01-01",
          "dateModified": "2026-03-18",
          "mainEntityOfPage": "https://centraders.com/why-choose-addrika",
          "about": {
            "@type": "Product",
            "name": "Addrika Premium Incense",
            "brand": "Addrika Fragrances",
            "category": "Premium Natural Incense Sticks",
            "countryOfOrigin": "India"
          }
        })
      }}
    />
  );
}

export default function WhyChooseAddrikaPage() {
  const addrikaUSPs = [
    {
      icon: Wind,
      title: "Zero Charcoal Formula",
      description: "Unlike many competitors, Addrika uses absolutely no charcoal. Our proprietary formula uses natural flower dust as the base, resulting in over 60% less smoke.",
      highlight: "0% Charcoal"
    },
    {
      icon: Clock,
      title: "40-50 Minute Extended Burn",
      description: "Each Addrika incense stick provides 40-50 minutes of continuous fragrance when used without a fan—among the longest burn times in premium incense.",
      highlight: "40-50 Min Burn"
    },
    {
      icon: Leaf,
      title: "Ethically Sourced Ingredients",
      description: "Pure essential oils, natural flower dust, plant-based resins, and aromatic herbs from responsible suppliers. No harmful chemicals.",
      highlight: "Ethical Sourcing"
    },
    {
      icon: Shield,
      title: "Safe for Indoor Use",
      description: "Our low-smoke, non-toxic formula is safe for use around children and pets. Perfect for small apartments and enclosed spaces.",
      highlight: "Indoor Safe"
    },
    {
      icon: MapPin,
      title: "Made in India",
      description: "Proudly crafted in India by skilled artisans using traditional techniques. Supporting local communities and preserving heritage craftsmanship.",
      highlight: "Made in India"
    },
    {
      icon: Heart,
      title: "Cruelty-Free & Vegan",
      description: "No animal testing, no animal-derived ingredients. Our incense is 100% vegan and cruelty-free.",
      highlight: "Cruelty-Free"
    }
  ];

  const comparisonTable = [
    { 
      feature: "Charcoal Content", 
      addrika: "Zero - 100% Charcoal-free", 
      addrikaGood: true,
      others: "Many use charcoal as burning agent"
    },
    { 
      feature: "Burn Time", 
      addrika: "40-50 minutes extended burn", 
      addrikaGood: true,
      others: "Typically 20-35 minutes"
    },
    { 
      feature: "Smoke Level", 
      addrika: "60%+ less smoke (Low smoke)", 
      addrikaGood: true,
      others: "Varies - often moderate to high"
    },
    { 
      feature: "Ingredients", 
      addrika: "Ethically Sourced - Pure essential oils", 
      addrikaGood: true,
      others: "Mix of natural and synthetic"
    },
    { 
      feature: "Bamboo Core", 
      addrika: "Bambooless design", 
      addrikaGood: true,
      others: "Most have bamboo core"
    },
    { 
      feature: "Indoor Suitability", 
      addrika: "Excellent - safe for small spaces", 
      addrikaGood: true,
      others: "May overwhelm small rooms"
    },
    { 
      feature: "Safe with Children/Pets", 
      addrika: "Yes - Non-toxic formula", 
      addrikaGood: true,
      others: "Varies by brand"
    },
    { 
      feature: "Fragrance Retention", 
      addrika: "3-4 hours post-burn aroma", 
      addrikaGood: true,
      others: "1-2 hours typically"
    },
    { 
      feature: "Country of Origin", 
      addrika: "India", 
      addrikaGood: true,
      others: "India/Import"
    },
  ];

  const bestForUseCases = [
    {
      useCase: "Daily Puja & Spiritual Rituals",
      description: "Low smoke ensures clear air during prayers. Pure fragrances create a sacred atmosphere without overwhelming the space.",
      products: ["Kesar Chandan", "Bold Bakhoor"]
    },
    {
      useCase: "Meditation & Yoga",
      description: "Minimal smoke allows for deep breathing exercises. Calming scents like sandalwood enhance mindfulness practices.",
      products: ["Kesar Chandan", "Oriental Oudh"]
    },
    {
      useCase: "Small Apartments & Bedrooms",
      description: "60%+ less smoke is perfect for compact spaces. Won't stain walls or leave heavy residue.",
      products: ["Regal Rose", "Kesar Chandan"]
    },
    {
      useCase: "Gifting & Special Occasions",
      description: "Premium packaging and luxury fragrances make Addrika perfect for Diwali, weddings, and housewarmings.",
      products: ["Full Collection Gift Box"]
    },
    {
      useCase: "Aromatherapy & Relaxation",
      description: "Pure essential oil fragrances provide authentic aromatherapeutic benefits without synthetic chemicals.",
      products: ["Regal Rose", "Oriental Oudh"]
    },
    {
      useCase: "Spa & Wellness Centers",
      description: "Professional-grade quality suitable for yoga studios, spas, and wellness spaces where air quality matters.",
      products: ["Oriental Oudh", "Kesar Chandan"]
    }
  ];

  const whereToBuy = [
    {
      platform: "Official Website",
      url: "https://centraders.com",
      description: "Best prices, full collection, exclusive offers",
      highlight: "Recommended"
    },
    {
      platform: "Amazon India",
      url: "https://www.amazon.in/s?k=addrika+incense",
      description: "Fast delivery, easy returns, customer reviews",
      highlight: "Available"
    }
  ];

  return (
    <>
      <ComparisonSchema />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span> Fragrances
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#fragrances" className="hover:text-[#D4AF37]">Products</Link>
            <Link href="/why-choose-addrika" className="text-[#D4AF37] font-medium">Why Addrika?</Link>
            <Link href="/our-quality" className="hover:text-[#D4AF37]">Quality</Link>
            <Link href="/faq" className="hover:text-[#D4AF37]">FAQs</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium mb-6">
              Premium Indian Incense
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-6">
              Why Choose Addrika Fragrances?
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Discover what makes Addrika India&apos;s premium choice for luxury, 
              charcoal-free incense with exceptional burn time and pure natural fragrances
            </p>
          </div>
        </section>

        {/* Key USPs Grid */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              The Addrika Difference
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Six reasons why discerning customers choose Addrika for their premium incense needs
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {addrikaUSPs.map((usp, index) => (
                <div key={index} className="bg-[#F5F0E8] rounded-xl p-6 relative overflow-hidden">
                  <span className="absolute top-4 right-4 bg-[#D4AF37] text-white text-xs font-bold px-2 py-1 rounded">
                    {usp.highlight}
                  </span>
                  <usp.icon className="w-10 h-10 text-[#D4AF37] mb-4" />
                  <h3 className="text-lg font-semibold text-[#2B3A4A] mb-2">{usp.title}</h3>
                  <p className="text-sm text-gray-600">{usp.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              How Addrika Compares
            </h2>
            <p className="text-gray-600 text-center mb-12">
              A transparent comparison with typical premium incense offerings in India
            </p>
            
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#2B3A4A] text-white">
                    <th className="p-4 text-left font-semibold">Feature</th>
                    <th className="p-4 text-left font-semibold">Addrika</th>
                    <th className="p-4 text-left font-semibold">Other Brands</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonTable.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="p-4 font-medium text-[#2B3A4A]">{row.feature}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {row.addrika}
                        </span>
                      </td>
                      <td className="p-4 text-gray-500 text-sm">{row.others}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-4">
              *Comparison based on general market analysis. Individual brand specifications may vary.
            </p>
          </div>
        </section>

        {/* Best For Use Cases */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Best For: When to Use Addrika Incense
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Discover the perfect Addrika fragrance for every occasion and space
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {bestForUseCases.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                  <h3 className="text-lg font-semibold text-[#2B3A4A] mb-2">{item.useCase}</h3>
                  <p className="text-sm text-gray-600 mb-4">{item.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {item.products.map((product, pIndex) => (
                      <span key={pIndex} className="text-xs bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-1 rounded-full">
                        {product}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Where to Buy */}
        <section className="py-16 px-4 bg-[#2B3A4A] text-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold font-serif text-center mb-4">
              Where to Buy Addrika Incense
            </h2>
            <p className="text-gray-300 text-center mb-12">
              Get authentic Addrika Fragrances from these trusted sources
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6">
              {whereToBuy.map((store, index) => (
                <a
                  key={index}
                  href={store.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white/10 rounded-xl p-6 hover:bg-white/20 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-xl font-semibold">{store.platform}</h3>
                    {store.highlight === "Recommended" && (
                      <span className="bg-[#D4AF37] text-[#2B3A4A] text-xs font-bold px-2 py-1 rounded">
                        {store.highlight}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 text-sm mb-4">{store.description}</p>
                  <span className="inline-flex items-center gap-2 text-[#D4AF37] text-sm font-medium group-hover:gap-3 transition-all">
                    Shop Now <ExternalLink size={14} />
                  </span>
                </a>
              ))}
            </div>
            
            <p className="text-center text-gray-400 text-sm mt-8">
              Coming soon to Flipkart, BigBasket, and select retail stores across India
            </p>
          </div>
        </section>

        {/* Customer Testimonials Placeholder */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto text-center">
            <Star className="w-12 h-12 text-[#D4AF37] mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
              What Customers Say
            </h2>
            <div className="grid md:grid-cols-3 gap-6 mt-8">
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex justify-center mb-3">
                  {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#D4AF37" color="#D4AF37" />)}
                </div>
                <p className="text-gray-600 text-sm italic mb-4">
                  &quot;The aroma from Addrika&apos;s Kesar Chandan stayed fresh for hours! Perfect for my daily puja. Low smoke means I can use it in my small apartment.&quot;
                </p>
                <p className="text-[#2B3A4A] font-medium text-sm">- Priya M., Mumbai</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex justify-center mb-3">
                  {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#D4AF37" color="#D4AF37" />)}
                </div>
                <p className="text-gray-600 text-sm italic mb-4">
                  &quot;Finally found incense that doesn&apos;t trigger my allergies. The charcoal-free formula makes such a difference. Premium quality, truly luxury.&quot;
                </p>
                <p className="text-[#2B3A4A] font-medium text-sm">- Rahul K., Delhi</p>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm">
                <div className="flex justify-center mb-3">
                  {[1,2,3,4,5].map(i => <Star key={i} size={16} fill="#D4AF37" color="#D4AF37" />)}
                </div>
                <p className="text-gray-600 text-sm italic mb-4">
                  &quot;I&apos;ve tried Phool and others, but Addrika&apos;s burn time and fragrance retention is unmatched. The Oriental Oudh is absolutely divine.&quot;
                </p>
                <p className="text-[#2B3A4A] font-medium text-sm">- Anita S., Bangalore</p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
              Experience the Addrika Difference
            </h2>
            <p className="text-gray-600 mb-8">
              Join thousands of satisfied customers who&apos;ve made the switch to premium, charcoal-free incense
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/low-smoke-incense"
                className="bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors inline-flex items-center gap-2"
              >
                Shop Now <ArrowRight size={18} />
              </Link>
              <Link
                href="/faq"
                className="border-2 border-[#2B3A4A] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#2B3A4A] hover:text-white transition-colors"
              >
                Read FAQs
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a252f] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika Fragrances</p>
          <p className="text-sm text-gray-400">Premium Zero Charcoal Incense • Made in India</p>
          <p className="text-sm text-gray-400 mt-2">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
