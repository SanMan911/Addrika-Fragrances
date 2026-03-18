import Link from 'next/link';
import { Heart, Leaf, Users } from 'lucide-react';

export const metadata = {
  title: 'Our Story | Addrika - The Journey Behind Premium Incense',
  description: 'Discover the story behind Addrika - born from a belief that everyday rituals deserve care and intention. Learn about our journey into mindful creation and ethical fragrance crafting.',
  keywords: ['addrika story', 'incense brand story', 'premium agarbatti brand', 'ethical incense', 'mindful fragrance', 'centsibl traders story'],
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
      description: 'Centsibl Traders was founded with a vision to create premium, ethical products.'
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
            <Link href="/our-story" className="text-[#D4AF37]">Our Story</Link>
            <Link href="/about-us" className="hover:text-[#D4AF37] transition-colors">About Us</Link>
            <Link href="/find-retailers" className="hover:text-[#D4AF37] transition-colors">Find Retailers</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero Section */}
        <section className="relative py-20 bg-gradient-to-br from-[#F5F0E8] to-white">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <p className="text-[#D4AF37] text-sm font-medium tracking-widest uppercase mb-4">
              Our Story
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold text-[#2B3A4A] font-serif mb-6">
              Where Tradition Meets Intention
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Addrika was born from a simple belief: that the everyday rituals that ground us 
              deserve the same care and intention as life&apos;s grandest moments.
            </p>
          </div>
        </section>

        {/* Story Content */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="prose prose-lg">
              <p className="text-gray-600 leading-relaxed mb-6">
                In the quiet moments of our day — the early morning meditation, the evening wind-down, 
                the pause between tasks — we found ourselves searching for something more meaningful 
                than mass-produced fragrances that promised everything but delivered little.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                We discovered that the art of incense-making, practiced for millennia across cultures, 
                had been diluted by modern shortcuts. Synthetic fragrances replaced natural essences. 
                Quick profits overshadowed careful craftsmanship. The sacred had become ordinary.
              </p>
              <p className="text-gray-600 leading-relaxed mb-6">
                <strong className="text-[#2B3A4A]">So we decided to go back to the source.</strong>
              </p>
              <p className="text-gray-600 leading-relaxed">
                Working with master artisans who have preserved traditional techniques for generations, 
                we developed four signature fragrances. Each blend tells a story — of saffron fields in 
                Kashmir, rose gardens in the morning dew, ancient agarwood forests, and the mystical 
                bakhoor traditions of Arabia.
              </p>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="py-16 px-4 bg-[#F5F0E8]">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-12">
              What Drives Us
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2B3A4A] mb-2">Mindful Creation</h3>
                <p className="text-gray-600">
                  Every stick is crafted with intention, honoring both the ingredients and the artisans.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4">
                  <Leaf className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2B3A4A] mb-2">Natural Purity</h3>
                <p className="text-gray-600">
                  100% natural ingredients sourced responsibly from trusted suppliers across India.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-[#D4AF37]" />
                </div>
                <h3 className="text-xl font-semibold text-[#2B3A4A] mb-2">Community First</h3>
                <p className="text-gray-600">
                  Supporting artisan communities and ensuring fair compensation for their craft.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="py-16 px-4 bg-white">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-[#2B3A4A] font-serif text-center mb-12">
              Our Journey
            </h2>
            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div key={index} className="flex gap-6">
                  <div className="flex-shrink-0 w-20">
                    <span className="text-2xl font-bold text-[#D4AF37]">{milestone.year}</span>
                  </div>
                  <div className="flex-1 pb-8 border-l-2 border-[#D4AF37]/30 pl-6">
                    <h3 className="text-lg font-semibold text-[#2B3A4A] mb-1">{milestone.title}</h3>
                    <p className="text-gray-600">{milestone.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 px-4 bg-[#2B3A4A]">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white font-serif mb-4">
              Be Part of Our Story
            </h2>
            <p className="text-gray-300 mb-8">
              Experience the Addrika difference and join us in celebrating mindful moments.
            </p>
            <Link
              href="/#fragrances"
              className="inline-flex items-center gap-2 bg-[#D4AF37] text-[#2B3A4A] px-8 py-4 rounded-full font-semibold hover:bg-[#c9a432] transition-colors"
            >
              Explore Our Fragrances
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#1a252f] text-white py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[#D4AF37] font-bold text-xl mb-2">Addrika</p>
          <p className="text-sm text-gray-400">© 2026 Centsibl Traders Private Limited. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}
