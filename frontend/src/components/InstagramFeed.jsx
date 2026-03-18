import React, { useState, useEffect } from 'react';
import { Instagram, Loader2, ExternalLink, Heart, MessageCircle } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Social QR Codes configuration
const socialQRCodes = {
  instagram: {
    image: '/images/instagram-qr.png',
    handle: '@addrika.fragrances',
    link: 'https://www.instagram.com/addrika.fragrances/',
    color: '#E1306C',
    enabled: true
  }
};

// Placeholder component when no posts are available
const PlaceholderPost = () => (
  <div 
    className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden flex flex-col items-center justify-center p-8 h-[320px]"
    style={{ border: '2px dashed var(--border)' }}
  >
    <Instagram size={48} className="mb-4 opacity-30" style={{ color: 'var(--japanese-indigo)' }} />
    <p className="text-center text-sm" style={{ color: 'var(--text-subtle)' }}>
      Instagram post coming soon
    </p>
  </div>
);

// Loading skeleton
const LoadingSkeleton = () => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden animate-pulse h-[320px]">
    <div className="h-64 bg-slate-200 dark:bg-slate-700" />
    <div className="p-4">
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
    </div>
  </div>
);

// Individual Instagram Post Card
const InstagramPostCard = ({ post }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Truncate caption
  const truncatedCaption = post.caption 
    ? post.caption.length > 80 
      ? post.caption.substring(0, 80) + '...' 
      : post.caption
    : '';

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white dark:bg-slate-800 rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-xl hover:scale-[1.02] block"
      data-testid={`instagram-post-${post.id}`}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden bg-slate-100 dark:bg-slate-700">
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
          </div>
        )}
        <img
          src={post.display_url || post.media_url}
          alt={truncatedCaption || 'Instagram post'}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setImageLoaded(true)}
          loading="lazy"
        />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <ExternalLink className="w-8 h-8 text-white" />
        </div>

        {/* Media Type Badge */}
        {post.media_type === 'VIDEO' && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            Video
          </div>
        )}
        {post.media_type === 'CAROUSEL_ALBUM' && (
          <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            Album
          </div>
        )}
      </div>

      {/* Caption */}
      {truncatedCaption && (
        <div className="p-3">
          <p 
            className="text-sm line-clamp-2"
            style={{ color: 'var(--text-primary)' }}
          >
            {truncatedCaption}
          </p>
        </div>
      )}
    </a>
  );
};

const InstagramFeed = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [username, setUsername] = useState('addrika.fragrances');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchInstagramFeed();
  }, []);

  const fetchInstagramFeed = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/instagram/feed?limit=9`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch Instagram feed');
      }
      
      const data = await response.json();
      
      setConfigured(data.configured);
      setPosts(data.posts || []);
      if (data.username) {
        setUsername(data.username);
      }
      setError(null);
    } catch (err) {
      console.error('Instagram feed error:', err);
      setError(err.message);
      setConfigured(false);
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPosts = posts.length > 0;

  return (
    <section 
      id="instagram" 
      className="py-16 sm:py-24 relative bg-white dark:bg-slate-900"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Instagram size={32} style={{ color: '#E1306C' }} />
            <h2 
              className="text-3xl sm:text-4xl font-bold font-serif"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              Follow Us on Instagram
            </h2>
          </div>
          <p 
            className="text-lg max-w-2xl mx-auto mb-4"
            style={{ color: 'var(--text-subtle)' }}
          >
            Stay connected with our latest updates, behind-the-scenes moments, and exclusive offers
          </p>
          <a 
            href={`https://www.instagram.com/${username}/`}
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-white font-medium transition-all hover:scale-105"
            style={{ 
              background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)'
            }}
            data-testid="instagram-follow-btn"
          >
            <Instagram size={18} />
            @{username}
          </a>
        </div>

        {/* Instagram Posts Grid */}
        {loading ? (
          // Loading state
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <LoadingSkeleton />
            <LoadingSkeleton />
            <LoadingSkeleton />
          </div>
        ) : hasPosts ? (
          // Live posts from API
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <InstagramPostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          // Placeholder grid when no posts
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <PlaceholderPost />
            <PlaceholderPost />
            <PlaceholderPost />
          </div>
        )}

        {/* Call to action */}
        <div className="text-center mt-10">
          <p 
            className="text-sm mb-2"
            style={{ color: 'var(--text-subtle)' }}
          >
            Share your Addrika moments with
          </p>
          <span 
            className="text-lg font-semibold"
            style={{ color: 'var(--metallic-gold)' }}
          >
            #AddrikaFragrances
          </span>
        </div>

        {/* Social QR Codes Section */}
        <div className="mt-12 pt-10 border-t" style={{ borderColor: 'var(--border)' }}>
          <h3 
            className="text-xl font-semibold text-center mb-6"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            Scan to Follow
          </h3>
          <div className="flex flex-wrap justify-center gap-8">
            {/* Instagram QR Code */}
            {socialQRCodes.instagram.enabled && (
              <a
                href={socialQRCodes.instagram.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col items-center p-4 rounded-xl transition-all hover:scale-105 hover:shadow-lg bg-white dark:bg-slate-800"
                style={{ border: '1px solid var(--border)' }}
                data-testid="instagram-qr-code"
              >
                <img 
                  src={socialQRCodes.instagram.image}
                  alt="Scan to follow @addrika.fragrances on Instagram"
                  className="w-36 h-36 object-contain mb-3"
                />
                <div className="flex items-center gap-2">
                  <Instagram size={20} style={{ color: socialQRCodes.instagram.color }} />
                  <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                    {socialQRCodes.instagram.handle}
                  </span>
                </div>
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default InstagramFeed;
