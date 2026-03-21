import React from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Leaf, Wind, Heart, Award, ArrowRight, FlaskConical, Sparkles } from 'lucide-react';
import SEO from '../components/SEO';

const WhyZeroCharcoalPage = () => {
  const benefits = [
    {
      title: "80% Less Smoke",
      description: "Traditional agarbatti produces heavy smoke due to charcoal combustion. Our charcoal-free formula dramatically reduces smoke while maintaining rich fragrance.",
      icon: Wind
    },
    {
      title: "Purer Fragrance",
      description: "Without charcoal masking the scent, you experience the true essence of our premium essential oils - sandalwood, rose, oudh, and bakhoor in their purest form.",
      icon: Sparkles
    },
    {
      title: "Healthier Indoor Air",
      description: "Charcoal combustion releases carbon particles and compounds. Our natural flower-dust base burns cleaner, making it safer for indoor use.",
      icon: Heart
    },
    {
      title: "No Soot or Residue",
      description: "Say goodbye to black soot on walls and ceilings. Zero charcoal means cleaner burning with minimal ash residue.",
      icon: Award
    },
    {
      title: "Safe for Small Spaces",
      description: "Perfect for apartments, bedrooms, and meditation rooms. The reduced smoke won't overwhelm compact spaces.",
      icon: Leaf
    },
    {
      title: "Longer Lasting Scent",
      description: "The pure essential oils in our formula provide 40-50 minutes of fragrance that lingers for hours after burning.",
      icon: FlaskConical
    }
  ];

  const comparison = [
    { feature: "Smoke Level", traditional: "High - heavy smoke", addrika: "Low - 80% less smoke" },
    { feature: "Charcoal Content", traditional: "Contains charcoal", addrika: "Zero charcoal" },
    { feature: "Soot/Residue", traditional: "Black soot on surfaces", addrika: "Minimal, clean ash" },
    { feature: "Fragrance Purity", traditional: "Masked by charcoal smell", addrika: "Pure essential oil scent" },
    { feature: "Indoor Suitability", traditional: "Can overwhelm small spaces", addrika: "Perfect for any room size" },
    { feature: "Burn Time", traditional: "20-30 minutes typical", addrika: "40-50 minutes" },
    { feature: "Health Impact", traditional: "Higher particulate matter", addrika: "Cleaner, gentler burn" }
  ];

  return (
    <>
      <SEO 
        title="Why Zero Charcoal Incense? | Benefits of Charcoal-Free Agarbatti | Addrika"
        description="Discover why Addrika's zero charcoal incense is better for your health and home. 80% less smoke, purer fragrance, no soot - perfect for indoor use in India."
        keywords="zero charcoal incense, charcoal-free agarbatti, low smoke incense, natural incense india, healthy incense, indoor incense"
      />
      
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="py-20 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium mb-6">
              The Addrika Difference
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-6">
              Why Zero Charcoal?
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Traditional incense relies on charcoal for burning. We chose a different path—one that's 
              better for your health, your home, and your senses.
            </p>
          </div>
        </section>

        {/* Key Stat */}
        <section className="py-8 px-4 bg-[#D4AF37]">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-4xl font-bold text-[#2B3A4A]">80% Less Smoke</p>
            <p className="text-[#2B3A4A]/80">Compared to traditional charcoal-based agarbatti</p>
          </div>
        </section>

        {/* Benefits Grid */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Benefits of Charcoal-Free Incense
            </h2>
            <p className="text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Discover why thousands of health-conscious Indians are making the switch
            </p>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((benefit, index) => (
                <div key={index} className="bg-[#F5F0E8] rounded-xl p-6">
                  <benefit.icon className="w-10 h-10 text-[#D4AF37] mb-4" />
                  <h3 className="text-lg font-semibold text-[#2B3A4A] mb-2">{benefit.title}</h3>
                  <p className="text-sm text-gray-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Comparison Table */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-4">
              Addrika vs Traditional Agarbatti
            </h2>
            <p className="text-gray-600 text-center mb-12">
              See how our zero-charcoal formula compares
            </p>
            
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#2B3A4A] text-white">
                    <th className="p-4 text-left font-semibold">Feature</th>
                    <th className="p-4 text-left font-semibold">Traditional</th>
                    <th className="p-4 text-left font-semibold">Addrika</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="p-4 font-medium text-[#2B3A4A]">{row.feature}</td>
                      <td className="p-4">
                        <span className="flex items-center gap-2 text-red-600 text-sm">
                          <XCircle className="w-4 h-4" />
                          {row.traditional}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="flex items-center gap-2 text-green-600 text-sm">
                          <CheckCircle className="w-4 h-4" />
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

        {/* How We Do It */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-12">
              How We Achieve Zero Charcoal
            </h2>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-[#F5F0E8] rounded-xl p-8">
                <h3 className="text-xl font-semibold text-[#2B3A4A] mb-4">Natural Flower Dust Base</h3>
                <p className="text-gray-600 mb-4">
                  Instead of charcoal, we use finely processed flower dust sourced from temple flower recycling programs. 
                  This sustainable base burns cleanly and allows our essential oils to shine.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Eco-friendly and sustainable
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Clean burning with minimal residue
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Allows pure fragrance to emerge
                  </li>
                </ul>
              </div>
              
              <div className="bg-[#F5F0E8] rounded-xl p-8">
                <h3 className="text-xl font-semibold text-[#2B3A4A] mb-4">Bambooless Design</h3>
                <p className="text-gray-600 mb-4">
                  Traditional incense uses bamboo sticks that produce wood smoke. Our bambooless design 
                  eliminates this additional smoke source for the purest possible fragrance experience.
                </p>
                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    No wood smoke interference
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Pure essential oil fragrance
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Consistent burn throughout
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Related Content */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
              Discover More About Addrika
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link to="/ingredients" className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow group">
                <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                <p className="text-sm text-gray-600">Explore all the natural ingredients we use</p>
              </Link>
              <Link to="/our-quality" className="bg-white rounded-xl p-6 hover:shadow-md transition-shadow group">
                <FlaskConical className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Quality Standards</h3>
                <p className="text-sm text-gray-600">Learn about our uncompromising quality process</p>
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
        <section className="py-16 px-4 bg-[#2B3A4A]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white font-serif mb-4">
              Ready to Experience the Difference?
            </h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands who've switched to Addrika's zero charcoal incense for a cleaner, healthier fragrance experience
            </p>
            <Link
              to="/#fragrances"
              className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Shop Zero Charcoal Collection
              <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
};

export default WhyZeroCharcoalPage;
