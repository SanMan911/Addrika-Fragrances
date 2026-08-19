'use client';

import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { Instagram, ExternalLink } from 'lucide-react';
import BRAND from '../lib/brand.config';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

// Cosmetic engagement counts — layered onto whatever the top 6 catalog
// SKUs happen to be at page-load time. Keeping these constants lets the
// tiles never look empty while the product roster rotates.
const ENGAGEMENT = [
  { likes: 234, comments: 18 },
  { likes: 189, comments: 12 },
  { likes: 312, comments: 24 },
  { likes: 276, comments: 21 },
  { likes: 198, comments: 15 },
  { likes: 245, comments: 19 },
];

export default function InstagramFeed() {
  const { isDarkMode } = useTheme();
  const [posts, setPosts] = useState([]);

  // Pull the six most recent catalog images so the Instagram grid never
  // 404s the way it did when this list was hard-coded to filenames that
  // never shipped to /public/images/products. If the fetch fails we
  // simply render nothing rather than broken tiles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/products`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !Array.isArray(data)) return;
        const withImages = data
          .filter((p) => p && p.image && p.isActive !== false)
          .slice(0, 6)
          .map((p, i) => ({
            id: p.id,
            image: p.image,
            name: p.name,
            likes: ENGAGEMENT[i]?.likes ?? 200,
            comments: ENGAGEMENT[i]?.comments ?? 15,
          }));
        setPosts(withImages);
      } catch {
        // Silent — grid stays hidden if the API is unreachable
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
              {BRAND.social.instagramHandleUpper}
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
        {posts.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4" data-testid="instagram-grid">
            {posts.map((post) => (
              <a
                key={post.id}
                href={BRAND.social.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square rounded-xl overflow-hidden"
                style={{ 
                  background: isDarkMode 
                    ? 'linear-gradient(165deg, #1a1a2e 0%, #16213e 100%)'
                    : '#f5f0e8'
                }}
                data-testid={`instagram-tile-${post.id}`}
              >
                <img 
                  src={post.image}
                  alt={post.name || `${BRAND.name} Instagram`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
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
        )}

        {/* Follow Button */}
        <div className="text-center mt-10">
          <a
            href={BRAND.social.instagramUrl}
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
            Follow {BRAND.social.instagramHandle}
          </a>
        </div>
      </div>
    </section>
  );
}
