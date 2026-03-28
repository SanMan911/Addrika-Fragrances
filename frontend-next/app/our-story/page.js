import Link from 'next/link';
import { Heart, Leaf, Users, ArrowLeft } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

export const metadata = {
  title: 'Our Story | Addrika - The Journey Behind Premium Incense',
  description: 'Discover the story behind Addrika - born from a belief that everyday rituals deserve care and intention. Learn about our journey into mindful creation and ethical fragrance crafting.',
  keywords: ['addrika story', 'incense brand story', 'premium agarbatti brand', 'ethical incense', 'mindful fragrance', 'centsible traders story'],
  openGraph: {
    title: 'Our Story | Addrika',
    description: 'Born from a belief that everyday rituals deserve care and intention.',
    url: 'https://centraders.com/our-story',
  },
};

export default function OurStoryPage() {
  const milestones = [
    {
      year: '2022',
      title: 'The Beginning',
      description: 'Centsible Traders was founded with a vision to create premium, ethical products.'
    },
    {
      year: '2023',
      title: 'Addrika is Born',
      description: 'Our flagship incense brand launched with four signature fragrances.'
    },
    {
      year: '2024',
      title: 'Growing Together',
      description: 'Expanded our artisan network and reached customers across India.'
    },
    {
      year: '2025',
      title: 'Digital Presence',
      description: 'Launched our e-commerce platform to bring Addrika to more homes.'
    }
  ];

  const values = [
    {
      icon: Heart,
      title: 'Mindful Creation',
      description: 'Every product is crafted with intention, care, and respect for tradition.'
    },
    {
      icon: Leaf,
      title: 'Natural Ingredients',
      description: 'We use only pure, natural ingredients - no synthetic fragrances or harmful chemicals.'
    },
    {
      icon: Users,
      title: 'Community Focus',
      description: 'Supporting artisan communities and traditional craftsmanship across India.'
    }
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />
      
      <main className="pt-24">
        {/* Hero Section */}
        <section className="relative py-20">
          <div 
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ 
              background: 'radial-gradient(ellipse at center top, rgba(212,175,55,0.1) 0%, transparent 50%)'
            }}
          />
          <div className="max-w-4xl mx-auto px-4 text-center relative">
            <span 
              className="inline-block px-5 py-2 rounded-full text-sm font-medium tracking-wider mb-6"
              style={{ 
                background: 'rgba(212,175,55,0.1)', 
                color: '#D4AF37',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              OUR JOURNEY
            </span>
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 text-white"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Our Story
            </h1>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Born from a belief that everyday rituals deserve care and intention. 
              This is our journey into mindful creation.
            </p>
          </div>
        </section>

        {/* Story Content */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4">
            <div 
              className="p-8 sm:p-12 rounded-2xl mb-16"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <h2 
                className="text-2xl sm:text-3xl font-bold mb-6 text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                The Beginning
              </h2>
              <div className="space-y-4 text-gray-300 leading-relaxed">
                <p>
                  Addrika was born from a simple observation: in our rush through daily life, 
                  we often overlook the small rituals that ground us. The morning prayer, 
                  the evening meditation, the quiet moments of reflection.
                </p>
                <p>
                  We asked ourselves: what if these moments could be elevated? What if the 
                  incense we light could be as thoughtfully crafted as the intentions behind them?
                </p>
                <p>
                  This question led us on a journey across India, meeting master artisans who 
                  have perfected their craft over generations. We learned about traditional 
                  methods, natural ingredients, and the art of creating fragrances that touch the soul.
                </p>
              </div>
            </div>

            {/* Values */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
              {values.map((value, index) => {
                const Icon = value.icon;
                return (
                  <div 
                    key={index}
                    className="p-6 rounded-xl text-center"
                    style={{ 
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <div 
                      className="w-14 h-14 mx-auto mb-4 rounded-xl flex items-center justify-center"
                      style={{ background: 'rgba(212,175,55,0.15)' }}
                    >
                      <Icon size={28} className="text-[#D4AF37]" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{value.title}</h3>
                    <p className="text-sm text-gray-400">{value.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Timeline */}
            <div className="mb-16">
              <h2 
                className="text-2xl sm:text-3xl font-bold mb-8 text-center text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Our Journey
              </h2>
              <div className="relative">
                <div 
                  className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5"
                  style={{ background: 'rgba(212,175,55,0.3)' }}
                />
                {milestones.map((milestone, index) => (
                  <div 
                    key={index}
                    className={`relative flex items-center mb-8 ${
                      index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                    }`}
                  >
                    <div className="hidden md:block w-1/2" />
                    <div 
                      className="absolute left-4 md:left-1/2 w-4 h-4 rounded-full transform -translate-x-1/2"
                      style={{ 
                        background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                        boxShadow: '0 0 20px rgba(212,175,55,0.5)'
                      }}
                    />
                    <div 
                      className={`ml-12 md:ml-0 md:w-1/2 p-6 rounded-xl ${
                        index % 2 === 0 ? 'md:pr-12' : 'md:pl-12'
                      }`}
                      style={{ 
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      <span className="text-[#D4AF37] font-bold text-lg">{milestone.year}</span>
                      <h3 className="text-xl font-semibold text-white mt-1">{milestone.title}</h3>
                      <p className="text-gray-400 mt-2">{milestone.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <div 
              className="text-center p-8 sm:p-12 rounded-2xl"
              style={{ 
                background: 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(42,59,73,0.2) 100%)',
                border: '1px solid rgba(212,175,55,0.2)'
              }}
            >
              <h2 
                className="text-2xl sm:text-3xl font-bold mb-4 text-white"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Experience Addrika
              </h2>
              <p className="text-gray-300 mb-6 max-w-lg mx-auto">
                Discover our collection of premium, zero-charcoal incense and bring 
                mindful moments into your daily rituals.
              </p>
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Explore Our Fragrances
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
