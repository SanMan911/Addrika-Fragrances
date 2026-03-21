import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf, Droplets, Flower2, TreeDeciduous, Sparkles, Wind, CheckCircle, ArrowRight, FlaskConical } from 'lucide-react';
import SEO from '../components/SEO';

const IngredientsPage = () => {
  const mainIngredients = [
    {
      icon: Droplets,
      name: "Pure Essential Oils",
      category: "Primary Fragrance Source",
      description: "The heart of every Addrika incense stick. We use only pure, undiluted essential oils extracted from natural sources.",
      varieties: [
        { name: "Sandalwood Oil (Chandan)", source: "Karnataka & Tamil Nadu, India", profile: "Rich, creamy, meditative", benefits: "Known for calming properties, traditionally used in meditation and spiritual practices" },
        { name: "Rose Essence (Gulab)", source: "Rose valleys of Rajasthan & UP, India", profile: "Fresh, romantic, floral", benefits: "Uplifting and mood-enhancing, creates a romantic and peaceful atmosphere" },
        { name: "Oudh/Agarwood Oil", source: "Northeast India (Assam)", profile: "Deep, woody, luxurious", benefits: "Considered one of the most precious fragrance ingredients, promotes relaxation" },
        { name: "Bakhoor Blend", source: "Arabian-inspired formulation", profile: "Exotic, warm, festive", benefits: "Creates a welcoming atmosphere, traditionally used for hospitality" }
      ]
    },
    {
      icon: Flower2,
      name: "Natural Flower Dust",
      category: "Base Material",
      description: "Instead of charcoal, we use finely processed flower dust as our primary burning base. This produces clean smoke and allows the essential oils to shine.",
      details: [
        "Sourced from temple flower recycling programs",
        "Dried and processed into fine powder",
        "Burns cleanly without toxic byproducts",
        "Creates minimal ash residue",
        "Environmentally sustainable alternative to charcoal"
      ]
    },
    {
      icon: TreeDeciduous,
      name: "Natural Resins",
      category: "Binding Agent",
      description: "Plant-based resins hold our incense together while adding subtle aromatic notes. They burn slowly and evenly.",
      types: [
        { name: "Gum Arabic", benefit: "Natural binder from Acacia trees, odorless when burned" },
        { name: "Benzoin Resin", benefit: "Adds warm vanilla-like notes, used in traditional incense" },
        { name: "Frankincense", benefit: "Sacred resin with purifying properties" }
      ]
    },
    {
      icon: Leaf,
      name: "Aromatic Herbs & Spices",
      category: "Supporting Notes",
      description: "Traditional herbs and spices add depth and complexity to our fragrance profiles.",
      examples: [
        "Saffron (Kesar) - Premium spice for Kesar Chandan blend",
        "Vetiver (Khus) - Earthy, grounding notes",
        "Clove - Warm, spicy undertones",
        "Cardamom - Fresh, aromatic sweetness"
      ]
    }
  ];

  const ingredientsByProduct = [
    { product: "Kesar Chandan", tagline: "Majestic Saffron", ingredients: ["Pure sandalwood oil", "Saffron extract", "Natural flower dust", "Plant resins"], notes: "Warm, creamy, meditative with golden saffron accent" },
    { product: "Regal Rose", tagline: "Timeless Elegance", ingredients: ["Pure rose essence", "Rose petal dust", "Natural flower dust", "Plant resins"], notes: "Fresh, romantic, floral with true rose character" },
    { product: "Oriental Oudh", tagline: "Ancient Luxury", ingredients: ["Oudh/Agarwood oil", "Woody herbs", "Natural flower dust", "Plant resins"], notes: "Deep, woody, luxurious with mysterious depth" },
    { product: "Bold Bakhoor", tagline: "Exotic Warmth", ingredients: ["Bakhoor blend oils", "Aromatic spices", "Natural flower dust", "Plant resins"], notes: "Exotic, warm, festive with Arabian character" }
  ];

  const whatWeNeverUse = [
    { item: "Charcoal", reason: "Produces heavy smoke and harmful particles" },
    { item: "Bamboo core", reason: "Creates wood smoke that masks fragrance" },
    { item: "Synthetic fragrances", reason: "Chemical compounds that can cause irritation" },
    { item: "DEP (Diethyl Phthalate)", reason: "Common plasticizer, potential health concerns" },
    { item: "Petroleum-based binders", reason: "Non-natural, releases toxins when burned" },
    { item: "Artificial colors", reason: "Unnecessary chemicals in incense" }
  ];

  return (
    <>
      <SEO 
        title="Natural Ingredients in Addrika Incense | 100% Pure Essential Oils & Herbs"
        description="Discover the 100% natural ingredients in Addrika incense sticks: pure sandalwood oil, rose essence, oudh/agarwood, bakhoor blend, flower dust, and natural resins."
        keywords="natural incense ingredients, pure essential oil incense, sandalwood incense, rose incense, oudh agarwood incense, bakhoor incense, flower dust agarbatti"
      />
      
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium mb-6">
              100% Natural • Zero Charcoal • Pure Essential Oils
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-6">
              What's Inside Addrika Incense?
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              A complete guide to every natural ingredient we use—and everything we promise to never use
            </p>
          </div>
        </section>

        {/* Quick Summary */}
        <section className="py-8 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <h2 className="font-semibold text-[#2B3A4A] mb-4">Addrika Ingredient Summary</h2>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600"><strong className="text-[#2B3A4A]">Base Material:</strong> Natural flower dust (not charcoal)</p>
                  <p className="text-gray-600"><strong className="text-[#2B3A4A]">Fragrance Source:</strong> Pure essential oils</p>
                  <p className="text-gray-600"><strong className="text-[#2B3A4A]">Binding Agent:</strong> Natural plant resins</p>
                </div>
                <div>
                  <p className="text-gray-600"><strong className="text-[#2B3A4A]">Supporting Ingredients:</strong> Aromatic herbs & spices</p>
                  <p className="text-gray-600"><strong className="text-[#2B3A4A]">Charcoal Content:</strong> Zero (charcoal-free)</p>
                  <p className="text-gray-600"><strong className="text-[#2B3A4A]">Synthetic Content:</strong> Zero (100% natural)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Ingredients Detail */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-12">
              Our Core Ingredients
            </h2>
            
            <div className="space-y-12">
              {mainIngredients.map((ingredient, index) => (
                <div key={index} className="bg-[#F5F0E8] rounded-xl p-8">
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                      <ingredient.icon className="w-7 h-7 text-[#D4AF37]" />
                    </div>
                    <div>
                      <span className="text-xs font-medium text-[#D4AF37] uppercase tracking-wider">{ingredient.category}</span>
                      <h3 className="text-2xl font-semibold text-[#2B3A4A]">{ingredient.name}</h3>
                      <p className="text-gray-600 mt-2">{ingredient.description}</p>
                    </div>
                  </div>
                  
                  {ingredient.varieties && (
                    <div className="grid sm:grid-cols-2 gap-4 mt-6">
                      {ingredient.varieties.map((variety, vIndex) => (
                        <div key={vIndex} className="bg-white rounded-lg p-4">
                          <h4 className="font-semibold text-[#2B3A4A] mb-1">{variety.name}</h4>
                          <p className="text-xs text-[#D4AF37] mb-2">Source: {variety.source}</p>
                          <p className="text-sm text-gray-600 mb-1"><strong>Profile:</strong> {variety.profile}</p>
                          <p className="text-sm text-gray-500">{variety.benefits}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {ingredient.details && (
                    <ul className="mt-6 space-y-2">
                      {ingredient.details.map((detail, dIndex) => (
                        <li key={dIndex} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  {ingredient.types && (
                    <div className="mt-6 grid sm:grid-cols-3 gap-4">
                      {ingredient.types.map((type, tIndex) => (
                        <div key={tIndex} className="bg-white rounded-lg p-3">
                          <h4 className="font-medium text-[#2B3A4A] text-sm">{type.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">{type.benefit}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {ingredient.examples && (
                    <ul className="mt-6 grid sm:grid-cols-2 gap-2">
                      {ingredient.examples.map((example, eIndex) => (
                        <li key={eIndex} className="flex items-center gap-2 text-sm text-gray-600">
                          <Sparkles className="w-4 h-4 text-[#D4AF37] flex-shrink-0" />
                          {example}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Product-Specific Ingredients */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Ingredients by Product
            </h2>
            <p className="text-gray-600 text-center mb-12">
              What goes into each of our four signature fragrances
            </p>
            
            <div className="grid sm:grid-cols-2 gap-6">
              {ingredientsByProduct.map((product, index) => (
                <div key={index} className="bg-white rounded-xl p-6 shadow-sm">
                  <p className="text-xs font-medium text-[#D4AF37] mb-1">{product.tagline}</p>
                  <h3 className="text-xl font-semibold text-[#2B3A4A] mb-3">{product.product}</h3>
                  <ul className="space-y-1 mb-4">
                    {product.ingredients.map((ing, iIndex) => (
                      <li key={iIndex} className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                        {ing}
                      </li>
                    ))}
                  </ul>
                  <p className="text-sm text-gray-500 italic">{product.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Never Use */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              What We Never Use
            </h2>
            <p className="text-gray-600 text-center mb-12">
              These ingredients will never be found in any Addrika product
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {whatWeNeverUse.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-4 bg-red-50 rounded-lg border border-red-100">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-red-500 text-lg">✕</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A] text-sm">{item.item}</h3>
                    <p className="text-xs text-gray-600 mt-1">{item.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Related Content */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Explore More
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link to="/our-quality" className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow group">
                <FlaskConical className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Quality Standards</h3>
                <p className="text-sm text-gray-600">Learn about our rigorous quality process</p>
              </Link>
              <Link to="/why-zero-charcoal" className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Wind className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Why Zero Charcoal?</h3>
                <p className="text-sm text-gray-600">Discover the benefits of charcoal-free incense</p>
              </Link>
              <Link to="/faq" className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Sparkles className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">FAQs</h3>
                <p className="text-sm text-gray-600">Common questions about our products</p>
              </Link>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-[#2B3A4A] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <Wind className="w-16 h-16 text-[#D4AF37] mx-auto mb-6" />
            <h2 className="text-3xl font-bold font-serif mb-4">
              Why 100% Natural Matters
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-8">
              When you burn incense, you're releasing its components into your breathing space. 
              That's why we believe only natural, carefully sourced ingredients belong in your home.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                to="/#fragrances"
                className="bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors inline-flex items-center gap-2"
              >
                Shop Natural Incense
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/why-zero-charcoal"
                className="border border-white/30 text-white px-8 py-4 rounded-full font-semibold hover:bg-white/10 transition-colors"
              >
                Why Zero Charcoal?
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default IngredientsPage;
