'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import {
  Link as LinkIcon,
  Copy,
  Download,
  Share2,
  Check,
} from 'lucide-react';

/**
 * Social share toolbar for blog posts.
 * Supports: WhatsApp, X, Telegram, VK, Copy link, Instagram (image download
 * + caption copy fallback since Instagram has no web share intent).
 *
 * Props:
 *   url          string  - canonical URL of the post (full https://…)
 *   title        string  - post title
 *   excerpt?     string  - optional short summary
 *   socialCaption? string - pre-built IG/X caption from the auto-blog
 *   heroImage?   string  - hero image URL for IG download fallback
 */
export default function BlogShareToolbar({
  url,
  title,
  excerpt = '',
  socialCaption = '',
  heroImage = '',
}) {
  const [copied, setCopied] = useState(false);

  const text = (socialCaption || `${title} — ${excerpt}`).trim();
  const enc = encodeURIComponent;

  const intents = {
    whatsapp: `https://wa.me/?text=${enc(`${text}\n\n${url}`)}`,
    x: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`,
    telegram: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`,
    vk: `https://vk.com/share.php?url=${enc(url)}&title=${enc(title)}&description=${enc(excerpt)}`,
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy');
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      toast.success('Caption + link copied — paste into Instagram');
    } catch {
      toast.error('Could not copy caption');
    }
  };

  const shareInstagram = async () => {
    // Mobile native share (iOS/Android share sheet — Instagram appears here)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        // User cancelled — fall through
      }
    }
    // Desktop fallback: copy caption
    copyCaption();
  };

  const downloadHero = async () => {
    if (!heroImage) {
      toast.error('No image available to download');
      return;
    }
    try {
      const res = await fetch(heroImage);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `addrika-${(title || 'post').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Image downloaded — caption ready to paste');
      copyCaption();
    } catch {
      toast.error('Download failed — try the copy caption button');
    }
  };

  return (
    <div
      className="flex items-center gap-2 flex-wrap py-4 my-6 border-y border-slate-200 dark:border-slate-700"
      role="region"
      aria-label="Share this article"
      data-testid="blog-share-toolbar"
    >
      <span className="text-sm font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
        <Share2 size={14} /> Share:
      </span>

      <ShareBtn href={intents.whatsapp} label="WhatsApp" testid="share-whatsapp" bg="#25D366">
        <svg width="16" height="16" viewBox="0 0 32 32" fill="currentColor"><path d="M16 0C7.2 0 0 7.2 0 16c0 2.8.7 5.5 2.1 7.9L0 32l8.4-2.2c2.3 1.3 4.9 1.9 7.6 1.9 8.8 0 16-7.2 16-16S24.8 0 16 0zm9.4 22.7c-.4 1.1-1.9 2-3.1 2.3-.9.2-2.1.4-6.1-1.3-5.1-2.1-8.4-7.3-8.7-7.7-.3-.4-2.1-2.8-2.1-5.3s1.3-3.7 1.8-4.2c.4-.4 1-.6 1.3-.6h1c.3 0 .8 0 1.2 1 .5 1.2 1.7 4.1 1.8 4.4.1.3.2.6 0 1-.2.4-.3.6-.6.9-.3.3-.5.6-.8.9-.3.2-.5.5-.2 1 .3.5 1.4 2.3 3 3.7 2.1 1.8 3.8 2.4 4.3 2.6.5.2.8.2 1.1-.1.3-.3 1.3-1.5 1.6-2 .3-.5.7-.4 1.1-.3.5.2 3 1.4 3.5 1.7.5.3.9.4 1 .6.1.3.1 1.4-.3 2.4z"/></svg>
      </ShareBtn>

      <ShareBtn href={intents.x} label="X" testid="share-x" bg="#000000">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </ShareBtn>

      <ShareBtn href={intents.telegram} label="Telegram" testid="share-telegram" bg="#0088cc">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/></svg>
      </ShareBtn>

      <ShareBtn href={intents.vk} label="VK" testid="share-vk" bg="#0077FF">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13.162 18.994c.609 0 .858-.406.851-.915-.031-1.917.714-2.949 2.059-1.604 1.488 1.488 1.796 2.519 3.603 2.519h3.2c.86 0 1.235-.276 1.235-.701 0-.901-1.485-2.49-2.729-3.654-1.738-1.625-1.812-1.671-.302-3.626 1.443-1.875 3.295-4.41 2.347-4.41h-3.582c-.804 0-.847.45-1.12 1.083-.992 2.342-2.738 5.131-3.448 4.674-.74-.477-.405-2.1-.348-5.685.015-.49 0-.92-.594-1.052-.382-.084-.748-.143-1.756-.143-1.282 0-1.952.039-2.396.276-.42.225-.488.6-.196.658.604.121.97.225.97 1.42 0 1.62-.21 4.13-.93 4.59-.69.4-1.65-1.65-2.85-4.61-.27-.66-.34-1.36-1.4-1.36H1.595C.785 6.444.5 6.781.5 7.184c0 .855 1.844 4.93 5.05 9.59 2.7 3.927 5.477 6.22 7.612 6.22z"/></svg>
      </ShareBtn>

      <ShareBtn onClick={copyLink} label={copied ? 'Copied!' : 'Copy link'} testid="share-copy" bg="#475569">
        {copied ? <Check size={14} /> : <LinkIcon size={14} />}
      </ShareBtn>

      <ShareBtn onClick={shareInstagram} label="Instagram" testid="share-instagram"
        bg="linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%)"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.074-1.689.074-4.948 0-3.259-.015-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.667.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
      </ShareBtn>

      {heroImage && (
        <ShareBtn onClick={downloadHero} label="Image + caption" testid="share-download-image" bg="#0f172a">
          <Download size={14} />
        </ShareBtn>
      )}

      <ShareBtn onClick={copyCaption} label="Copy caption" testid="share-copy-caption" bg="#7c3aed">
        <Copy size={14} />
      </ShareBtn>
    </div>
  );
}

function ShareBtn({ href, onClick, label, testid, bg, children }) {
  const cls =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg shadow-sm hover:opacity-90 transition-opacity';
  const style = bg.startsWith('linear-gradient')
    ? { background: bg }
    : { backgroundColor: bg };

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cls}
        style={style}
        data-testid={testid}
        aria-label={`Share on ${label}`}
      >
        {children}
        <span className="hidden sm:inline">{label}</span>
      </a>
    );
  }
  return (
    <button
      onClick={onClick}
      className={cls}
      style={style}
      data-testid={testid}
      aria-label={label}
      type="button"
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
