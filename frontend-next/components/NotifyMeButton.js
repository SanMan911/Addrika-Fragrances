'use client';

import { useState } from 'react';
import { Bell, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

export default function NotifyMeButton({ productId, variant = 'default' }) {
  const { user } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!email || !email.includes('@')) {
      toast.error('Please enter a valid email');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/notify-me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase(), product_id: productId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed');
      }
      setSuccess(true);
      toast.success("You'll be notified when this launches!");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-submit for logged-in users on click
  const handleClick = (e) => {
    e.stopPropagation();
    if (success) return;
    if (user?.email) {
      setEmail(user.email);
      handleSubmit(e);
    } else {
      setShowInput(true);
    }
  };

  if (success) {
    return (
      <div
        className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium ${
          variant === 'compact' ? 'px-3' : 'px-4 flex-1'
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(5,150,105,0.15) 100%)',
          color: 'rgba(16,185,129,0.9)',
          border: '1px solid rgba(16,185,129,0.3)',
        }}
        data-testid="notify-me-success"
      >
        <Check size={16} />
        <span>Subscribed!</span>
      </div>
    );
  }

  if (showInput && !user?.email) {
    return (
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className={`flex gap-2 ${variant === 'compact' ? '' : 'flex-1'}`}
        data-testid="notify-me-form"
      >
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Your email"
          className="flex-1 px-3 py-2.5 rounded-lg text-sm bg-white/5 border border-purple-500/30 text-white placeholder-slate-500 focus:border-purple-400 focus:outline-none"
          autoFocus
          onClick={(e) => e.stopPropagation()}
          data-testid="notify-me-email-input"
        />
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
          style={{
            background: 'linear-gradient(135deg, rgba(168,85,247,0.9) 0%, rgba(139,92,246,0.9) 100%)',
            color: 'white',
          }}
          data-testid="notify-me-submit-btn"
        >
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />}
          Notify
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={submitting}
      className={`py-3 rounded-xl font-semibold text-sm tracking-wide transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] disabled:opacity-50 ${
        variant === 'compact' ? 'px-4' : 'flex-1 px-4'
      }`}
      style={{
        background: 'linear-gradient(135deg, rgba(168,85,247,0.3) 0%, rgba(139,92,246,0.2) 100%)',
        color: 'rgba(168,85,247,0.95)',
        border: '1px solid rgba(168,85,247,0.3)',
      }}
      data-testid={`notify-me-btn-${productId}`}
    >
      {submitting ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <Bell size={16} />
      )}
      Notify Me When Available
    </button>
  );
}
