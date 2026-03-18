import React, { useState } from 'react';
import { Mail, Send, Loader2, Check, Newspaper, MapPin, Tag, Instagram } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const NewsletterSubscribe = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [preferences, setPreferences] = useState({
    blog_posts: true,
    new_retailers: true,
    promotions: true,
    instagram_updates: true
  });

  const togglePreference = (key) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email');
      return;
    }

    // Ensure at least one preference is selected
    if (!Object.values(preferences).some(v => v)) {
      toast.error('Please select at least one notification type');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email, 
          name: name || null,
          preferences
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSubscribed(true);
        setEmail('');
        setName('');
        toast.success(data.message || 'Successfully subscribed!');
      } else {
        toast.error(data.detail || 'Failed to subscribe');
      }
    } catch (error) {
      console.error('Subscribe error:', error);
      toast.error('Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <div className="text-center py-4">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
             style={{ backgroundColor: 'var(--metallic-gold)' }}>
          <Check size={24} className="text-white" />
        </div>
        <p className="text-white font-medium">You're subscribed!</p>
        <p className="text-white/60 text-sm mt-1">Check your email for a welcome message.</p>
      </div>
    );
  }

  const preferenceOptions = [
    { key: 'blog_posts', label: 'Blogs', icon: Newspaper },
    { key: 'new_retailers', label: 'Stores', icon: MapPin },
    { key: 'promotions', label: 'Offers', icon: Tag },
    { key: 'instagram_updates', label: 'Insta', icon: Instagram }
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
        <Mail size={20} style={{ color: 'var(--metallic-gold)' }} />
        Subscribe to Updates
      </h3>
      <p className="text-white/60 text-sm mb-3">
        Choose what you'd like to hear about:
      </p>
      
      {/* Preference Checkboxes */}
      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {preferenceOptions.map(({ key, label, icon: Icon }) => (
          <label 
            key={key}
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-md cursor-pointer transition-all text-[11px] leading-tight ${
              preferences[key] 
                ? 'bg-white/20 border border-white/30' 
                : 'bg-white/5 border border-white/10 opacity-60'
            }`}
          >
            <input
              type="checkbox"
              checked={preferences[key]}
              onChange={() => togglePreference(key)}
              className="sr-only"
            />
            <div className={`w-3.5 h-3.5 rounded flex items-center justify-center flex-shrink-0 ${
              preferences[key] ? 'bg-[var(--metallic-gold)]' : 'bg-white/20'
            }`}>
              {preferences[key] && <Check size={10} className="text-white" />}
            </div>
            <Icon size={12} className="flex-shrink-0" style={{ color: preferences[key] ? 'var(--metallic-gold)' : 'white' }} />
            <span className="text-white truncate">{label}</span>
          </label>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9 text-sm"
          data-testid="subscribe-name-input"
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email address"
          required
          className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-9 text-sm"
          data-testid="subscribe-email-input"
        />
        <Button
          type="submit"
          disabled={loading}
          className="w-full text-white font-semibold"
          style={{ backgroundColor: 'var(--metallic-gold)' }}
          data-testid="subscribe-button"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="mr-2 animate-spin" />
              Subscribing...
            </>
          ) : (
            <>
              <Send size={18} className="mr-2" />
              Subscribe
            </>
          )}
        </Button>
      </form>
      <p className="text-white/40 text-xs mt-3">
        We respect your privacy. Unsubscribe anytime.
      </p>
    </div>
  );
};

export default NewsletterSubscribe;
