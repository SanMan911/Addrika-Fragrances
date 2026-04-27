'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  Calendar,
  Power,
  PlayCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileEdit,
  Globe,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const CADENCE_PRESETS = [
  { label: '~5 / week', min: 1.0, max: 2.0 },
  { label: '2-3 / week', min: 2.0, max: 4.0 },
  { label: 'Weekly', min: 6.0, max: 8.0 },
  { label: 'Bi-weekly', min: 12.0, max: 16.0 },
];

export default function AdminAutoBlogPage() {
  const [cfg, setCfg] = useState(null);
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, logRes] = await Promise.all([
        authFetch(`${API_URL}/api/admin/auto-blog/settings`),
        authFetch(`${API_URL}/api/admin/auto-blog/log?limit=20`),
      ]);
      if (cfgRes.ok) setCfg(await cfgRes.json());
      if (logRes.ok) setLog((await logRes.json()).items || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateCfg = async (patch) => {
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/auto-blog/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Save failed');
      setCfg(data);
      toast.success('Auto-blog settings saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    if (
      !confirm(
        'Generate a new blog post right now?\n\nUses Google Gemini 2.0 Flash (free tier) for text + Pollinations AI (free, no key) for 3 images. May take 30-90 seconds.'
      )
    )
      return;
    setRunning(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/auto-blog/run-now`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.detail || 'Run failed');
      }
      toast.success(
        `New post created — ${data.is_published ? 'published' : 'draft'}: ${data.slug}`,
        { duration: 6000 }
      );
      fetchAll();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  if (!cfg) {
    return <div className="text-red-600">Failed to load settings.</div>;
  }

  const next = cfg.next_due_at ? new Date(cfg.next_due_at) : null;
  const last = cfg.last_run_at ? new Date(cfg.last_run_at) : null;

  return (
    <div className="space-y-6" data-testid="admin-auto-blog-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/content"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            data-testid="back-to-content"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles size={22} /> Auto-Blog
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              AI-generated blog posts on a schedule. Topics alternate between
              an evergreen bank and seasonal/trend-driven angles. Hero + 2
              inline images per post.
            </p>
          </div>
        </div>
        <button
          onClick={runNow}
          disabled={running || saving}
          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium inline-flex items-center gap-2 disabled:opacity-50"
          data-testid="autoblog-run-now"
        >
          {running ? (
            <>
              <Loader2 size={14} className="animate-spin" /> Generating…
            </>
          ) : (
            <>
              <PlayCircle size={14} /> Run now
            </>
          )}
        </button>
      </div>

      {/* Status card */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <Stat
            icon={<Power size={16} className={cfg.enabled ? 'text-emerald-600' : 'text-slate-400'} />}
            label="Status"
            value={cfg.enabled ? 'Enabled' : 'Paused'}
            tone={cfg.enabled ? 'emerald' : 'slate'}
          />
        </Card>
        <Card>
          <Stat
            icon={<Calendar size={16} className="text-blue-600" />}
            label="Cadence"
            value={
              CADENCE_PRESETS.find(
                (p) => p.min === cfg.cadence_min_days && p.max === cfg.cadence_max_days,
              )?.label ||
              `Every ${cfg.cadence_min_days}-${cfg.cadence_max_days} days`
            }
            tone="slate"
          />
        </Card>
        <Card>
          <Stat
            icon={<FileEdit size={16} className="text-purple-600" />}
            label="Publish mode"
            value={cfg.publish_mode === 'auto' ? 'Auto-publish' : 'Save as draft'}
            tone="slate"
          />
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-slate-500 mb-1">Last generated</p>
          <p className="font-medium text-slate-800 dark:text-white">
            {last ? last.toLocaleString() : 'Never'}
          </p>
          <p className="text-xs text-slate-500 mt-2">Cycle count</p>
          <p className="font-medium text-slate-800 dark:text-white">
            {cfg.cycle_count || 0}
          </p>
        </Card>
        <Card>
          <p className="text-xs text-slate-500 mb-1">Next scheduled run</p>
          <p className="font-medium text-slate-800 dark:text-white">
            {next ? next.toLocaleString() : 'Will bootstrap on next scheduler tick'}
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Scheduler ticks hourly; if the next-due time has passed and the
            service is enabled, a cycle fires automatically.
          </p>
        </Card>
      </section>

      {/* Controls */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-5">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
          Controls
        </h2>

        {/* Enable toggle */}
        <Row label="Schedule" hint="When OFF, no auto-generation runs. You can still 'Run now' manually.">
          <ToggleButton
            on={cfg.enabled}
            onLabel="Enabled"
            offLabel="Paused"
            disabled={saving}
            onClick={() => updateCfg({ enabled: !cfg.enabled })}
            testid="toggle-enabled"
          />
        </Row>

        {/* Cadence */}
        <Row label="Cadence" hint="Posts are scheduled with random gaps between min/max days, so timing feels organic. ‘2-3 / week’ ≈ 8-10 posts/month.">
          <div className="flex flex-wrap gap-2">
            {CADENCE_PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => updateCfg({ cadence_min_days: p.min, cadence_max_days: p.max })}
                disabled={saving}
                className={`px-3 py-1.5 text-sm rounded-lg border ${
                  cfg.cadence_min_days === p.min && cfg.cadence_max_days === p.max
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-50'
                }`}
                data-testid={`cadence-${p.label.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </Row>

        {/* Publish mode */}
        <Row label="On generation" hint="Auto = post goes live immediately. Draft = sits in /admin/content for your review.">
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {[
              { val: 'auto', label: 'Auto-publish' },
              { val: 'draft', label: 'Save as draft' },
            ].map((m) => (
              <button
                key={m.val}
                onClick={() => updateCfg({ publish_mode: m.val })}
                disabled={saving}
                className={`px-3 py-2 text-sm ${
                  cfg.publish_mode === m.val
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300'
                }`}
                data-testid={`publish-mode-${m.val}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Row>
      </section>

      {/* Log */}
      <section className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white inline-flex items-center gap-2">
            <Globe size={16} /> Recent activity
          </h2>
          <button
            onClick={fetchAll}
            className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white inline-flex items-center gap-1"
            data-testid="autoblog-refresh"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
        {log.length === 0 ? (
          <p className="text-sm text-slate-500">No runs yet — once scheduled or you click "Run now", entries will appear here.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {log.map((entry, i) => (
              <li key={entry.id || i} className="py-3 flex items-start gap-3" data-testid={`log-entry-${i}`}>
                {entry.ok ? (
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                    {entry.ok && entry.slug ? (
                      <Link href={`/blog/${entry.slug}`} target="_blank" className="hover:underline">
                        {entry.slug}
                      </Link>
                    ) : (
                      entry.error || 'Run failed'
                    )}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {entry.topic_source && <span className="capitalize">{entry.topic_source} · </span>}
                    {entry.seed_title && <span className="italic">{entry.seed_title} · </span>}
                    {entry.ran_at && new Date(entry.ran_at).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const Card = ({ children }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
    {children}
  </div>
);

const Stat = ({ icon, label, value, tone }) => (
  <div>
    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
      {icon}
      {label}
    </div>
    <p
      className={`text-xl font-bold mt-1 ${
        tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-white'
      }`}
    >
      {value}
    </p>
  </div>
);

const Row = ({ label, hint, children }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="flex-1 min-w-[180px]">
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{label}</p>
      {hint && <p className="text-xs text-slate-500 mt-0.5 max-w-md">{hint}</p>}
    </div>
    <div>{children}</div>
  </div>
);

const ToggleButton = ({ on, onLabel, offLabel, disabled, onClick, testid }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`px-4 py-2 text-sm rounded-lg font-medium ${
      on
        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
        : 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
    } disabled:opacity-50`}
    data-testid={testid}
  >
    {on ? onLabel : offLabel}
  </button>
);
