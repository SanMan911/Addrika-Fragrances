import Link from 'next/link';
import { Calendar, Eye, Tag, Search } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ecommerce-nextjs-2.preview.emergentagent.com';

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
            <Link href="/about-us" className="hover:text-[#D4AF37] transition-colors">About Us</Link>
            <Link href="/blog" className="text-[#D4AF37]">Blog</Link>
          </nav>
        </div>
      </header>

      <main className="pt-16 min-h-screen bg-[#F5F0E8]">
        {/* Hero */}
        <section className="py-16 px-4 bg-gradient-to-br from-[#2B3A4A] to-[#1a252f]">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-white font-serif mb-4">
              The Addrika Journal
            </h1>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Explore the world of fragrances, aromatherapy tips, and mindful living.
            </p>
          </div>
        </section>

        {/* Tags */}
        <section className="py-6 px-4 bg-white border-b">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-wrap gap-2 justify-center">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-4 py-2 rounded-full text-sm font-medium bg-[#F5F0E8] text-[#2B3A4A] hover:bg-[#D4AF37]/20 cursor-pointer transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Blog Posts */}
        <section className="py-12 px-4">
          <div className="max-w-6xl mx-auto">
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h2 className="text-2xl font-semibold text-[#2B3A4A] mb-2">
                  No Posts Yet
                </h2>
                <p className="text-gray-600">
                  We&apos;re working on creating valuable content for you. Check back soon!
                </p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {posts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blog/${post.slug}`}
                    className="group bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all"
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
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
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
                      <h2 className="text-xl font-semibold text-[#2B3A4A] mb-2 group-hover:text-[#D4AF37] transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-gray-600 text-sm line-clamp-3">
                        {post.excerpt}
                      </p>
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-4">
                          {post.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-1 text-xs rounded bg-[#F5F0E8] text-[#2B3A4A]"
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
