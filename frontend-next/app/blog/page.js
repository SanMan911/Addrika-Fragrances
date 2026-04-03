import Link from 'next/link';
import { Calendar, Eye, Tag, Search } from 'lucide-react';
import Header from '../../components/Header';
import Footer from '../../components/Footer';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export const metadata = {
  title: 'Blog | Addrika - Fragrance Tips, Aromatherapy & Incense Guides',
  description: 'Explore the Addrika blog for fragrance tips, aromatherapy guides, incense burning rituals, and wellness content. Learn about premium agarbatti and sacred scents.',
  keywords: ['incense blog', 'agarbatti tips', 'aromatherapy guide', 'fragrance rituals', 'incense burning guide', 'addrika blog'],
  openGraph: {
    title: 'Blog | Addrika',
    description: 'Fragrance tips, aromatherapy guides, and incense wisdom.',
    url: 'https://centraders.com/blog',
  },
};

async function getBlogPosts() {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.posts || [];
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    return [];
  }
}

export default async function BlogPage() {
  const posts = await getBlogPosts();
  
  const tags = ['fragrance', 'agarbatti', 'incense', 'aroma', 'aromatherapy', 'wellness', 'spirituality'];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #0f1419 0%, #1a2332 100%)' }}>
      <Header />

      <main className="pt-24">
        {/* Hero */}
        <section className="py-16 px-4">
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
              THE JOURNAL
            </span>
            <h1 
              className="text-4xl sm:text-5xl font-bold text-white mb-6"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              The Addrika Journal
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Explore the world of fragrances, aromatherapy tips, and mindful living.
            </p>
          </div>
        </section>

        {/* Tags */}
        <section className="py-6 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2 justify-center">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer"
                  style={{ 
                    background: 'rgba(255,255,255,0.05)',
                    color: '#e8e6e3',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-12 px-4 pb-20">
          <div className="max-w-6xl mx-auto">
            {posts.length === 0 ? (
              <div 
                className="text-center py-16 rounded-2xl"
                style={{ 
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <Search className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-white mb-2">
                  No Posts Yet
                </h2>
                <p className="text-gray-400">
                  We&apos;re working on creating valuable content for you. Check back soon!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group rounded-xl overflow-hidden transition-all hover:-translate-y-1"
                    style={{ 
                      background: 'linear-gradient(165deg, rgba(26,26,46,0.8) 0%, rgba(22,33,62,0.8) 100%)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {post.featuredImage && (
                      <div className="aspect-[16/9] overflow-hidden">
                        <img
                          src={post.featuredImage}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {new Date(post.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Eye size={14} />
                          {post.views || 0} views
                        </span>
                      </div>
                      <h2 className="text-xl font-semibold text-white mb-2 group-hover:text-[#D4AF37] transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-gray-400 text-sm line-clamp-3">
                        {post.excerpt}
                      </p>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs rounded"
                              style={{ 
                                background: 'rgba(212,175,55,0.1)',
                                color: '#D4AF37'
                              }}
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
