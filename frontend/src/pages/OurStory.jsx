import React from 'react';
import { Heart, Leaf, Users } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const OurStory = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0e8]">
      <SEO 
        title="Our Story | Addrika - The Journey Behind Premium Incense"
        description="Discover the story behind Addrika - born from a belief that everyday rituals deserve care and intention. Learn about our journey into mindful creation and ethical fragrance crafting."
        url="https://centraders.com/our-story"
        keywords="addrika story, incense brand story, premium agarbatti brand, ethical incense, mindful fragrance, centsibl traders story"
      />
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 font-serif"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            Our Story
          </h1>
          <div 
            className="w-24 h-1 mx-auto mb-8"
            style={{ backgroundColor: 'var(--metallic-gold)' }}
          />
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Story Content */}
          <div className="bg-white rounded-2xl shadow-lg p-8 sm:p-12 mb-12">
            <div className="prose prose-lg max-w-none">
              <p 
                className="text-lg sm:text-xl leading-relaxed mb-8"
                style={{ color: 'var(--text-dark)' }}
              >
                Addrika was born from a quiet belief—that everyday rituals deserve care, intention, and dignity. What began as a simple exploration of fragrance soon became a deeper journey into mindful creation, ethical choices, and responsible growth.
              </p>
              
              <p 
                className="text-lg sm:text-xl leading-relaxed mb-8"
                style={{ color: 'var(--text-dark)' }}
              >
                Rooted in Indian sensibilities and shaped by lived experience, we set out to build something honest—where quality is never rushed, people are never invisible, and purpose is never an afterthought. Each step of our journey reflects a commitment to doing business thoughtfully, with respect for tradition, livelihoods, and the environments we touch.
              </p>
              
              <p 
                className="text-lg sm:text-xl leading-relaxed"
                style={{ color: 'var(--text-dark)' }}
              >
                Addrika is not just about fragrance. It is about creating moments of calm, connection, and meaning—crafted slowly, grown responsibly, and guided by values.
              </p>
            </div>
          </div>

          {/* Values Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div 
              className="bg-white rounded-xl p-6 shadow-md text-center"
              style={{ borderTop: '4px solid var(--metallic-gold)' }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)' }}
              >
                <Heart size={28} style={{ color: 'var(--metallic-gold)' }} />
              </div>
              <h3 
                className="text-xl font-bold mb-2 font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                Mindful Creation
              </h3>
              <p style={{ color: 'var(--text-subtle)' }}>
                Every product crafted with intention, care, and respect for tradition.
              </p>
            </div>

            <div 
              className="bg-white rounded-xl p-6 shadow-md text-center"
              style={{ borderTop: '4px solid var(--japanese-indigo)' }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(30, 58, 82, 0.1)' }}
              >
                <Users size={28} style={{ color: 'var(--japanese-indigo)' }} />
              </div>
              <h3 
                className="text-xl font-bold mb-2 font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                People First
              </h3>
              <p style={{ color: 'var(--text-subtle)' }}>
                Building relationships where people are never invisible and livelihoods matter.
              </p>
            </div>

            <div 
              className="bg-white rounded-xl p-6 shadow-md text-center"
              style={{ borderTop: '4px solid var(--metallic-gold)' }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)' }}
              >
                <Leaf size={28} style={{ color: 'var(--metallic-gold)' }} />
              </div>
              <h3 
                className="text-xl font-bold mb-2 font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                Responsible Growth
              </h3>
              <p style={{ color: 'var(--text-subtle)' }}>
                Growing thoughtfully with respect for the environments we touch.
              </p>
            </div>
          </div>

          {/* Tagline */}
          <div className="mt-12 text-center">
            <p 
              className="text-2xl sm:text-3xl font-serif italic"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              "Crafted slowly, grown responsibly, guided by values."
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default OurStory;
