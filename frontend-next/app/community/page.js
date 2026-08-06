'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Trophy, MapPin, Calendar } from 'lucide-react';

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  '';

/**
 * Public Community Leaderboard.
 * Marketing surface for the top-3 opted-in retailers by monthly ordering
 * streak. Reads from the O(1) streak cache — nothing computed at request
 * time. Refreshed every Sunday midnight UTC (see
 * `services/monthly_rewards_digest.streak_leaderboard_weekly_loop`).
 */
export default function CommunityLeaderboardPage() {
  const [top, setTop] = useState([]);
  const [asOf, setAsOf] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_URL}/api/community/leaderboard`, { cache: 'no-store' });
        if (!r.ok) return;
        const d = await r.json();
        setTop(d.top || []);
        setAsOf(d.as_of);
      } catch { /* silent */ }
      finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a2332] via-[#0f1419] to-[#1a2332]" data-testid="community-leaderboard-page">
      <div className="max-w-3xl mx-auto py-16 px-4 sm:px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-xs font-semibold mb-4">
            <Sparkles size={14} /> COMMUNITY LEADERBOARD
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">The Constant Companions</h1>
          <p className="text-slate-400 max-w-lg mx-auto">
            The retailers who show up every month, without fail. These three carry the longest unbroken ordering streaks in the Addrika network.
          </p>
          {asOf && (
            <p className="text-xs text-slate-500 mt-3 flex items-center justify-center gap-1">
              <Calendar size={12} />
              Refreshed {new Date(asOf).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>

        {loading && <div className="text-center text-slate-400">Loading…</div>}

        {!loading && top.length === 0 && (
          <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-8 text-center text-slate-400" data-testid="leaderboard-empty">
            <Trophy size={32} className="mx-auto mb-3 text-slate-600" />
            <p>No retailers have opted into the public leaderboard yet.</p>
            <p className="text-xs mt-1">Retailers can toggle their opt-in from the Rewards page.</p>
          </div>
        )}

        {!loading && top.length > 0 && (
          <div className="space-y-3" data-testid="leaderboard-list">
            {top.map((entry, i) => (
              <div
                key={i}
                className={`rounded-2xl border p-5 flex items-center gap-4 ${
                  i === 0 ? 'border-[#D4AF37] bg-gradient-to-r from-[#D4AF37]/10 to-transparent'
                  : i === 1 ? 'border-slate-500 bg-slate-800/40'
                  : 'border-orange-800/50 bg-orange-900/10'
                }`}
                data-testid={`leaderboard-rank-${i + 1}`}
              >
                <div className={`text-4xl font-bold w-14 text-center ${
                  i === 0 ? 'text-[#D4AF37]' : i === 1 ? 'text-slate-300' : 'text-orange-400'
                }`}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-bold text-white">{entry.display_name}</div>
                  {entry.city && (
                    <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={12} /> {entry.city}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-[#D4AF37]">{entry.streak_months}</div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">months in a row</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 text-center">
          <Link href="/retailer/b2b" className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#D4AF37] text-[#1a2332] font-semibold hover:bg-[#c19f2e]">
            Start your streak →
          </Link>
          <p className="text-xs text-slate-500 mt-4">
            Are you an Addrika retailer? Toggle your leaderboard opt-in from your <Link href="/retailer/b2b/rewards" className="text-[#D4AF37] hover:underline">Rewards page</Link> to appear here.
          </p>
        </div>
      </div>
    </div>
  );
}
