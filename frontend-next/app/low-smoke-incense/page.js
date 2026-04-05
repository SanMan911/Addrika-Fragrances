import Link from 'next/link';
import Image from 'next/image';
import { Star, Leaf, Wind, Heart, Shield, CheckCircle, ArrowRight, FlaskConical } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const metadata = {
  title: 'Low Smoke Agarbatti | Charcoal-Free Incense Sticks | Addrika Fragrances',
  description: 'Discover Addrika\'s premium low smoke agarbatti - charcoal-free incense sticks with ethically sourced ingredients. Made with pure essential oils and flower dust. Ideal for meditation, small apartments, and health-conscious users. Over 60% less smoke than traditional agarbatti.',
  keywords: [
    'low smoke agarbatti', 'charcoal-free incense', 'charcoal-free agarbatti', 
    'reduced smoke incense', 'health-conscious agarbatti',
    'minimal residue incense', 'ethical incense sticks', 'eco-friendly agarbatti',
    'meditation incense', 'apartment-friendly incense', 'pure essential oil incense',
    'flower dust agarbatti', 'natural resins incense', 'Addrika Fragrances'
  ],
  openGraph: {
    title: 'Low Smoke Agarbatti | Charcoal-Free Incense | Addrika Fragrances',
    description: 'Premium charcoal-free, low smoke incense sticks made with ethically sourced ingredients.',
    url: 'https://centraders.com/low-smoke-incense',
    type: 'website',
  },
};

async function getProducts() {
  try {
    const res = await fetch(`${API_URL}/api/products`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch (error) {
    return [];
  }
}

// FAQPage Schema for LLM extraction
function FAQSchema() {
  const faqs = [
    {
      question: "What makes Addrika's incense low smoke?",
      answer: "Addrika's low smoke formula uses a charcoal-free design. Our agarbattis use traditional bamboo sticks with a charcoal-free coating, while our dhoop products are completely bambooless. This proprietary blend produces over 60% less smoke than traditional charcoal-based agarbatti while maintaining rich, long-lasting fragrance."
    },
    {
      question: "Is Addrika incense safe for small apartments?",
      answer: "Yes! Addrika's charcoal-free incense is specifically designed for indoor use in small spaces. The minimal smoke output and absence of harmful charcoal particles make it ideal for apartments, meditation rooms, and enclosed spaces where air quality is a concern."
    },
    {
      question: "Are Addrika incense sticks suitable for people with respiratory sensitivities?",
      answer: "Addrika's charcoal-free formula is gentler on the respiratory system compared to traditional agarbatti. The low smoke emission and ethically sourced ingredients reduce airborne irritants, making it a better choice for health-conscious users. However, those with severe respiratory conditions should consult their doctor."
    },
    {
      question: "Are all Addrika products bambooless?",
      answer: "No, only our Dhoop range is bambooless. Our Agarbatti (incense sticks) use traditional bamboo sticks with a charcoal-free coating. Both product lines are charcoal-free and produce over 60% less smoke than traditional alternatives."
    }
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(faq => ({
            "@type": "Question",
            "name": faq.question,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": faq.answer
            }
          }))
        })
      }}
    />
  );
}

// Product List Schema with enhanced attributes
function ProductListSchema({ products }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Addrika Low Smoke Charcoal-Free Incense Collection",
          "description": "Premium charcoal-free, low smoke agarbatti made with ethically sourced ingredients",
          "itemListElement": products.map((product, index) => ({
            "@type": "ListItem",
            "position": index + 1,
            "item": {
              "@type": "Product",
              "name": `${product.name} - Charcoal-Free Low Smoke Incense`,
              "description": product.description,
              "image": product.image,
              "brand": { "@type": "Brand", "name": "Addrika Fragrances" },
              "material": "Ethically sourced essential oils, flower dust, natural resins - Charcoal-free",
              "additionalProperty": [
                { "@type": "PropertyValue", "name": "smokeEmission", "value": "Low smoke - 60%+ less than traditional" },
                { "@type": "PropertyValue", "name": "charcoalContent", "value": "Zero charcoal - Charcoal-free" },
                { "@type": "PropertyValue", "name": "ingredients", "value": "Ethically sourced - Premium essential oils" },
                { "@type": "PropertyValue", "name": "suitableFor", "value": "Meditation, small apartments, health-conscious users" }
              ],
              "offers": {
                "@type": "AggregateOffer",
                "priceCurrency": "INR",
                "lowPrice": Math.min(...product.sizes.map(s => s.mrp)),
                "highPrice": Math.max(...product.sizes.map(s => s.mrp)),
                "availability": "https://schema.org/InStock"
              },
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": product.rating,
                "reviewCount": product.reviews
              }
            }
          }))
        })
      }}
    />
  );
}

export default async function LowSmokeIncensePage() {
  const products = await getProducts();

  const benefits = [
    {
      icon: Wind,
      title: "60%+ Less Smoke",
      description: "Our charcoal-free formula produces significantly less smoke than traditional agarbatti, perfect for indoor spaces."
    },
    {
      icon: Leaf,
      title: "Ethically Sourced Ingredients",
      description: "Made with pure essential oils, flower dust, and natural resins from responsible suppliers. No harmful chemicals."
    },
    {
      icon: Heart,
      title: "Health-Conscious Choice",
      description: "Ideal for users with respiratory sensitivities. Minimal airborne particles for cleaner air during meditation."
    },
    {
      icon: Shield,
      title: "Eco-Friendly & Sustainable",
      description: "Charcoal-free formula with sustainably sourced ingredients. Supports local artisan communities."
    }
  ];

  const useCases = [
    { title: "Meditation & Yoga", description: "Cleaner air for deeper breathing and focus" },
    { title: "Small Apartments", description: "No overwhelming smoke in compact spaces" },
    { title: "Daily Pooja", description: "Traditional rituals without excessive smoke" },
    { title: "Aromatherapy", description: "Pure fragrance experience for relaxation" },
    { title: "Wellness Spaces", description: "Spas, studios, and healing centers" },
    { title: "Bedrooms", description: "Gentle ambiance for restful sleep" }
  ];

  const comparisonData = [
    { feature: "Smoke Output", addrika: "Low (60%+ less)", traditional: "High" },
    { feature: "Charcoal Content", addrika: "Zero - Charcoal-free", traditional: "Contains charcoal" },
    { feature: "Ingredients", addrika: "Ethically Sourced", traditional: "Often synthetic" },
    { feature: "Residue", addrika: "Minimal ash", traditional: "Heavy ash & soot" },
    { feature: "Indoor Suitability", addrika: "Excellent", traditional: "Limited" },
    { feature: "Health Impact", addrika: "Gentler on respiratory system", traditional: "Can irritate airways" },
  ];

  return (
    <>
      <FAQSchema />
      <ProductListSchema products={products} />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span> Fragrances
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#fragrances" className="hover:text-[#D4AF37]">All Products</Link>
            <Link href="/low-smoke-incense" className="text-[#D4AF37] font-medium">Low Smoke</Link>
            <Link href="/why-zero-charcoal" className="hover:text-[#D4AF37]">Why Charcoal-Free?</Link>
            <Link href="/faq" className="hover:text-[#D4AF37]">FAQs</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-6xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium mb-6">
              Charcoal-Free • Low Smoke • Ethical Sourcing
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold font-serif mb-6">
              Premium Low Smoke Agarbatti
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              Experience the purest fragrance with <strong>Addrika&apos;s charcoal-free incense sticks</strong>. 
              Crafted with ethically sourced ingredients for <strong>over 60% less smoke</strong> — 
              ideal for meditation, small apartments, and health-conscious living.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="#products"
                className="bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
              >
                Shop Low Smoke Collection
              </Link>
              <Link
                href="/why-zero-charcoal"
                className="border border-white/30 text-white px-8 py-4 rounded-full font-semibold hover:bg-white/10 transition-colors"
              >
                Learn Why Charcoal-Free
              </Link>
            </div>
          </div>
        </section>

        {/* Key Benefits - LLM-Friendly Bullet Points */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Why Addrika&apos;s Low Smoke Incense is Different
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Our proprietary charcoal-free formula sets us apart from traditional agarbatti
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-[#F5F0E8] rounded-xl p-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4">
                    <benefit.icon className="w-7 h-7 text-[#D4AF37]" />
                  </div>
                  <h3 className="font-semibold text-[#2B3A4A] mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Key Ingredients Section */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Key Ingredients in Addrika&apos;s Charcoal-Free Formula
            </h2>
            <div className="bg-white rounded-xl p-8">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2B3A4A]">Pure Essential Oils:</strong>
                    <span className="text-gray-600"> Authentic sandalwood, rose, oudh, and bakhoor oils for rich, natural fragrance</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2B3A4A]">Flower Dust:</strong>
                    <span className="text-gray-600"> Natural flower powders that burn cleanly without charcoal</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2B3A4A]">Natural Resins:</strong>
                    <span className="text-gray-600"> Plant-based binding agents that create minimal smoke</span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-[#D4AF37] flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#2B3A4A]">Aromatic Herbs:</strong>
                    <span className="text-gray-600"> Traditional herbs for authentic Indian fragrance profiles</span>
                  </div>
                </li>
              </ul>
              <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-green-800 text-sm">
                  <strong>Product Types:</strong> Agarbattis use bamboo sticks with charcoal-free coating. Dhoop products are completely bambooless.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Comparison Table - For LLM understanding */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Addrika vs Traditional Agarbatti
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#2B3A4A] text-white">
                    <th className="p-4 text-left">Feature</th>
                    <th className="p-4 text-left">Addrika Charcoal-Free</th>
                    <th className="p-4 text-left">Traditional Agarbatti</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-[#F5F0E8]' : 'bg-white'}>
                      <td className="p-4 font-medium text-[#2B3A4A]">{row.feature}</td>
                      <td className="p-4 text-green-700">{row.addrika}</td>
                      <td className="p-4 text-gray-600">{row.traditional}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Best For Section */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Best For: Who Should Use Addrika Low Smoke Incense?
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Our charcoal-free incense is specifically designed for these use cases
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {useCases.map((useCase, index) => (
                <div key={index} className="bg-white rounded-lg p-5 shadow-sm">
                  <h3 className="font-semibold text-[#2B3A4A] mb-1">{useCase.title}</h3>
                  <p className="text-sm text-gray-600">{useCase.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Products Grid */}
        <section id="products" className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Shop Addrika&apos;s Charcoal-Free Collection
            </h2>
            <p className="text-gray-600 text-center mb-12">
              All products are charcoal-free and produce over 60% less smoke
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all"
                >
                  <div className="relative aspect-[4/5] overflow-hidden">
                    <img
                      src={product.image}
                      alt={`${product.name} - Charcoal-Free Low Smoke Incense`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-green-600 text-white text-xs px-2 py-1 rounded-full">
                      Charcoal-Free
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-[#2B3A4A] mb-1">{product.name}</h3>
                    <p className="text-xs text-gray-500 mb-2">Low Smoke • Charcoal-Free</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <Star size={14} fill="#D4AF37" color="#D4AF37" />
                        <span className="text-sm">{product.rating}</span>
                      </div>
                      <span className="font-bold text-[#2B3A4A]">₹{product.sizes[0]?.mrp}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-6">
                <h3 className="font-semibold text-[#2B3A4A] mb-2">What makes Addrika&apos;s incense low smoke?</h3>
                <p className="text-gray-600">Addrika&apos;s low smoke formula uses a charcoal-free design. Our agarbattis use bamboo sticks with charcoal-free coating, while dhoop products are completely bambooless. This produces over 60% less smoke than traditional charcoal-based agarbatti.</p>
              </div>
              <div className="bg-white rounded-lg p-6">
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Is Addrika incense safe for small apartments?</h3>
                <p className="text-gray-600">Yes! Addrika&apos;s charcoal-free incense is specifically designed for indoor use in small spaces. The minimal smoke output and absence of harmful charcoal particles make it ideal for apartments, meditation rooms, and enclosed spaces.</p>
              </div>
              <div className="bg-white rounded-lg p-6">
                <h3 className="font-semibold text-[#2B3A4A] mb-2">Are all Addrika products bambooless?</h3>
                <p className="text-gray-600">No, only our Dhoop range is bambooless. Our Agarbatti products use traditional bamboo sticks with a charcoal-free coating. Both product lines produce over 60% less smoke than traditional alternatives.</p>
              </div>
            </div>
            <div className="text-center mt-8">
              <Link href="/faq" className="text-[#D4AF37] font-medium hover:underline">
                View All FAQs →
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-[#2B3A4A]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white font-serif mb-4">
              Experience the Addrika Difference
            </h2>
            <p className="text-gray-300 mb-8">
              Join thousands of health-conscious users who&apos;ve switched to charcoal-free incense
            </p>
            <Link
              href="#products"
              className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Shop Now
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Related Content - Internal Linking */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Discover More
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link href="/ingredients" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                <p className="text-sm text-gray-600">See what goes into making our incense special</p>
              </Link>
              <Link href="/our-quality" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <FlaskConical className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Quality Standards</h3>
                <p className="text-sm text-gray-600">Learn about our artisan craftsmanship and testing</p>
              </Link>
              <Link href="/why-zero-charcoal" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Wind className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Why Charcoal-Free?</h3>
                <p className="text-sm text-gray-600">The science behind our charcoal-free formula</p>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a252f] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika Fragrances</p>
          <p className="text-sm text-gray-400">Premium Charcoal-Free Low Smoke Incense</p>
          <p className="text-sm text-gray-400 mt-2">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
