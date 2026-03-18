import React from 'react';
import { Heart, Target, Leaf, Award, Users, TrendingUp } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';

const AboutUs = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#faf8f5] to-[#f5f0e8] dark:from-slate-900 dark:to-slate-800">
      <SEO 
        title="About Us | Centsibl Traders - Addrika Premium Incense Manufacturer"
        description="Centsibl Traders Private Limited - A purpose-driven Indian enterprise creating Addrika premium incense. Built on ethical trade, inclusive growth, and responsible entrepreneurship."
        url="https://centraders.com/about-us"
        keywords="centsibl traders, addrika manufacturer, incense company india, ethical incense brand, premium agarbatti company"
      />
      <Header />
      
      {/* Hero Section */}
      <section className="pt-32 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 
            className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6 font-serif"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            About Us
          </h1>
          <div 
            className="w-24 h-1 mx-auto mb-6"
            style={{ backgroundColor: 'var(--metallic-gold)' }}
          />
          <p 
            className="text-xl sm:text-2xl font-medium"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            Centsibl Traders Private Limited
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Introduction */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 sm:p-12 mb-8">
            <p 
              className="text-lg sm:text-xl leading-relaxed mb-6 dark:text-gray-300"
              style={{ color: 'var(--text-dark)' }}
            >
              Centsibl Traders Private Limited is a purpose-driven Indian enterprise built on ethical trade, inclusive growth, and responsible entrepreneurship. We believe that businesses can grow sustainably while remaining deeply respectful of people, communities, and the environment they operate within.
            </p>
            
            <p 
              className="text-lg sm:text-xl leading-relaxed dark:text-gray-300"
              style={{ color: 'var(--text-dark)' }}
            >
              Our journey began with a simple yet powerful idea: to create value beyond transactions. From sourcing to production and partnerships, we consciously choose practices that support grassroots livelihoods, encourage fair work, and prioritise long-term impact over short-term gains.
            </p>
          </div>

          {/* Our Philosophy Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 sm:p-12 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)' }}
              >
                <Heart size={28} style={{ color: 'var(--metallic-gold)' }} />
              </div>
              <h2 
                className="text-2xl sm:text-3xl font-bold font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                Our Philosophy
              </h2>
            </div>
            
            <p 
              className="text-lg sm:text-xl leading-relaxed dark:text-gray-300"
              style={{ color: 'var(--text-dark)' }}
            >
              We view responsibility not as a separate initiative, but as the foundation of how we operate. Every decision is guided by care—for the individuals involved in our value chain, for the traditions we draw inspiration from, and for the future we are collectively shaping.
            </p>
          </div>

          {/* Addrika Section */}
          <div 
            className="rounded-2xl shadow-lg p-8 sm:p-12 mb-8"
            style={{ 
              background: 'linear-gradient(135deg, var(--japanese-indigo) 0%, #2a3b49 100%)'
            }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'var(--metallic-gold)' }}
              >
                <Award size={28} style={{ color: 'var(--japanese-indigo)' }} />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold font-serif text-white">
                Addrika — Our Fragrance-Led Expression
              </h2>
            </div>
            
            <p 
              className="text-lg sm:text-xl leading-relaxed"
              style={{ color: 'var(--text-light)' }}
            >
              Addrika is our homegrown brand that reflects this philosophy through thoughtfully crafted fragrance essentials. Rooted in Indian sensibilities and mindful living, Addrika represents elegance, authenticity, and intention. While our offerings may evolve over time, our commitment to quality, ethics, and dignity remains constant.
            </p>
          </div>

          {/* Growing with Purpose Section */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-8 sm:p-12 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: 'rgba(30, 58, 82, 0.1)' }}
              >
                <TrendingUp size={28} style={{ color: 'var(--japanese-indigo)' }} />
              </div>
              <h2 
                className="text-2xl sm:text-3xl font-bold font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                Growing with Purpose
              </h2>
            </div>
            
            <p 
              className="text-lg sm:text-xl leading-relaxed dark:text-gray-300"
              style={{ color: 'var(--text-dark)' }}
            >
              As we expand our portfolio and reach, our focus stays clear: to build a trusted enterprise where growth is measured not just by scale or revenue, but by trust earned, opportunities created, and responsibility upheld.
            </p>
          </div>

          {/* Core Values */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div 
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md text-center"
              style={{ borderTop: '4px solid var(--metallic-gold)' }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(212, 175, 55, 0.15)' }}
              >
                <Users size={28} style={{ color: 'var(--metallic-gold)' }} />
              </div>
              <h3 
                className="text-xl font-bold mb-2 font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                People Before Profit
              </h3>
              <p className="dark:text-gray-400" style={{ color: 'var(--text-subtle)' }}>
                Supporting grassroots livelihoods and fair work practices.
              </p>
            </div>

            <div 
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md text-center"
              style={{ borderTop: '4px solid var(--japanese-indigo)' }}
            >
              <div 
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(30, 58, 82, 0.1)' }}
              >
                <Target size={28} style={{ color: 'var(--japanese-indigo)' }} />
              </div>
              <h3 
                className="text-xl font-bold mb-2 font-serif"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                Impact Before Scale
              </h3>
              <p className="dark:text-gray-400" style={{ color: 'var(--text-subtle)' }}>
                Prioritising long-term impact over short-term gains.
              </p>
            </div>

            <div 
              className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-md text-center"
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
                Ethical Trade
              </h3>
              <p className="dark:text-gray-400" style={{ color: 'var(--text-subtle)' }}>
                Respecting communities and environment in every decision.
              </p>
            </div>
          </div>

          {/* Closing Statement */}
          <div className="text-center">
            <div 
              className="inline-block px-8 py-6 rounded-2xl"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.1)' }}
            >
              <p 
                className="text-xl sm:text-2xl font-serif italic"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                "Centsibl Traders Private Limited stands for people before profit, and impact before scale—always."
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default AboutUs;
