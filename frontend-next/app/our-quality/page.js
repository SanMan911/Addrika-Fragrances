import Link from 'next/link';
import { Award, Leaf, Shield, CheckCircle, Star, Users, Factory, Heart, Droplets, Wind, FlaskConical, Eye } from 'lucide-react';

export const metadata = {
  title: 'Our Quality Standards | Premium Incense Craftsmanship | Addrika',
  description: 'Discover Addrika\'s uncompromising quality standards. Learn about our ethically sourced ingredients, artisan craftsmanship, rigorous testing, and the traditional techniques behind our premium zero-charcoal incense sticks.',
  keywords: [
    'addrika quality', 'premium incense quality', 'ethical incense ingredients', 'artisan incense',
    'handcrafted agarbatti', 'incense quality standards', 'pure essential oils incense',
    'chemical-free incense', 'traditional incense making', 'incense craftsmanship'
  ],
  openGraph: {
    title: 'Our Quality Standards | Addrika Premium Incense',
    description: 'Uncompromising quality in every stick. Ethically sourced ingredients, artisan crafted.',
    url: 'https://centraders.com/our-quality',
    type: 'website',
  },
};

// Article Schema for LLM extraction
function ArticleSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "Addrika Quality Standards: The Art of Premium Incense",
          "description": "Comprehensive guide to Addrika's quality standards, ethically sourced ingredients, and traditional craftsmanship",
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
          "mainEntityOfPage": "https://centraders.com/our-quality"
        })
      }}
    />
  );
}

export default function OurQualityPage() {
  const qualityPillars = [
    {
      icon: Leaf,
      title: "Ethically Sourced Ingredients",
      description: "Every component in Addrika incense is ethically sourced. Pure essential oils, flower dust, resins, and aromatic herbs - never synthetic fragrances or harmful chemicals.",
      details: [
        "Pure sandalwood, rose, oudh, and bakhoor essential oils",
        "Flower dust as the base material",
        "Plant-based resins for clean binding",
        "Aromatic herbs for authentic fragrance profiles"
      ]
    },
    {
      icon: Factory,
      title: "Artisan Craftsmanship",
      description: "Each Addrika incense stick is carefully crafted by skilled artisans using traditional techniques perfected over generations in India.",
      details: [
        "Crafted by experienced artisans in India",
        "Traditional techniques preserved for quality",
        "Small-batch production for consistency",
        "Individual attention to each stick"
      ]
    },
    {
      icon: Shield,
      title: "Zero Charcoal Formula",
      description: "Our proprietary charcoal-free formula sets us apart. No charcoal means 60%+ less smoke, cleaner air, and purer fragrance experience.",
      details: [
        "Charcoal-free burning agent",
        "Bambooless design",
        "60%+ less smoke than traditional agarbatti",
        "No harmful combustion byproducts"
      ]
    },
    {
      icon: FlaskConical,
      title: "Rigorous Testing",
      description: "Every batch undergoes quality testing to ensure consistency in fragrance strength, burn time, smoke emission, and overall performance.",
      details: [
        "Fragrance consistency verification",
        "Burn time testing (40-50 minutes)",
        "Smoke emission measurement",
        "Visual inspection for defects"
      ]
    }
  ];

  const ingredientSources = [
    {
      ingredient: "Sandalwood Oil",
      source: "Karnataka & Tamil Nadu, India",
      benefit: "Rich, creamy, meditative fragrance"
    },
    {
      ingredient: "Rose Essence",
      source: "Rose valleys of India",
      benefit: "Fresh, romantic, calming aroma"
    },
    {
      ingredient: "Oudh/Agarwood",
      source: "Northeast India",
      benefit: "Deep, woody, luxurious scent"
    },
    {
      ingredient: "Bakhoor Blend",
      source: "Arabian-inspired formulation",
      benefit: "Exotic, warm, festive fragrance"
    },
    {
      ingredient: "Flower Dust",
      source: "Temple flower recycling programs",
      benefit: "Clean-burning natural base"
    },
    {
      ingredient: "Natural Resins",
      source: "Indigenous tree extracts",
      benefit: "Minimal smoke, natural binding"
    }
  ];

  const certifications = [
    {
      title: "No Synthetic Fragrances",
      description: "We never use artificial or synthetic fragrance compounds"
    },
    {
      title: "No Harmful Chemicals",
      description: "Free from DEP, phthalates, and other harmful additives"
    },
    {
      title: "No Charcoal",
      description: "Zero charcoal for cleaner burning and healthier air"
    },
    {
      title: "No Bamboo Core",
      description: "Bambooless design for pure fragrance without wood smoke"
    },
    {
      title: "Cruelty-Free",
      description: "No animal testing, no animal-derived ingredients"
    },
    {
      title: "Eco-Friendly Packaging",
      description: "Recyclable packaging materials wherever possible"
    }
  ];

  const qualityMetrics = [
    { metric: "Burn Time", value: "40-50 Min", description: "Long-lasting fragrance per stick" },
    { metric: "Smoke Reduction", value: "60%+", description: "Less smoke than traditional agarbatti" },
    { metric: "Ethical Sourcing", value: "100%", description: "Only ethically sourced ingredients used" },
    { metric: "Artisan Made", value: "100%", description: "Crafted by skilled Indian artisans" }
  ];

  return (
    <>
      <ArticleSchema />
      
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span> Fragrances
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#fragrances" className="hover:text-[#D4AF37]">Products</Link>
            <Link href="/our-quality" className="text-[#D4AF37] font-medium">Our Quality</Link>
            <Link href="/why-zero-charcoal" className="hover:text-[#D4AF37]">Why Zero Charcoal?</Link>
            <Link href="/faq" className="hover:text-[#D4AF37]">FAQs</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium mb-6">
              Uncompromising Standards
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-6">
              Our Quality Standards
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              At Addrika, quality isn&apos;t just a promise—it&apos;s the foundation of everything we create. 
              Discover what makes our incense truly premium.
            </p>
          </div>
        </section>

        {/* Quality Metrics Banner */}
        <section className="py-8 px-4 bg-[#F5F0E8]">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {qualityMetrics.map((item, index) => (
                <div key={index} className="p-4">
                  <p className="text-3xl font-bold text-[#D4AF37] mb-1">{item.value}</p>
                  <p className="text-sm font-medium text-[#2B3A4A]">{item.metric}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Four Pillars of Quality */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              The Four Pillars of Addrika Quality
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Every Addrika incense stick is built on these uncompromising principles
            </p>
            
            <div className="grid md:grid-cols-2 gap-8">
              {qualityPillars.map((pillar, index) => (
                <div key={index} className="bg-[#F5F0E8] rounded-xl p-8">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                      <pillar.icon className="w-7 h-7 text-[#D4AF37]" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-[#2B3A4A] mb-2">{pillar.title}</h3>
                      <p className="text-gray-600">{pillar.description}</p>
                    </div>
                  </div>
                  <ul className="space-y-2 ml-18 pl-4 border-l-2 border-[#D4AF37]/30">
                    {pillar.details.map((detail, detailIndex) => (
                      <li key={detailIndex} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Ingredient Sourcing */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Where Our Ingredients Come From
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              We source the finest ingredients from trusted suppliers across India and beyond
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ingredientSources.map((item, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                  <h3 className="font-semibold text-[#2B3A4A] mb-1">{item.ingredient}</h3>
                  <p className="text-sm text-[#D4AF37] mb-2">{item.source}</p>
                  <p className="text-sm text-gray-600">{item.benefit}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Don't Use */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Our Quality Commitments
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              What we promise to never use in any Addrika product
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {certifications.map((cert, index) => (
                <div key={index} className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-100">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A] text-sm">{cert.title}</h3>
                    <p className="text-xs text-gray-600 mt-1">{cert.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Artisan Story */}
        <section className="py-16 px-4 bg-[#2B3A4A] text-white">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <Users className="w-16 h-16 text-[#D4AF37] mx-auto mb-4" />
              <h2 className="text-3xl font-bold font-serif mb-4">
                The Artisans Behind Our Incense
              </h2>
              <p className="text-gray-300 max-w-2xl mx-auto">
                Every Addrika incense stick is crafted by skilled artisans who have dedicated their lives 
                to perfecting this ancient craft using traditional techniques refined in India
              </p>
            </div>
            
            <div className="bg-white/10 rounded-xl p-8">
              <div className="grid md:grid-cols-3 gap-8 text-center">
                <div>
                  <p className="text-4xl font-bold text-[#D4AF37] mb-2">20+</p>
                  <p className="text-sm text-gray-300">Years of combined experience</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-[#D4AF37] mb-2">100%</p>
                  <p className="text-sm text-gray-300">Fair wages guaranteed</p>
                </div>
                <div>
                  <p className="text-4xl font-bold text-[#D4AF37] mb-2">Small</p>
                  <p className="text-sm text-gray-300">Batch production for quality</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Quality Process */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Our Quality Process
            </h2>
            <div className="space-y-6">
              {[
                {
                  step: 1,
                  title: "Ingredient Selection",
                  description: "We source only the finest ingredients from trusted suppliers, testing each batch for purity and fragrance quality."
                },
                {
                  step: 2,
                  title: "Traditional Preparation",
                  description: "Essential oils and quality materials are blended using traditional recipes refined over generations."
                },
                {
                  step: 3,
                  title: "Artisan Crafting",
                  description: "Skilled artisans carefully craft each incense stick, ensuring consistent quality and proper density."
                },
                {
                  step: 4,
                  title: "Air Drying",
                  description: "Sticks are dried naturally to preserve fragrance integrity—no artificial heat that degrades essential oils."
                },
                {
                  step: 5,
                  title: "Quality Testing",
                  description: "Every batch is tested for burn time, smoke emission, and fragrance strength before packaging."
                },
                {
                  step: 6,
                  title: "Careful Packaging",
                  description: "Products are sealed in protective packaging to preserve freshness until they reach your home."
                }
              ].map((item, index) => (
                <div key={index} className="flex gap-4 bg-white p-6 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#D4AF37] text-white flex items-center justify-center flex-shrink-0 font-bold">
                    {item.step}
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A] mb-1">{item.title}</h3>
                    <p className="text-gray-600 text-sm">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related Content - Internal Linking */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Learn More About Addrika
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link href="/ingredients" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                <p className="text-sm text-gray-600">Discover the ethically sourced ingredients in every Addrika incense stick</p>
              </Link>
              <Link href="/why-zero-charcoal" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                <Wind className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Why Zero Charcoal?</h3>
                <p className="text-sm text-gray-600">Learn why our charcoal-free formula is better for you and your home</p>
              </Link>
              <Link href="/faq" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                <Heart className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">FAQs</h3>
                <p className="text-sm text-gray-600">Get answers to common questions about our products</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
              Experience Addrika Quality
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Try our premium incense and feel the difference that uncompromising quality makes
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/low-smoke-incense"
                className="bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
              >
                Shop Our Collection
              </Link>
              <Link
                href="/ingredients"
                className="border-2 border-[#2B3A4A] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#2B3A4A] hover:text-white transition-colors"
              >
                View All Ingredients
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a252f] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika Fragrances</p>
          <p className="text-sm text-gray-400">Uncompromising Quality in Every Stick</p>
          <p className="text-sm text-gray-400 mt-2">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
