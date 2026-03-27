import Link from 'next/link';
import { Calendar, Eye, ArrowLeft, Share2 } from 'lucide-react';
import { notFound } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://forgot-pass-4.preview.emergentagent.com';

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
    title: `${post.title} | Addrika Blog`,
    description: post.excerpt || `Read ${post.title} on the Addrika blog.`,
    keywords: post.tags?.join(', ') || 'incense, aromatherapy, fragrance',
    openGraph: {
      title: post.title,
      description: post.excerpt,
      url: `https://centraders.com/blog/${params.slug}`,
      type: 'article',
      images: post.featuredImage ? [{ url: post.featuredImage }] : [],
      publishedTime: post.createdAt,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.featuredImage ? [post.featuredImage] : [],
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
    "image": post.featuredImage,
    "datePublished": post.createdAt,
    "dateModified": post.updatedAt || post.createdAt,
    "author": {
      "@type": "Organization",
      "name": "Addrika",
      "url": "https://centraders.com"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Centsibl Traders Private Limited",
      "logo": {
        "@type": "ImageObject",
        "url": "https://centraders.com/images/logos/addrika-logo-gold-cropped.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://centraders.com/blog/${post.slug}`
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
          {post.featuredImage && (
            <div className="aspect-[16/9] rounded-xl overflow-hidden mb-8">
              <img
                src={post.featuredImage}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {new Date(post.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric'
              })}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {post.views || 0} views
            </span>
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

          {/* Share */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <p className="text-gray-600">Enjoyed this article? Share it!</p>
              <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#F5F0E8] text-[#2B3A4A] hover:bg-[#D4AF37]/20 transition-colors">
                <Share2 size={18} />
                Share
              </button>
            </div>
          </div>
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
