'use client';

import { useTheme } from '../context/ThemeContext';
import { Instagram, ExternalLink } from 'lucide-react';

// Sample Instagram posts - in production, these would come from Instagram API
const instagramPosts = [
  { id: 1, image: '/images/products/kesar-chandan/kc_box_and_10_stick_1200px.png', likes: 234, comments: 18 },
  { id: 2, image: '/images/products/regal-rose/rr_box_and_10_stick_1200px.png', likes: 189, comments: 12 },
  { id: 3, image: '/images/products/oriental-oudh/oo_box_and_10_stick_1200px.png', likes: 312, comments: 24 },
  { id: 4, image: '/images/products/bold-bakhoor/bb_box_and_10_stick_1200px.png', likes: 276, comments: 21 },
  { id: 5, image: '/images/products/kesar-chandan/kc_jar_1_1200px.png', likes: 198, comments: 15 },
  { id: 6, image: '/images/products/regal-rose/rr_jar_1_1200px.png', likes: 245, comments: 19 }
];

export default function InstagramFeed() {
  const { isDarkMode } = useTheme();

  return (
    <section 
      className="py-20 sm:py-28 relative overflow-hidden"
      style={{ 
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' 
          : 'linear-gradient(180deg, #ffffff 0%, #faf7f2 100%)'
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Instagram size={32} style={{ color: '#E4405F' }} />
            <span 
              className="text-sm font-medium tracking-wider"
              style={{ color: isDarkMode ? 'rgba(255,255,255,0.7)' : 'var(--text-subtle)' }}
            >
              @ADDRIKA.FRAGRANCES
            </span>
          </div>
          <h2 
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4"
            style={{ 
              fontFamily: "'Playfair Display', serif",
              color: isDarkMode ? '#ffffff' : 'var(--japanese-indigo)'
            }}
          >
            Follow Our Journey
          </h2>
          <p 
            className="text-lg max-w-2xl mx-auto"
            style={{ color: isDarkMode ? 'rgba(255,255,255,0.6)' : 'var(--text-subtle)' }}
          >
            Join our community and discover the art of mindful living
          </p>
        </div>

        {/* Instagram Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {instagramPosts.map((post) => (
            <a
              key={post.id}
              href="https://instagram.com/addrika.fragrances"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square rounded-xl overflow-hidden"
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(165deg, #1a1a2e 0%, #16213e 100%)'
                  : '#f5f0e8'
              }}
            >
              <img 
                src={post.image}
                alt="Addrika Instagram"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              
              {/* Hover Overlay */}
              <div 
                className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300"
                style={{ background: 'rgba(0,0,0,0.6)' }}
              >
                <div className="text-white text-center">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="flex items-center gap-1">
                      ❤️ {post.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      💬 {post.comments}
                    </span>
                  </div>
                  <ExternalLink size={20} className="mx-auto" />
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* Follow Button */}
        <div className="text-center mt-10">
          <a
            href="https://instagram.com/addrika.fragrances"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all hover:-translate-y-1"
            style={{ 
              background: 'linear-gradient(135deg, #833AB4 0%, #E4405F 50%, #FCAF45 100%)',
              color: 'white',
              boxShadow: '0 10px 30px rgba(228, 64, 95, 0.3)'
            }}
          >
            <Instagram size={20} />
            Follow @addrika.fragrances
          </a>
        </div>
      </div>
    </section>
  );
}
