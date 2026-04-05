import Link from 'next/link';
import { CheckCircle, XCircle, Leaf, Wind, Heart, Award, ArrowRight, FlaskConical, Sparkles } from 'lucide-react';

export const metadata = {
  title: 'Why Zero Charcoal Incense? | Benefits of Charcoal-Free Agarbatti | Addrika',
  description: 'Learn why Addrika\'s zero charcoal incense is better than traditional agarbatti. Discover the health benefits, environmental advantages, and superior fragrance of charcoal-free, bambooless incense sticks.',
  keywords: [
    'zero charcoal incense benefits', 'charcoal-free agarbatti advantages', 'why bambooless incense',
    'low smoke incense health benefits', 'natural incense vs charcoal', 'eco-friendly agarbatti',
    'incense for respiratory health', 'clean burning incense'
  ],
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
          "headline": "Why Zero Charcoal Incense? The Complete Guide to Charcoal-Free Agarbatti",
          "description": "Comprehensive guide explaining why zero charcoal incense is better for health, environment, and fragrance experience",
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
          "dateModified": "2026-03-16",
          "mainEntityOfPage": "https://centraders.com/why-zero-charcoal"
        })
      }}
    />
  );
}

export default function WhyZeroCharcoalPage() {
  const charcoalProblems = [
    {
      title: "Produces Heavy Smoke",
      description: "Charcoal burns incompletely, creating dense smoke that can irritate eyes and respiratory system"
    },
    {
      title: "Releases Harmful Particles",
      description: "Burning charcoal releases fine particulate matter (PM2.5) and carbon compounds into the air"
    },
    {
      title: "Leaves Black Residue",
      description: "Charcoal ash and soot can stain walls, furniture, and leave dirty residue"
    },
    {
      title: "Masks Natural Fragrance",
      description: "The smell of burning charcoal can overpower and distort the true fragrance of essential oils"
    }
  ];

  const zeroCharcoalBenefits = [
    {
      icon: Wind,
      title: "60%+ Less Smoke",
      description: "Our charcoal-free formula produces minimal smoke, perfect for indoor spaces and small apartments"
    },
    {
      icon: Heart,
      title: "Healthier for Breathing",
      description: "No charcoal particles means cleaner air, better for respiratory health and meditation practices"
    },
    {
      icon: Leaf,
      title: "Pure, Natural Fragrance",
      description: "Experience authentic essential oil scents without the interference of burning charcoal smell"
    },
    {
      icon: Award,
      title: "Clean Burning",
      description: "Minimal ash residue, no black soot, no staining of walls or surfaces"
    }
  ];

  const comparisonTable = [
    { aspect: "Smoke Production", traditional: "Heavy, dense smoke", addrika: "80% less smoke - minimal and light" },
    { aspect: "Air Quality", traditional: "Releases PM2.5 particles", addrika: "Cleaner air, fewer particles" },
    { aspect: "Health Impact", traditional: "Can irritate respiratory system", addrika: "Gentler on breathing" },
    { aspect: "Residue", traditional: "Black soot and heavy ash", addrika: "Light, minimal ash" },
    { aspect: "Fragrance Purity", traditional: "Masked by charcoal smell", addrika: "Pure essential oil fragrance" },
    { aspect: "Indoor Use", traditional: "Can overwhelm small spaces", addrika: "Perfect for apartments" },
    { aspect: "For Meditation", traditional: "Smoke can distract", addrika: "Ideal for deep breathing" },
    { aspect: "Eco-Friendliness", traditional: "Charcoal production impacts forests", addrika: "Sustainable ingredients" },
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
            <Link href="/low-smoke-incense" className="hover:text-[#D4AF37]">Low Smoke</Link>
            <Link href="/why-zero-charcoal" className="text-[#D4AF37] font-medium">Why Zero Charcoal?</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-6">
              Why Choose Zero Charcoal Incense?
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Discover why Addrika&apos;s charcoal-free formula is the healthier, 
              cleaner, and more authentic way to enjoy premium incense
            </p>
          </div>
        </section>

        {/* The Problem with Traditional Incense */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              The Problem with Traditional Charcoal-Based Agarbatti
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Most traditional incense sticks use charcoal as a burning agent. Here&apos;s why that&apos;s problematic:
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {charcoalProblems.map((problem, index) => (
                <div key={index} className="flex gap-4 p-6 bg-red-50 rounded-xl border border-red-100">
                  <XCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A] mb-1">{problem.title}</h3>
                    <p className="text-gray-600 text-sm">{problem.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The Addrika Solution */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              The Addrika Zero Charcoal Solution
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              We developed a proprietary charcoal-free formula using only natural ingredients
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {zeroCharcoalBenefits.map((benefit, index) => (
                <div key={index} className="flex gap-4 p-6 bg-white rounded-xl shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
                    <benefit.icon className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A] mb-1">{benefit.title}</h3>
                    <p className="text-gray-600 text-sm">{benefit.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How We Achieve Low Smoke */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              How Addrika Achieves 60%+ Less Smoke
            </h2>
            <div className="bg-[#F5F0E8] rounded-xl p-8">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-white flex items-center justify-center flex-shrink-0 font-bold">1</div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A]">Charcoal-Free Base</h3>
                    <p className="text-gray-600">Instead of charcoal, we use natural flower dust and plant-based materials that burn cleanly</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-white flex items-center justify-center flex-shrink-0 font-bold">2</div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A]">Bambooless Design</h3>
                    <p className="text-gray-600">No bamboo core means no wood smoke - just pure fragrance release</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-white flex items-center justify-center flex-shrink-0 font-bold">3</div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A]">Natural Resins</h3>
                    <p className="text-gray-600">Plant-based resins bind ingredients together while producing minimal smoke</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37] text-white flex items-center justify-center flex-shrink-0 font-bold">4</div>
                  <div>
                    <h3 className="font-semibold text-[#2B3A4A]">Pure Essential Oils</h3>
                    <p className="text-gray-600">High-quality essential oils deliver fragrance through vaporization, not combustion</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Detailed Comparison Table */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Complete Comparison: Traditional vs Zero Charcoal
            </h2>
            <div className="overflow-x-auto bg-white rounded-xl shadow-sm">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#2B3A4A] text-white">
                    <th className="p-4 text-left font-semibold">Aspect</th>
                    <th className="p-4 text-left font-semibold">Traditional Agarbatti</th>
                    <th className="p-4 text-left font-semibold">Addrika Zero Charcoal</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonTable.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="p-4 font-medium text-[#2B3A4A]">{row.aspect}</td>
                      <td className="p-4 text-gray-600">
                        <span className="flex items-center gap-2">
                          <XCircle className="w-4 h-4 text-red-400" />
                          {row.traditional}
                        </span>
                      </td>
                      <td className="p-4 text-green-700">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          {row.addrika}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Who Should Choose Zero Charcoal */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Who Should Choose Zero Charcoal Incense?
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                "Health-conscious individuals",
                "People with respiratory sensitivities",
                "Apartment dwellers",
                "Meditation practitioners",
                "Yoga instructors and studios",
                "Parents with young children",
                "Pet owners",
                "Spa and wellness centers",
                "Those who value clean air"
              ].map((item, index) => (
                <div key={index} className="flex items-center gap-3 p-4 bg-[#F5F0E8] rounded-lg">
                  <CheckCircle className="w-5 h-5 text-[#D4AF37]" />
                  <span className="text-[#2B3A4A]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-[#2B3A4A]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white font-serif mb-4">
              Ready to Experience the Difference?
            </h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands who&apos;ve switched to Addrika&apos;s zero charcoal incense for a cleaner, healthier fragrance experience
            </p>
            <Link
              href="/low-smoke-incense#products"
              className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Shop Zero Charcoal Collection
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>

        {/* Related Content - Internal Linking */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Discover More About Addrika
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link href="/ingredients" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                <p className="text-sm text-gray-600">Explore all the natural ingredients we use in our incense</p>
              </Link>
              <Link href="/our-quality" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <FlaskConical className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Quality Standards</h3>
                <p className="text-sm text-gray-600">Learn about our uncompromising quality process</p>
              </Link>
              <Link href="/faq" className="bg-[#F5F0E8] rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Sparkles className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">FAQs</h3>
                <p className="text-sm text-gray-600">Get answers to common questions about our products</p>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a252f] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika Fragrances</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited</p>
        </div>
      </footer>
    </>
  );
}
