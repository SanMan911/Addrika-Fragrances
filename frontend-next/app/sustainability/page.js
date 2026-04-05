'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Leaf, TreePine, Users, GraduationCap, Recycle, Target, Package, TrendingUp, Heart, ChevronRight, Check, Plus } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

// Animated Counter Component
function AnimatedCounter({ target, suffix = '', prefix = '', duration = 2000 }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isVisible) {
          setIsVisible(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      
      // Easing function for smooth animation
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.floor(easeOut * target));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [isVisible, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{count.toLocaleString()}{suffix}
    </span>
  );
}

// Impact metrics data
const impactMetrics = [
  {
    icon: TreePine,
    value: 50,
    suffix: '+',
    label: 'Trees Planted',
    description: '1 tree for every 25 orders',
    color: '#10B981'
  },
  {
    icon: Users,
    value: 7,
    suffix: '',
    label: 'Artisan Families Supported',
    description: 'Fair wages & sustainable livelihoods',
    color: '#3B82F6'
  },
  {
    icon: GraduationCap,
    value: 12,
    suffix: '',
    label: 'Student Years Funded',
    description: 'Education for underprivileged children',
    color: '#8B5CF6'
  },
  {
    icon: Leaf,
    value: 60,
    suffix: '%+',
    label: 'Less Smoke',
    description: 'Charcoal-free formula',
    color: '#059669'
  }
];

// Roadmap goals
const roadmapGoals = [
  {
    year: '2025',
    title: 'Current Progress',
    goals: [
      { text: '50+ trees planted', completed: true },
      { text: '7 artisan families supported', completed: true },
      { text: 'Charcoal-free formula across all products', completed: true },
      { text: 'PET bottle & paper packaging', completed: true }
    ],
    status: 'current'
  },
  {
    year: '2026',
    title: 'Near-Term Goals',
    goals: [
      { text: '100 trees planted', completed: false },
      { text: '15+ artisan families supported', completed: false },
      { text: '25 student years funded', completed: false },
      { text: 'Expand ethical sourcing partnerships', completed: false }
    ],
    status: 'upcoming'
  },
  {
    year: '2027',
    title: 'Long-Term Vision',
    goals: [
      { text: 'Carbon-neutral operations', completed: false },
      { text: '100% recyclable packaging', completed: false },
      { text: 'B-Corp certification journey', completed: false },
      { text: 'Community wellness programs', completed: false }
    ],
    status: 'future'
  }
];

export default function SustainabilityPage() {
  const [showTreeDonation, setShowTreeDonation] = useState(false);
  const [treeDonationAdded, setTreeDonationAdded] = useState(false);

  const handleAddTreeDonation = () => {
    // This would integrate with cart functionality
    setTreeDonationAdded(true);
    setTimeout(() => setShowTreeDonation(false), 1500);
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="px-4 mb-16">
          <div className="max-w-6xl mx-auto text-center">
            <div 
              className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.15)' }}
            >
              <Leaf className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 
              className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Sustainability at the Heart of <span className="text-[#D4AF37]">Every Fragrance</span>
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
              At Addrika, we believe that beautiful fragrances shouldn't come at the cost of our planet 
              or the people who create them. Every decision we make is guided by our commitment to 
              ethical sourcing, environmental responsibility, and community well-being.
            </p>
          </div>
        </section>

        {/* Impact Dashboard */}
        <section className="px-4 mb-20">
          <div className="max-w-6xl mx-auto">
            <h2 
              className="text-3xl font-bold text-white text-center mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Our Impact So Far
            </h2>
            <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
              Real numbers, real change. Every purchase contributes to these milestones.
            </p>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {impactMetrics.map((metric, index) => (
                <div 
                  key={index}
                  className="p-6 rounded-2xl text-center relative overflow-hidden"
                  style={{ 
                    background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div 
                    className="absolute top-0 right-0 w-24 h-24 opacity-10"
                    style={{ 
                      background: `radial-gradient(circle, ${metric.color} 0%, transparent 70%)`
                    }}
                  />
                  <div 
                    className="w-12 h-12 mx-auto mb-4 rounded-xl flex items-center justify-center"
                    style={{ background: `${metric.color}20` }}
                  >
                    <metric.icon size={24} style={{ color: metric.color }} />
                  </div>
                  <div 
                    className="text-3xl lg:text-4xl font-bold mb-2"
                    style={{ color: metric.color }}
                  >
                    <AnimatedCounter target={metric.value} suffix={metric.suffix} />
                  </div>
                  <h3 className="text-white font-semibold mb-1">{metric.label}</h3>
                  <p className="text-gray-400 text-sm">{metric.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Environmental Commitment */}
        <section className="px-4 mb-20">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-8">
              {/* Low Carbon Footprint */}
              <div 
                className="p-8 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                  border: '1px solid rgba(16,185,129,0.3)'
                }}
              >
                <div 
                  className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.15)' }}
                >
                  <TrendingUp size={28} className="text-emerald-500" />
                </div>
                <h3 
                  className="text-2xl font-bold text-white mb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Low Carbon Footprint
                </h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  Our charcoal-free formula produces <span className="text-emerald-400 font-semibold">over 60% less smoke</span> and 
                  significantly fewer carbon emissions than traditional incense. By eliminating charcoal 
                  from our products, we've created a cleaner-burning alternative that's better for both 
                  your home and the environment.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3 text-gray-300">
                    <Check size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>60%+ less smoke emissions</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-300">
                    <Check size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>No charcoal burning residue</span>
                  </li>
                  <li className="flex items-start gap-3 text-gray-300">
                    <Check size={20} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>Cleaner indoor air quality</span>
                  </li>
                </ul>
              </div>

              {/* Sustainable Packaging */}
              <div 
                className="p-8 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                  border: '1px solid rgba(59,130,246,0.3)'
                }}
              >
                <div 
                  className="w-14 h-14 mb-6 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.15)' }}
                >
                  <Package size={28} className="text-blue-500" />
                </div>
                <h3 
                  className="text-2xl font-bold text-white mb-4"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  Thoughtful Packaging
                </h3>
                <p className="text-gray-300 mb-6 leading-relaxed">
                  We've designed our packaging with sustainability in mind, using materials that 
                  can be reused or recycled, reducing waste in your home.
                </p>
                <div className="space-y-4">
                  <div 
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(59,130,246,0.1)' }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Recycle size={20} className="text-blue-400" />
                      <h4 className="text-white font-semibold">PET Bottles</h4>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Reusable for storage, organization, or creative DIY projects at home
                    </p>
                  </div>
                  <div 
                    className="p-4 rounded-xl"
                    style={{ background: 'rgba(59,130,246,0.1)' }}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Recycle size={20} className="text-blue-400" />
                      <h4 className="text-white font-semibold">Paper Packets</h4>
                    </div>
                    <p className="text-gray-400 text-sm">
                      100% recyclable paper packaging for eco-conscious disposal
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Community Impact */}
        <section className="px-4 mb-20">
          <div className="max-w-6xl mx-auto">
            <h2 
              className="text-3xl font-bold text-white text-center mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Community Impact
            </h2>
            <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
              Behind every Addrika product are real people whose lives are improved through fair trade and ethical practices.
            </p>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* Artisan Support */}
              <div 
                className="p-6 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div 
                  className="w-12 h-12 mb-4 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.15)' }}
                >
                  <Users size={24} className="text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Artisan Livelihoods</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We work directly with 7 artisan families, providing fair wages that are above 
                  market rates. Our partnerships ensure stable income and preserve traditional 
                  incense-making skills passed down through generations.
                </p>
              </div>

              {/* Education */}
              <div 
                className="p-6 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div 
                  className="w-12 h-12 mb-4 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(139,92,246,0.15)' }}
                >
                  <GraduationCap size={24} className="text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Education Initiative</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  A portion of every sale funds education for children in underprivileged 
                  communities. So far, we've funded 12 student years of education, giving 
                  young minds the opportunity to build brighter futures.
                </p>
              </div>

              {/* Tree Planting */}
              <div 
                className="p-6 rounded-2xl"
                style={{ 
                  background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <div 
                  className="w-12 h-12 mb-4 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(16,185,129,0.15)' }}
                >
                  <TreePine size={24} className="text-emerald-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">Tree Planting Program</h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  For every 25 orders, we plant a tree in partnership with reforestation 
                  initiatives across India. With 50+ trees already planted, we're contributing 
                  to cleaner air and healthier ecosystems.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Your Impact Section */}
        <section className="px-4 mb-20">
          <div className="max-w-4xl mx-auto">
            <div 
              className="p-8 lg:p-12 rounded-2xl text-center"
              style={{ 
                background: 'linear-gradient(135deg, rgba(212,175,55,0.15) 0%, rgba(16,185,129,0.15) 100%)',
                border: '1px solid rgba(212,175,55,0.3)'
              }}
            >
              <Heart className="w-12 h-12 text-[#D4AF37] mx-auto mb-6" />
              <h2 
                className="text-3xl font-bold text-white mb-4"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                Your Impact
              </h2>
              <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
                Every Addrika purchase contributes to our sustainability initiatives. 
                Here's what your support helps achieve:
              </p>
              
              <div className="grid sm:grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#D4AF37] mb-1">1 order</div>
                  <p className="text-gray-400 text-sm">Supports artisan wages</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-400 mb-1">25 orders</div>
                  <p className="text-gray-400 text-sm">= 1 tree planted</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-400 mb-1">50 orders</div>
                  <p className="text-gray-400 text-sm">= 1 month of education</p>
                </div>
              </div>

              {/* Tree Donation Option */}
              <div 
                className="p-6 rounded-xl max-w-md mx-auto"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}
              >
                <div className="flex items-center justify-center gap-3 mb-3">
                  <TreePine className="text-emerald-500" size={24} />
                  <h3 className="text-white font-semibold">Plant an Extra Tree</h3>
                </div>
                <p className="text-gray-400 text-sm mb-4">
                  Add ₹10 to your order at checkout to plant an additional tree directly
                </p>
                <button
                  onClick={() => setShowTreeDonation(true)}
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  data-testid="add-tree-donation-btn"
                >
                  <Plus size={18} />
                  Add ₹10 Tree Donation
                </button>
                <p className="text-gray-500 text-xs mt-3">
                  Optional donation added at checkout
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Roadmap */}
        <section className="px-4 mb-20">
          <div className="max-w-4xl mx-auto">
            <h2 
              className="text-3xl font-bold text-white text-center mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Our Sustainability Roadmap
            </h2>
            <p className="text-gray-400 text-center mb-12 max-w-2xl mx-auto">
              Transparent goals and milestones on our journey to becoming a more sustainable brand.
            </p>
            
            <div className="space-y-6">
              {roadmapGoals.map((phase, index) => (
                <div 
                  key={index}
                  className="p-6 rounded-2xl"
                  style={{ 
                    background: phase.status === 'current' 
                      ? 'linear-gradient(165deg, rgba(16,185,129,0.15) 0%, rgba(22,33,62,0.9) 100%)'
                      : 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                    border: phase.status === 'current' 
                      ? '1px solid rgba(16,185,129,0.4)'
                      : '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div 
                      className="px-4 py-2 rounded-full font-bold text-sm"
                      style={{ 
                        background: phase.status === 'current' ? 'rgba(16,185,129,0.2)' : 'rgba(212,175,55,0.2)',
                        color: phase.status === 'current' ? '#10B981' : '#D4AF37'
                      }}
                    >
                      {phase.year}
                    </div>
                    <h3 className="text-xl font-bold text-white">{phase.title}</h3>
                    {phase.status === 'current' && (
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full">
                        In Progress
                      </span>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {phase.goals.map((goal, goalIndex) => (
                      <div 
                        key={goalIndex}
                        className="flex items-center gap-3 p-3 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                      >
                        {goal.completed ? (
                          <Check size={18} className="text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Target size={18} className="text-gray-500 flex-shrink-0" />
                        )}
                        <span className={goal.completed ? 'text-gray-300' : 'text-gray-500'}>
                          {goal.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Join Us on This Journey
            </h2>
            <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
              Every Addrika product you choose is a vote for a more sustainable, ethical future. 
              Together, we can make a difference—one fragrance at a time.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/#fragrances"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all"
                style={{ 
                  background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                  color: '#1a1a2e'
                }}
              >
                Shop Sustainably
                <ChevronRight size={18} />
              </Link>
              <Link
                href="/our-story"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-semibold transition-all"
                style={{ 
                  border: '1px solid rgba(255,255,255,0.3)',
                  color: 'white'
                }}
              >
                Our Story
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />

      {/* Tree Donation Modal */}
      {showTreeDonation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div 
            className="max-w-md w-full p-8 rounded-2xl text-center"
            style={{ 
              background: 'linear-gradient(165deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid rgba(16,185,129,0.4)'
            }}
          >
            {!treeDonationAdded ? (
              <>
                <TreePine className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Plant an Extra Tree</h3>
                <p className="text-gray-400 mb-6">
                  Add ₹10 to your next order to plant an additional tree. This donation will be 
                  added to your cart at checkout.
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setShowTreeDonation(false)}
                    className="px-6 py-3 rounded-lg font-semibold border border-gray-600 text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Maybe Later
                  </button>
                  <button
                    onClick={handleAddTreeDonation}
                    className="px-6 py-3 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                    data-testid="confirm-tree-donation-btn"
                  >
                    Add ₹10 Donation
                  </button>
                </div>
              </>
            ) : (
              <>
                <Check className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Thank You!</h3>
                <p className="text-gray-400">
                  Tree donation will be added to your next checkout.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
