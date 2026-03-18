import Link from 'next/link';
import { Heart, Target, Leaf, Award, Users, TrendingUp } from 'lucide-react';

export const metadata = {
  title: 'About Us | Centsibl Traders - Addrika Premium Incense Manufacturer',
  description: 'Centsibl Traders Private Limited - A purpose-driven Indian enterprise creating Addrika premium incense. Built on ethical trade, inclusive growth, and responsible entrepreneurship.',
  keywords: ['centsibl traders', 'addrika manufacturer', 'incense company india', 'ethical incense brand', 'premium agarbatti company'],
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
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[#2B3A4A] font-bold text-xl">
            <span className="text-[#D4AF37]">Addrika</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/#fragrances" className="hover:text-[#D4AF37] transition-colors">Fragrances</Link>
            <Link href="/our-story" className="hover:text-[#D4AF37] transition-colors">Our Story</Link>
            <Link href="/about-us" className="text-[#D4AF37]">About Us</Link>
            <Link href="/find-retailers" className="hover:text-[#D4AF37] transition-colors">Find Retailers</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f]">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-[#D4AF37] text-sm font-medium tracking-widest uppercase mb-4">
              About Centsibl Traders
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-white font-serif mb-6">
              Building a Better Tomorrow Through Ethical Trade
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Centsibl Traders Private Limited is a purpose-driven Indian enterprise, 
              committed to ethical trade, inclusive growth, and responsible entrepreneurship.
            </p>
          </div>
        </section>

        {/* Mission Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-6">
                  Our Mission
                </h2>
                <p className="text-gray-600 mb-4 leading-relaxed">
                  At Centsibl Traders, we believe that business can be a force for good. 
                  Our mission is to create premium products that honor traditional craftsmanship 
                  while providing fair opportunities for artisans across India.
                </p>
                <p className="text-gray-600 leading-relaxed">
                  Through Addrika, our flagship incense brand, we bring the sacred art of 
                  fragrance to modern homes while supporting sustainable practices and 
                  empowering local communities.
                </p>
              </div>
              <div className="bg-[#F5F0E8] rounded-2xl p-8">
                <div className="text-center">
                  <p className="text-5xl font-bold text-[#D4AF37] mb-2">2022</p>
                  <p className="text-gray-600">Founded</p>
                </div>
                <div className="grid grid-cols-2 gap-6 mt-8">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[#2B3A4A]">4</p>
                    <p className="text-sm text-gray-600">Signature Fragrances</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-[#2B3A4A]">100%</p>
                    <p className="text-sm text-gray-600">Natural Ingredients</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values Section */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
                Our Core Values
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                These principles guide everything we do at Centsibl Traders.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((value, index) => (
                <div 
                  key={index}
                  className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-12 h-12 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-[#D4AF37]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#2B3A4A] mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {value.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif mb-4">
              Experience the Addrika Difference
            </h2>
            <p className="text-gray-600 mb-8">
              Discover our collection of premium natural incense, crafted with care and tradition.
            </p>
            <Link
              href="/#fragrances"
              className="inline-flex items-center gap-2 bg-[#2B3A4A] text-white px-8 py-4 rounded-full font-semibold hover:bg-[#1a252f] transition-colors"
            >
              Shop Our Collection
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#2B3A4A] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
