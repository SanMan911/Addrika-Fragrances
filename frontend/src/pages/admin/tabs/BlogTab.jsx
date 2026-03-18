import React from 'react';
import { FileText, Plus, Eye } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const BlogTab = ({ 
  blogPosts, 
  showBlogForm, 
  setShowBlogForm, 
  newBlog, 
  setNewBlog, 
  createBlogPost,
  navigate 
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="blog-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Blog Posts ({blogPosts.length})
        </h2>
        <Button
          onClick={() => setShowBlogForm(!showBlogForm)}
          className="flex items-center gap-2 text-white bg-slate-800 hover:bg-slate-700"
          data-testid="new-blog-post-btn"
        >
          <Plus size={18} /> New Post
        </Button>
      </div>

      {showBlogForm && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
          <form onSubmit={createBlogPost} className="space-y-4">
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Title *</Label>
              <Input
                value={newBlog.title}
                onChange={(e) => setNewBlog({ ...newBlog, title: e.target.value })}
                placeholder="Blog post title"
                required
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                data-testid="blog-title-input"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Excerpt * (short description)</Label>
              <textarea
                value={newBlog.excerpt}
                onChange={(e) => setNewBlog({ ...newBlog, excerpt: e.target.value })}
                placeholder="Brief description (20-500 chars)"
                className="w-full p-2 border rounded min-h-[60px] bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                required
                data-testid="blog-excerpt-input"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Content *</Label>
              <textarea
                value={newBlog.content}
                onChange={(e) => setNewBlog({ ...newBlog, content: e.target.value })}
                placeholder="Full blog content (min 100 chars)"
                className="w-full p-2 border rounded min-h-[200px] bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                required
                data-testid="blog-content-input"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Featured Image URL (optional)</Label>
              <Input
                value={newBlog.featuredImage}
                onChange={(e) => setNewBlog({ ...newBlog, featuredImage: e.target.value })}
                placeholder="https://..."
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                data-testid="blog-image-input"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="publishNow"
                checked={newBlog.isPublished}
                onChange={(e) => setNewBlog({ ...newBlog, isPublished: e.target.checked })}
                data-testid="blog-publish-checkbox"
              />
              <Label htmlFor="publishNow" className="text-slate-700 dark:text-slate-300">
                Publish immediately (will notify subscribers)
              </Label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="text-white bg-slate-800 hover:bg-slate-700" data-testid="create-blog-btn">
                Create Post
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowBlogForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {blogPosts.map((post) => (
          <div key={post.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-100">{post.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {post.viewCount} views • {(() => {
                  const date = new Date(post.createdAt);
                  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                  const day = String(date.getDate()).padStart(2, '0');
                  const month = months[date.getMonth()];
                  const year = date.getFullYear();
                  return `${day}${month}${year}`;
                })()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-full ${
                post.isPublished 
                  ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {post.isPublished ? 'Published' : 'Draft'}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/blog/${post.slug}`)}
                data-testid={`view-blog-${post.id}`}
              >
                <Eye size={14} />
              </Button>
            </div>
          </div>
        ))}
        {blogPosts.length === 0 && (
          <div className="text-center py-12">
            <FileText size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">No blog posts yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BlogTab;
