import Link from 'next/link';
import { Heart, Target, Leaf, Award, Users, TrendingUp } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'About Us | Centsibl Traders - Addrika Premium Incense Manufacturer',
  description: 'Centsibl Traders Private Limited - A purpose-driven Indian enterprise creating Addrika premium incense. Built on ethical trade, inclusive growth, and responsible entrepreneurship.',
  keywords: ['centsible traders', 'addrika manufacturer', 'incense company india', 'ethical incense brand', 'premium agarbatti company'],
  openGraph: {
    title: 'About Us | Centsibl Traders',
    description: 'A purpose-driven Indian enterprise creating premium natural incense.',
    url: 'https://centraders.com/about-us',
  },
};

export default function AboutUsPage() {
  const values = [
    {
      icon: Heart,
      title: 'Purpose-Driven',
      description: 'Every decision we make is guided by our commitment to creating meaningful impact.'
    },
    {
      icon: Target,
      title: 'Quality First',
      description: 'We never compromise on the quality of our ingredients or craftsmanship.'
    },
    {
      icon: Leaf,
      title: 'Sustainable',
      description: 'Environmental responsibility is woven into every aspect of our operations.'
    },
    {
      icon: Award,
      title: 'Authentic',
      description: 'We stay true to traditional methods while embracing innovation.'
    },
    {
      icon: Users,
      title: 'Inclusive',
      description: 'We believe in creating opportunities for artisans and communities.'
    },
    {
      icon: TrendingUp,
      title: 'Growth-Oriented',
      description: 'Continuous improvement drives us to be better every day.'
    }
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative py-20 px-4">
          <div 
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ 
              background: 'radial-gradient(ellipse at center top, rgba(212,175,55,0.1) 0%, transparent 50%)'
            }}
          />
          <div className="max-w-4xl mx-auto text-center relative">
            <span 
              className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
              style={{ 
                background: 'rgba(212,175,55,0.1)', 
                color: '#D4AF37',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              ABOUT CENTSIBLE TRADERS
            </span>
            <h1 
              className="text-4xl sm:text-5xl font-bold text-white mb-6"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Building a Better Tomorrow Through Ethical Trade
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Centsibl Traders Private Limited is a purpose-driven Indian enterprise, 
              committed to ethical trade, inclusive growth, and responsible entrepreneurship.
            </p>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 
                  className="text-3xl font-bold text-white mb-6"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Our Mission
                </h2>
                <p className="text-gray-300 mb-4 leading-relaxed">
                  At Centsibl Traders, we believe that business can be a force for good. 
                  Our mission is to create premium products that honor traditional craftsmanship 
                  while providing fair opportunities for artisans across India.
                </p>
                <p className="text-gray-300 leading-relaxed">
                  Through Addrika, our flagship incense brand, we bring the sacred art of 
                  fragrance to modern homes while supporting sustainable practices and 
                  empowering local communities.
                </p>
              </div>
              <div 
                className="p-8 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div className="text-center">
                  <p className="text-5xl font-bold text-[#D4AF37] mb-2">2022</p>
                  <p className="text-gray-400">Founded</p>
                </div>
                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">4</p>
                    <p className="text-sm text-gray-400">Signature Fragrances</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">100%</p>
                    <p className="text-sm text-gray-400">Natural Ingredients</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 
                className="text-3xl font-bold text-white mb-4"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Our Core Values
              </h2>
              <p className="text-gray-400 max-w-2xl mx-auto">
                These principles guide everything we do at Centsibl Traders.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value, index) => (
                <div 
                  key={index}
                  className="p-6 rounded-xl transition-all hover:-translate-y-1"
                  style={{ 
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: 'rgba(212,175,55,0.15)' }}
                  >
                    <value.icon className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-400 text-sm">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 pb-20">
          <div className="max-w-4xl mx-auto text-center">
            <div 
              className="p-8 sm:p-12 rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.2) 100%)',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              <h2 
                className="text-3xl font-bold text-white mb-4"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Experience the Addrika Difference
              </h2>
              <p className="text-gray-300 mb-8">
                Discover our collection of premium natural incense, crafted with care and tradition.
              </p>
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Shop Our Collection
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
