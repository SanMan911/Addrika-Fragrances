import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Eye, Tag, ArrowLeft, Home, Search } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Input } from '../components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const BlogPage = () => {
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  useEffect(() => {
    window.scrollTo(0, 0);
    fetchPosts();
  }, [selectedTag]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const url = selectedTag 
        ? `${API_URL}/api/blog/posts?tag=${selectedTag}`
        : `${API_URL}/api/blog/posts`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setPosts(data.posts || []);
      }
    } catch (error) {
      console.error('Error fetching posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => 
    post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    post.excerpt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tags = ['fragrance', 'agarbatti', 'incense', 'aroma', 'aromatherapy', 'wellness', 'spirituality'];

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title="Blog | Addrika - Fragrance Tips, Aromatherapy & Incense Guides"
        description="Explore the Addrika blog for fragrance tips, aromatherapy guides, incense burning rituals, and wellness content. Learn about premium agarbatti and sacred scents."
        url="https://centraders.com/blog"
        keywords="incense blog, agarbatti tips, aromatherapy guide, fragrance rituals, incense burning guide, addrika blog"
        type="website"
      />
      <Header />
      
      <main className="flex-1 pt-24" style={{ backgroundColor: 'var(--cream)' }}>
        {/* Hero Section */}
        <div 
          className="py-16 text-center"
          style={{ backgroundColor: 'var(--japanese-indigo)' }}
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-serif">
            Addrika Blog
          </h1>
          <p className="text-lg text-white/80 max-w-2xl mx-auto px-4">
            Discover the art of aromatherapy, wellness tips, and the stories behind our fragrances
          </p>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-12">
          {/* Navigation */}
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
            >
              <ArrowLeft size={20} />
              <span>Back</span>
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

          {/* Search and Filters */}
          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search articles..."
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTag('')}
                className={`px-3 py-1 rounded-full text-sm transition-all ${
                  !selectedTag ? 'text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
                style={{ backgroundColor: !selectedTag ? 'var(--japanese-indigo)' : undefined }}
              >
                All
              </button>
              {tags.map(tag => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className={`px-3 py-1 rounded-full text-sm transition-all ${
                    selectedTag === tag ? 'text-white' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                  style={{ backgroundColor: selectedTag === tag ? 'var(--metallic-gold)' : undefined }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Posts Grid */}
          {loading ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto"
                   style={{ borderColor: 'var(--japanese-indigo)', borderTopColor: 'transparent' }} />
            </div>
          ) : filteredPosts.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-xl mb-4" style={{ color: 'var(--text-subtle)' }}>
                {searchTerm || selectedTag ? 'No articles found matching your criteria' : 'No articles yet'}
              </p>
              <p style={{ color: 'var(--text-subtle)' }}>
                Check back soon for new content!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map(post => (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all cursor-pointer group"
                  style={{ border: '1px solid var(--border)' }}
                  onClick={() => navigate(`/blog/${post.slug}`)}
                  data-testid="blog-post-card"
                >
                  {/* Featured Image */}
                  <div className="aspect-video bg-gray-100 overflow-hidden">
                    {post.featuredImage ? (
                      <img 
                        src={post.featuredImage} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div 
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: 'var(--japanese-indigo)' }}
                      >
                        <span className="text-4xl">📝</span>
                      </div>
                    )}
                  </div>

                  <div className="p-6">
                    {/* Tags */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {post.tags?.slice(0, 3).map(tag => (
                        <span 
                          key={tag}
                          className="text-xs px-2 py-1 rounded-full"
                          style={{ backgroundColor: 'var(--metallic-gold)/20', color: 'var(--metallic-gold)' }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Title */}
                    <h2 
                      className="text-xl font-bold mb-2 line-clamp-2 group-hover:text-opacity-80"
                      style={{ color: 'var(--japanese-indigo)' }}
                    >
                      {post.title}
                    </h2>

                    {/* Excerpt */}
                    <p className="text-sm mb-4 line-clamp-3" style={{ color: 'var(--text-subtle)' }}>
                      {post.excerpt}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-subtle)' }}>
                      <div className="flex items-center gap-1">
                        <Calendar size={14} />
                        <span>
                          {(() => {
                            const date = new Date(post.publishedAt);
                            const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                            const day = String(date.getDate()).padStart(2, '0');
                            const month = months[date.getMonth()];
                            const year = date.getFullYear();
                            return `${day}${month}${year}`;
                          })()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye size={14} />
                        <span>{post.viewCount || 0} views</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default BlogPage;
