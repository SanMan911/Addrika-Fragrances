import React from 'react';
import { Link } from 'react-router-dom';
import { Award, CheckCircle, Leaf, Wind, Heart, Users, Factory, FlaskConical } from 'lucide-react';
import SEO from '../components/SEO';

const OurQualityPage = () => {
  const qualityPillars = [
    {
      icon: Leaf,
      title: "100% Natural Ingredients",
      description: "Every component in Addrika incense is sourced from nature. Pure essential oils, flower dust, natural resins, and aromatic herbs - never synthetic fragrances or harmful chemicals.",
      details: [
        "Pure sandalwood, rose, oudh, and bakhoor essential oils",
        "Natural flower dust as the base material",
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
      icon: Wind,
      title: "Zero Charcoal Formula",
      description: "Our proprietary charcoal-free formula sets us apart. No charcoal means 80% less smoke, cleaner air, and purer fragrance experience.",
      details: [
        "Charcoal-free burning agent",
        "Bambooless design",
        "80% less smoke than traditional agarbatti",
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

  const qualityMetrics = [
    { metric: "Burn Time", value: "40-50 Min", description: "Long-lasting fragrance per stick" },
    { metric: "Smoke Reduction", value: "80%", description: "Less smoke than traditional agarbatti" },
    { metric: "Natural Content", value: "100%", description: "Only natural ingredients used" },
    { metric: "Artisan Made", value: "100%", description: "Crafted by skilled Indian artisans" }
  ];

  const certifications = [
    { title: "No Synthetic Fragrances", description: "We never use artificial or synthetic fragrance compounds" },
    { title: "No Harmful Chemicals", description: "Free from DEP, phthalates, and other harmful additives" },
    { title: "No Charcoal", description: "Zero charcoal for cleaner burning and healthier air" },
    { title: "No Bamboo Core", description: "Bambooless design for pure fragrance without wood smoke" },
    { title: "Cruelty-Free", description: "No animal testing, no animal-derived ingredients" },
    { title: "Eco-Friendly Packaging", description: "Recyclable packaging materials wherever possible" }
  ];

  return (
    <>
      <SEO 
        title="Our Quality Standards | Premium Natural Incense Craftsmanship | Addrika"
        description="Discover Addrika's uncompromising quality standards. Learn about our 100% natural ingredients, artisan craftsmanship, rigorous testing, and traditional techniques."
        keywords="addrika quality, premium incense quality, natural incense ingredients, artisan incense, incense craftsmanship"
      />
      
      <div className="min-h-screen bg-white">
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
              At Addrika, quality isn't just a promise—it's the foundation of everything we create. 
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

        {/* What We Don't Use */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
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

        {/* Related Content */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Learn More About Addrika
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link to="/ingredients" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                <p className="text-sm text-gray-600">Discover the 100% natural ingredients in every Addrika incense stick</p>
              </Link>
              <Link to="/why-zero-charcoal" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Wind className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Why Zero Charcoal?</h3>
                <p className="text-sm text-gray-600">Learn why our charcoal-free formula is better for you</p>
              </Link>
              <Link to="/faq" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Heart className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">FAQs</h3>
                <p className="text-sm text-gray-600">Get answers to common questions about our products</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
              Experience Addrika Quality
            </h2>
            <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
              Try our premium natural incense and feel the difference that uncompromising quality makes
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/#fragrances"
                className="bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
              >
                Shop Our Collection
              </Link>
              <Link
                to="/ingredients"
                className="border-2 border-[#2B3A4A] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#2B3A4A] hover:text-white transition-colors"
              >
                View All Ingredients
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default OurQualityPage;
