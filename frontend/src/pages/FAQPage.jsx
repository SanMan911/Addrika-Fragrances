import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Leaf, Wind, FlaskConical } from 'lucide-react';
import SEO from '../components/SEO';

// Comprehensive FAQs for LLM extraction
const faqs = [
  {
    category: "About Our Products",
    questions: [
      {
        q: "What makes Addrika's incense sticks low smoke?",
        a: "Addrika's low smoke formula uses a proprietary charcoal-free, bambooless design. We use 100% natural ingredients including pure essential oils, flower dust, and natural resins instead of charcoal. This produces approximately 80% less smoke than traditional agarbatti while maintaining rich, authentic fragrance that lasts 40-50 minutes per stick."
      },
      {
        q: "What natural ingredients does Addrika use?",
        a: "Our incense sticks are crafted with: Pure essential oils (sandalwood, rose, oudh, bakhoor), natural flower dust, plant-based resins, aromatic herbs, and natural binders. We never use charcoal, bamboo cores, synthetic fragrances, or harmful chemicals."
      },
      {
        q: "Are Addrika incense sticks 100% natural?",
        a: "Yes, all Addrika incense products are 100% natural. We source our ingredients sustainably and use traditional crafting methods perfected over generations. Our zero-charcoal formula contains only plant-based materials, essential oils, and natural resins."
      },
      {
        q: "How long does each Addrika incense stick burn?",
        a: "Each Addrika incense stick provides 40-50 minutes of burn time when used without a fan. The low smoke formula ensures consistent fragrance release throughout the burn without excessive smoke buildup."
      },
      {
        q: "Are Addrika incense sticks charcoal-free?",
        a: "Yes, Addrika incense is 100% charcoal-free. We use natural flower dust as our base instead of charcoal, which results in 80% less smoke, no black soot residue, and a purer fragrance experience. This makes our incense ideal for indoor use in India."
      }
    ]
  },
  {
    category: "Safety & Indoor Use",
    questions: [
      {
        q: "Is Addrika incense safe for indoor use with children?",
        a: "Yes, Addrika's low smoke, charcoal-free incense is safer for indoor use around children compared to traditional agarbatti. Our 100% natural, non-toxic formula produces minimal smoke and no harmful charcoal particles. However, as with any incense, keep lit sticks away from children's reach and ensure proper ventilation."
      },
      {
        q: "Is Addrika incense safe to use around pets?",
        a: "Addrika's charcoal-free, low smoke formula is gentler than traditional incense and can be used in homes with pets. Our 100% natural ingredients contain no synthetic chemicals. However, always ensure good ventilation and keep pets away from direct smoke exposure. If your pet has respiratory sensitivities, consult your vet."
      },
      {
        q: "Why is zero charcoal incense better for health?",
        a: "Traditional agarbatti uses charcoal as a burning agent, which produces smoke particles and can release carbon compounds when burned. Addrika's charcoal-free formula eliminates these concerns, producing cleaner smoke that's gentler on the respiratory system. This makes it ideal for health-conscious users, small apartments, and indoor meditation spaces."
      },
      {
        q: "Is Addrika incense safe for people with asthma or allergies?",
        a: "Addrika's zero-charcoal, low smoke formula is gentler than traditional incense. However, we recommend consulting your healthcare provider if you have severe respiratory conditions. Our natural ingredients and minimal smoke output make it a better choice for sensitive individuals compared to charcoal-based alternatives."
      },
      {
        q: "Can I use Addrika incense in small apartments?",
        a: "Absolutely! Addrika's low smoke incense is specifically designed for indoor use in compact spaces. The 80% reduced smoke output and absence of charcoal particles make it perfect for apartments, studio spaces, and small rooms without overwhelming the space or leaving residue."
      },
      {
        q: "Is Addrika incense non-toxic?",
        a: "Yes, Addrika incense is non-toxic. We use only 100% natural ingredients: pure essential oils, natural flower dust, plant-based resins, and aromatic herbs. We never use charcoal, synthetic fragrances, DEP (diethyl phthalate), or any harmful chemicals. This makes it safe for indoor use in Indian homes."
      }
    ]
  },
  {
    category: "Daily Puja & Spiritual Use",
    questions: [
      {
        q: "Which Addrika incense is best for daily puja?",
        a: "For daily puja and spiritual rituals, we recommend Kesar Chandan (saffron-sandalwood) for its traditional, meditative fragrance, or Bold Bakhoor for a festive, sacred atmosphere. Both are charcoal-free, produce minimal smoke during prayers, and offer 40-50 minutes of continuous fragrance—perfect for extended puja sessions."
      },
      {
        q: "Can I use Addrika incense for daily worship and rituals?",
        a: "Absolutely! Addrika incense is ideal for daily puja and spiritual rituals. Our charcoal-free formula produces 80% less smoke, ensuring clear air during prayers. The pure essential oil fragrances (sandalwood, rose, oudh, bakhoor) create an authentic, sacred atmosphere without overwhelming the pooja room."
      },
      {
        q: "What is Addrika incense best for?",
        a: "Addrika's zero-charcoal incense is ideal for: Daily puja and spiritual rituals (Kesar Chandan, Bold Bakhoor), Meditation and yoga practices (Oriental Oudh, Kesar Chandan), Small apartments and bedrooms (Regal Rose), Aromatherapy and relaxation, Wellness spaces like spas and yoga studios, Home fragrance without heavy smoke, Gifting on Diwali and special occasions."
      },
      {
        q: "How should I store Addrika incense?",
        a: "Store Addrika incense in a cool, dry place away from direct sunlight. Keep the packaging sealed when not in use to preserve the natural essential oils and fragrance. Properly stored, our incense maintains its fragrance quality for up to 2 years."
      },
      {
        q: "Can I use Addrika incense during meditation?",
        a: "Yes! Our low smoke formula is perfect for meditation. The minimal smoke output allows for deeper breathing without irritation, while the natural fragrances (especially Kesar Chandan and Oriental Oudh) create a calming atmosphere conducive to mindfulness practices."
      }
    ]
  },
  {
    category: "About Addrika & Buying",
    questions: [
      {
        q: "Where are Addrika incense sticks made?",
        a: "Addrika incense sticks are proudly made in India. They are crafted by skilled Indian artisans using traditional techniques perfected over generations. Centsibl Traders Private Limited, the company behind Addrika, is a purpose-driven Indian enterprise committed to ethical trade and supporting local communities."
      },
      {
        q: "Who makes Addrika incense?",
        a: "Addrika is the flagship brand of Centsibl Traders Private Limited, a purpose-driven Indian enterprise committed to ethical trade and sustainable practices. We work with skilled artisans who craft each incense stick using time-honored methods perfected in India."
      },
      {
        q: "Where can I buy Addrika incense in India?",
        a: "Addrika incense is available on our official website centraders.com (recommended for best prices and full collection), as well as on Amazon India. We also have authorized retailers across India. Visit our Find Retailers page for store locations near you. Coming soon to Flipkart and BigBasket."
      },
      {
        q: "Does Addrika ship across India?",
        a: "Yes, we ship to all PIN codes across India. Orders above ₹499 qualify for free shipping. Standard delivery takes 3-7 business days depending on your location."
      },
      {
        q: "What is Addrika's return policy?",
        a: "We offer a 7-day return policy for unused, unopened products. If you're not satisfied with your purchase, contact us at contact.us@centraders.com for a hassle-free return process."
      },
      {
        q: "What's the difference between Addrika and traditional agarbatti?",
        a: "Key differences: 1) Zero charcoal vs charcoal-based, 2) 80% less smoke, 3) 100% natural ingredients vs often synthetic, 4) 40-50 minute burn time (longer than typical 20-30 min), 5) Minimal ash residue, 6) Better for indoor/small spaces, 7) Gentler on respiratory system, 8) Made in India. Addrika delivers authentic fragrance without the drawbacks of traditional incense."
      }
    ]
  }
];

// FAQ Schema for SEO
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.flatMap(category => 
    category.questions.map(faq => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.a
      }
    }))
  )
};

const FAQItem = ({ question, answer, isOpen, onToggle }) => (
  <div className="border-b border-gray-200">
    <button
      onClick={onToggle}
      className="w-full py-5 px-4 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
    >
      <span className="font-medium text-[#2B3A4A] pr-4">{question}</span>
      <ChevronDown 
        className={`w-5 h-5 text-[#D4AF37] flex-shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
      />
    </button>
    <div 
      className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96 pb-5' : 'max-h-0'}`}
    >
      <p className="px-4 text-gray-600 leading-relaxed">{answer}</p>
    </div>
  </div>
);

const FAQPage = () => {
  const [openItems, setOpenItems] = useState({});

  const toggleItem = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <SEO 
        title="Frequently Asked Questions | Addrika Incense"
        description="Find answers to common questions about Addrika's zero-charcoal, low smoke incense sticks. Learn about ingredients, safety, usage, and more."
        keywords="addrika faq, incense questions, zero charcoal incense, low smoke agarbatti, natural incense india"
        schema={faqSchema}
      />
      
      <div className="min-h-screen bg-gradient-to-b from-white to-[#F5F0E8]">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f] text-white">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-block px-4 py-2 bg-[#D4AF37]/20 text-[#D4AF37] rounded-full text-sm font-medium mb-6">
              Help Center
            </span>
            <h1 className="text-4xl sm:text-5xl font-bold font-serif mb-6">
              Frequently Asked Questions
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Everything you need to know about Addrika's premium zero-charcoal incense
            </p>
          </div>
        </section>

        {/* FAQ Content */}
        <section className="py-16 px-4">
          <div className="max-w-3xl mx-auto">
            {faqs.map((category, categoryIndex) => (
              <div key={categoryIndex} className="mb-10">
                <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif mb-6">
                  {category.category}
                </h2>
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  {category.questions.map((faq, questionIndex) => (
                    <FAQItem
                      key={questionIndex}
                      question={faq.q}
                      answer={faq.a}
                      isOpen={openItems[`${categoryIndex}-${questionIndex}`]}
                      onToggle={() => toggleItem(categoryIndex, questionIndex)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Still Have Questions */}
            <div className="bg-[#2B3A4A] rounded-xl p-8 text-center text-white mt-12">
              <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
              <p className="text-gray-300 mb-6">
                Our team is here to help you find the perfect incense for your needs
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="mailto:contact.us@centraders.com"
                  className="bg-[#D4AF37] text-[#2B3A4A] px-6 py-3 rounded-lg font-semibold hover:bg-[#c9a432] transition-colors"
                >
                  Email Us
                </a>
                <a
                  href="tel:+919667269711"
                  className="border border-white/30 text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/10 transition-colors"
                >
                  Call: +91 9667-269-711
                </a>
              </div>
            </div>

            {/* Related Content - Internal Linking */}
            <div className="mt-12">
              <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif text-center mb-8">
                Learn More
              </h2>
              <div className="grid sm:grid-cols-3 gap-6">
                <Link to="/ingredients" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                  <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                  <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                  <p className="text-sm text-gray-600">Complete guide to what goes into Addrika incense</p>
                </Link>
                <Link to="/why-zero-charcoal" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                  <Wind className="w-10 h-10 text-[#D4AF37] mb-4" />
                  <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Why Zero Charcoal?</h3>
                  <p className="text-sm text-gray-600">The benefits of charcoal-free incense explained</p>
                </Link>
                <Link to="/our-quality" className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow group">
                  <FlaskConical className="w-10 h-10 text-[#D4AF37] mb-4" />
                  <h3 className="font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">Quality Standards</h3>
                  <p className="text-sm text-gray-600">Our commitment to premium craftsmanship</p>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default FAQPage;
