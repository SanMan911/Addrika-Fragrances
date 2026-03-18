import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Eye, Tag, ArrowLeft, Home, Share2, Clock } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BlogPostPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPost();
  }, [slug]);

  const fetchPost = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/blog/posts/${slug}`);
      if (response.ok) {
        const data = await response.json();
        setPost(data.post);
      } else if (response.status === 404) {
        navigate('/blog', { replace: true });
        toast.error('Blog post not found');
      }
    } catch (error) {
      console.error('Error fetching post:', error);
      toast.error('Failed to load blog post');
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: post.excerpt,
          url: url
        });
      } catch (err) {
        // User cancelled or error
      }
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    }
  };

  const estimateReadTime = (content) => {
    const words = content?.split(/\s+/).length || 0;
    return Math.max(1, Math.ceil(words / 200));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 pt-24 flex items-center justify-center" style={{ backgroundColor: 'var(--cream)' }}>
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }} />
        </main>
        <Footer />
      </div>
    );
  }

  if (!post) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title={`${post.title} | Addrika Blog`}
        description={post.excerpt || `Read ${post.title} on the Addrika blog. Discover fragrance tips, aromatherapy guides, and incense wisdom.`}
        url={`https://centraders.com/blog/${slug}`}
        image={post.featuredImage || 'https://centraders.com/og-image.png'}
        type="article"
        keywords={post.tags?.join(', ') || 'incense, aromatherapy, fragrance, addrika blog'}
      />
      <Header />
      
      <main className="flex-1 pt-24" style={{ backgroundColor: 'var(--cream)' }}>
        {/* Hero Image */}
        {post.featuredImage && (
          <div className="w-full h-64 md:h-96 overflow-hidden">
            <img 
              src={post.featuredImage} 
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <article className="max-w-4xl mx-auto px-4 py-12">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/blog')}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                <ArrowLeft size={20} />
                <span>All Posts</span>
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                <Home size={20} />
                <span>Home</span>
              </button>
            </div>
            <Button
              onClick={handleShare}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Share2 size={18} />
              Share
            </Button>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mb-4">
            {post.tags?.map(tag => (
              <span 
                key={tag}
                className="text-xs px-3 py-1 rounded-full cursor-pointer hover:opacity-80"
                style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
                onClick={() => navigate(`/blog?tag=${tag}`)}
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 
            className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 font-serif"
            style={{ color: 'var(--japanese-indigo)' }}
          >
            {post.title}
          </h1>

          {/* Meta */}
          <div className="flex flex-wrap items-center gap-4 mb-8 pb-8 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              <Calendar size={16} />
              <span>
                {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric'
                })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              <Clock size={16} />
              <span>{estimateReadTime(post.content)} min read</span>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-subtle)' }}>
              <Eye size={16} />
              <span>{post.viewCount || 0} views</span>
            </div>
            <span className="text-sm" style={{ color: 'var(--text-subtle)' }}>
              By {post.authorName}
            </span>
          </div>

          {/* Excerpt */}
          <p className="text-xl mb-8 font-medium" style={{ color: 'var(--text-subtle)' }}>
            {post.excerpt}
          </p>

          {/* Content */}
          <div 
            className="prose prose-lg max-w-none"
            style={{ color: 'var(--text-dark)' }}
            dangerouslySetInnerHTML={{ __html: post.content.replace(/\n/g, '<br />') }}
          />

          {/* Author Card */}
          <div 
            className="mt-12 p-6 rounded-2xl"
            style={{ backgroundColor: 'var(--japanese-indigo)' }}
          >
            <p className="text-white/80 text-sm mb-2">Written by</p>
            <p className="text-white font-bold text-xl">{post.authorName}</p>
            <p className="text-white/60 text-sm mt-2">Addrika Team</p>
          </div>

          {/* Related Posts CTA */}
          <div className="mt-12 text-center">
            <Button
              onClick={() => navigate('/blog')}
              className="text-white"
              style={{ backgroundColor: 'var(--metallic-gold)' }}
            >
              Read More Articles
            </Button>
          </div>
        </article>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPostPage;
