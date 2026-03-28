import Link from 'next/link';
import { HelpCircle, Leaf, Wind, FlaskConical } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'FAQs | Addrika Fragrances - Zero Charcoal Low Smoke Incense Questions',
  description: 'Find answers to common questions about Addrika\'s zero charcoal, low smoke incense sticks. Learn about our natural ingredients, charcoal-free formula, health benefits, and more.',
  keywords: [
    'addrika faq', 'low smoke incense questions', 'zero charcoal agarbatti faq',
    'charcoal-free incense benefits', 'natural incense ingredients', 'incense health safety'
  ],
};

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
        a: "Yes, we ship to all PIN codes across India. Orders above Rs. 499 qualify for free shipping. Standard delivery takes 3-7 business days depending on your location."
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

// FAQPage Schema
function FAQPageSchema() {
  const allQuestions = faqs.flatMap(category => 
    category.questions.map(q => ({
      "@type": "Question",
      "name": q.q,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": q.a
      }
    }))
  );

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": allQuestions
        })
      }}
    />
  );
}

export default function FAQPage() {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <FAQPageSchema />
      <Header />

      <main className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          {/* Hero */}
          <div className="text-center mb-12">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(212,175,55,0.15)' }}
            >
              <HelpCircle className="w-10 h-10 text-[#D4AF37]" />
            </div>
            <h1 
              className="text-4xl sm:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Frequently Asked Questions
            </h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Everything you need to know about Addrika&apos;s zero charcoal, low smoke incense sticks
            </p>
          </div>

          {/* Quick Links */}
          <div 
            className="p-6 mb-8 rounded-xl"
            style={{ 
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
          >
            <h2 className="font-semibold text-white mb-4">Jump to:</h2>
            <div className="flex flex-wrap gap-2">
              {faqs.map((category, index) => (
                <a
                  key={index}
                  href={`#${category.category.toLowerCase().replace(/\s+/g, '-')}`}
                  className="px-4 py-2 rounded-full text-sm transition-colors"
                  style={{ 
                    background: 'rgba(212,175,55,0.1)',
                    color: '#D4AF37',
                    border: '1px solid rgba(212,175,55,0.2)'
                  }}
                >
                  {category.category}
                </a>
              ))}
            </div>
          </div>

          {/* FAQ Sections */}
          {faqs.map((category, categoryIndex) => (
            <section 
              key={categoryIndex} 
              id={category.category.toLowerCase().replace(/\s+/g, '-')}
              className="mb-8"
            >
              <h2 
                className="text-2xl font-bold text-white mb-6"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {category.category}
              </h2>
              <div className="space-y-4">
                {category.questions.map((faq, faqIndex) => (
                  <div 
                    key={faqIndex} 
                    className="p-6 rounded-xl"
                    style={{ 
                      background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <h3 className="font-semibold text-white mb-3 text-lg">
                      {faq.q}
                    </h3>
                    <p className="text-gray-400 leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {/* Still Have Questions */}
          <div 
            className="p-8 text-center rounded-2xl mt-12"
            style={{ 
              background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.2) 100%)',
              border: '1px solid rgba(212,175,55,0.2)'
            }}
          >
            <h2 
              className="text-2xl font-bold text-white mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Still Have Questions?
            </h2>
            <p className="text-gray-300 mb-6">
              Our team is here to help you find the perfect incense for your needs
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="mailto:contact.us@centraders.com"
                className="px-6 py-3 rounded-lg font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Email Us
              </a>
              <a
                href="tel:+919667269711"
                className="px-6 py-3 rounded-lg font-semibold transition-all"
                style={{ 
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white'
                }}
              >
                Call: +91 9667-269-711
              </a>
            </div>
          </div>

          {/* Related Content - Internal Linking */}
          <div className="mt-12">
            <h2 
              className="text-2xl font-bold text-white text-center mb-8"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Learn More
            </h2>
            <div className="grid sm:grid-cols-3 gap-6">
              <Link 
                href="/ingredients" 
                className="p-6 rounded-xl transition-all hover:-translate-y-1 group"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Leaf className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">Our Ingredients</h3>
                <p className="text-sm text-gray-400">Complete guide to what goes into Addrika incense</p>
              </Link>
              <Link 
                href="/why-zero-charcoal" 
                className="p-6 rounded-xl transition-all hover:-translate-y-1 group"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Wind className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">Why Zero Charcoal?</h3>
                <p className="text-sm text-gray-400">The benefits of charcoal-free incense explained</p>
              </Link>
              <Link 
                href="/our-quality" 
                className="p-6 rounded-xl transition-all hover:-translate-y-1 group"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <FlaskConical className="w-10 h-10 text-[#D4AF37] mb-4" />
                <h3 className="font-semibold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">Quality Standards</h3>
                <p className="text-sm text-gray-400">Our commitment to premium craftsmanship</p>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
