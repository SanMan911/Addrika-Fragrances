import Link from 'next/link';
import { Calendar, Eye, ArrowLeft, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || '';

async function getBlogPost(slug) {
  try {
    const res = await fetch(`${API_URL}/api/blog/posts/${slug}`, {
      next: { revalidate: 3600 }
    });
    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    return null;
  }
}

export async function generateMetadata({ params }) {
  const post = await getBlogPost(params.slug);
  
  if (!post) {
    return { title: 'Post Not Found' };
  }
  
  return {
    title: `${post.title} | Addrika Fragrances Blog`,
    description: post.excerpt || `Read ${post.title} on the Addrika Fragrances blog.`,
    keywords: [...(post.tags || []), 'addrika', 'addrika fragrances', 'premium incense', 'incense guide'].join(', '),
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://centraders.com/blog/${params.slug}`,
      type: 'article',
      images: post.featuredImage ? [{ url: post.featuredImage }] : [],
      publishedTime: post.createdAt || post.created_at,
      modifiedTime: post.updatedAt || post.updated_at,
      authors: ['Addrika Fragrances'],
      section: 'Incense & Fragrance',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.featuredImage || post.featured_image ? [post.featuredImage || post.featured_image] : [],
      creator: '@addrika_incense',
    },
  };
}

// Article structured data
function ArticleStructuredData({ post }) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": post.title,
    "description": post.excerpt,
    "image": post.featuredImage || post.featured_image,
    "datePublished": post.createdAt || post.created_at,
    "dateModified": post.updatedAt || post.updated_at || post.createdAt || post.created_at,
    "author": {
      "@type": "Organization",
      "name": "Addrika Fragrances",
      "url": "https://centraders.com",
      "logo": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Centsibl Traders Private Limited",
      "url": "https://centraders.com",
      "logo": {
        "@type": "ImageObject",
        "url": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://centraders.com/blog/${post.slug}`
    },
    "keywords": (post.tags || []).join(', '),
    "articleSection": "Incense & Fragrance",
    "inLanguage": "en-IN",
    "speakable": {
      "@type": "SpeakableSpecification",
      "cssSelector": ["article h2", "article p"]
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

export default async function BlogPostPage({ params }) {
  const post = await getBlogPost(params.slug);
  
  if (!post) {
    notFound();
  }

  return (
    <>
      <ArticleStructuredData post={post} />
      
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

      <main className="pt-16 min-h-screen bg-white">
        {/* Back Navigation */}
        <div className="max-w-3xl mx-auto px-4 py-6">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 text-[#2B3A4A] hover:text-[#D4AF37] transition-colors"
          >
            <ArrowLeft size={18} />
            Back to Blog
          </Link>
        </div>

        {/* Article */}
        <article className="max-w-3xl mx-auto px-4 pb-16">
          {/* Featured Image */}
          {(post.featured_image || post.featuredImage) && (
            <div className="aspect-[16/9] rounded-xl overflow-hidden mb-8">
              <img
                src={post.featured_image || post.featuredImage}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {new Date(post.created_at || post.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {post.views || 0} views
            </span>
            {post.geo_city && (
              <span className="flex items-center gap-1 text-[#D4AF37]" data-testid="geo-tag">
                · {post.geo_city}
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold text-[#2B3A4A] font-serif mb-6">
            {post.title}
          </h1>

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-8">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 text-sm rounded-full bg-[#F5F0E8] text-[#2B3A4A]"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Content */}
          <div 
            className="prose prose-lg max-w-none prose-headings:text-[#2B3A4A] prose-a:text-[#D4AF37]"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Share toolbar — WhatsApp / X / Telegram / VK / Copy / Instagram */}
          <BlogShareToolbar
            url={`${SITE_URL}/blog/${post.slug}`}
            title={post.title}
            excerpt={post.excerpt || ''}
            socialCaption={post.social_caption || ''}
            heroImage={post.featured_image || post.featuredImage || ''}
          />

          {/* FAQ section (rendered + JSON-LD'd above for GEO) */}
          {Array.isArray(post.faqs) && post.faqs.length > 0 && (
            <section className="mt-10" data-testid="blog-faq-section">
              <h2 className="text-2xl font-bold text-[#2B3A4A] font-serif mb-4">
                Frequently asked questions
              </h2>
              <div className="space-y-4">
                {post.faqs.map((f, i) => (
                  <details
                    key={i}
                    className="rounded-lg border border-gray-200 px-4 py-3 group open:bg-[#F5F0E8]"
                    data-testid={`blog-faq-${i}`}
                  >
                    <summary className="font-medium text-[#2B3A4A] cursor-pointer list-none flex justify-between gap-3">
                      <span>{f.q}</span>
                      <span className="text-[#D4AF37] group-open:rotate-45 transition-transform">+</span>
                    </summary>
                    <p className="mt-2 text-gray-700 leading-relaxed">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </article>
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
