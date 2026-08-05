'use client';

import { useState, useEffect } from 'react';
import { Sparkles, Send, X, Mail, MessageCircle, Info, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../app/admin/layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const KIND_OPTIONS = [
  { key: 'drop',        label: 'New Drop',            hint: 'A fresh SKU or limited-edition just landed' },
  { key: 'price_drop',  label: 'Price Drop',          hint: 'Wholesale rate reduced on select SKUs' },
  { key: 'festive',     label: 'Festive Re-launch',   hint: 'Diwali, Eid, Christmas special selection' },
  { key: 'promo',       label: 'Promotional Scheme',  hint: 'Buy-2-get-half-off · Free carton on ₹50k' },
  { key: 'announcement',label: 'Announcement',        hint: 'General trade news · policy update' },
];

const AUDIENCE_OPTIONS = [
  { key: 'all',      label: 'All retailers' },
  { key: 'verified', label: 'Verified retailers only' },
  { key: 'product',  label: 'Buyers of a specific SKU (last 180 days)' },
  { key: 'pincode',  label: 'By pincode prefix (region)' },
];

export default function NudgeComposerModal({ open, onClose, products = [] }) {
  const [kind, setKind] = useState('drop');
  const [subject, setSubject] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [whatsappBody, setWhatsappBody] = useState('');
  const [channels, setChannels] = useState({ email: true, whatsapp: false });
  const [audience, setAudience] = useState('all');
  const [productId, setProductId] = useState('');
  const [pincodePrefix, setPincodePrefix] = useState('');
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState([]);
  const [bestTime, setBestTime] = useState(null);
  const [bestTimeLoading, setBestTimeLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/nudges/history?limit=15`);
        if (res.ok) {
          const data = await res.json();
          setHistory(data.entries || []);
        }
      } catch { /* silent */ }
    })();
  }, [open]);

  // Fetch best-time recommendation whenever audience selector changes
  useEffect(() => {
    if (!open) return;
    if (audience === 'product' && !productId) { setBestTime(null); return; }
    if (audience === 'pincode' && !pincodePrefix) { setBestTime(null); return; }
    setBestTimeLoading(true);
    (async () => {
      try {
        const res = await authFetch(
          `${API_URL}/api/admin/b2b/inventory/nudges/best-time-for-audience`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audience,
              product_id: audience === 'product' ? productId : null,
              pincode_prefix: audience === 'pincode' ? pincodePrefix : null,
              top_n: 3,
            }),
          }
        );
        if (res.ok) setBestTime(await res.json());
      } catch { /* silent */ }
      setBestTimeLoading(false);
    })();
  }, [open, audience, productId, pincodePrefix]);

  const applyTemplate = (k) => {
    setKind(k);
    if (k === 'drop') {
      setSubject('New drop just landed at Addrika');
      setBodyHtml(
        '<p>A fresh batch of <b>[SKU name]</b> has just cleared QC and is ready to ship.</p>'
        + '<p>Order now — first-come-first-serve until the batch is spoken for.</p>'
      );
      setWhatsappBody('🌸 New at Addrika: [SKU name] is back — order early on the B2B portal before the batch is gone.');
    } else if (k === 'price_drop') {
      setSubject('Wholesale rates just dropped on select SKUs');
      setBodyHtml('<p>We\u2019ve reduced the wholesale rate on <b>[SKU name]</b> for the next 7 days. Restock at the new rate on the B2B portal.</p>');
      setWhatsappBody('Price drop 📉 — [SKU name] at ₹XX/carton for the next 7 days. Restock on your Addrika B2B portal.');
    } else if (k === 'festive') {
      setSubject('Diwali festive selection is live');
      setBodyHtml('<p>Our festive fragrance selection — <b>Kesar Chandan · Regal Rose · Oriental Oudh</b> — is live on the B2B portal.</p>'
        + '<p>Fill your shelves ahead of the season and offer your customers something special.</p>');
      setWhatsappBody('🪔 Festive drop! Our Diwali fragrance selection is live on the Addrika B2B portal. Restock early — orders ship in 48h.');
    } else if (k === 'promo') {
      setSubject('Special offer for our retail partners');
      setBodyHtml('<p>This month only: <b>Buy 2 cartons, get half a carton free</b> on Bakhoor 200g.</p>');
      setWhatsappBody('Special this month — Buy 2 cartons of Bakhoor 200g, get half a carton free 🎁 Apply on the B2B portal.');
    } else if (k === 'announcement') {
      setSubject('An update from Team Addrika');
      setBodyHtml('<p>[Write your announcement here].</p>');
      setWhatsappBody('');
    }
  };

  const send = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      toast.error('Add a subject and body first');
      return;
    }
    if (!channels.email && !channels.whatsapp) {
      toast.error('Pick at least one channel');
      return;
    }
    setSending(true);
    try {
      const ch = [];
      if (channels.email) ch.push('email');
      if (channels.whatsapp) ch.push('whatsapp');
      const res = await authFetch(`${API_URL}/api/admin/b2b/inventory/nudges/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject, body_html: bodyHtml,
          whatsapp_body: whatsappBody || null,
          channels: ch, audience, kind,
          product_id: audience === 'product' ? productId : null,
          pincode_prefix: audience === 'pincode' ? pincodePrefix : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.detail || 'Broadcast failed');
      toast.success(
        `Sent · audience ${data.audience_size} · ${data.email_sent} email · ${data.whatsapp_sent} whatsapp`
      );
      onClose?.();
    } catch (e) {
      toast.error(e.message || 'Broadcast failed');
    } finally {
      setSending(false);
    }
  };

  if (!open) return null;

  const activeKind = KIND_OPTIONS.find((k) => k.key === kind);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose} data-testid="nudge-composer-modal">
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 w-full max-w-4xl my-8 max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white dark:bg-slate-800 flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 z-10">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-fuchsia-600" /> Nudge Composer
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800" data-testid="nudge-close-btn"><X size={18} /></button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 p-5">
          {/* Left column — form */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nudge Type</label>
              <div className="flex flex-wrap gap-2">
                {KIND_OPTIONS.map((k) => (
                  <button
                    key={k.key}
                    onClick={() => applyTemplate(k.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      kind === k.key
                        ? 'bg-fuchsia-600 text-white border-fuchsia-600'
                        : 'bg-white text-slate-700 dark:bg-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:border-fuchsia-400'
                    }`}
                    data-testid={`nudge-kind-${k.key}`}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              {activeKind && (
                <p className="text-[11px] text-slate-500 mt-2">
                  <Info size={11} className="inline mr-1" />{activeKind.hint}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Subject</label>
              <input
                type="text" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Diwali fragrance selection is live"
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                data-testid="nudge-subject-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Email body (HTML allowed — wrapped in Addrika template)
              </label>
              <textarea
                rows={7} value={bodyHtml} onChange={(e) => setBodyHtml(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm font-mono"
                data-testid="nudge-body-input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                WhatsApp text (plain, ≤ 1000 chars) — optional
              </label>
              <textarea
                rows={3} value={whatsappBody} onChange={(e) => setWhatsappBody(e.target.value.slice(0, 1000))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white text-sm"
                placeholder="Short punchy line — WhatsApp cuts off long messages."
                data-testid="nudge-whatsapp-input"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={channels.email}
                  onChange={(e) => setChannels((c) => ({ ...c, email: e.target.checked }))}
                  className="w-4 h-4 accent-fuchsia-600" data-testid="nudge-channel-email" />
                <Mail size={14} /> Email
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={channels.whatsapp}
                  onChange={(e) => setChannels((c) => ({ ...c, whatsapp: e.target.checked }))}
                  className="w-4 h-4 accent-fuchsia-600" data-testid="nudge-channel-whatsapp" />
                <MessageCircle size={14} /> WhatsApp
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Audience</label>
              <select
                value={audience} onChange={(e) => setAudience(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                data-testid="nudge-audience-select"
              >
                {AUDIENCE_OPTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
              </select>

              {audience === 'product' && (
                <select
                  value={productId} onChange={(e) => setProductId(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  data-testid="nudge-product-select"
                >
                  <option value="">Select SKU</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.net_weight}
                    </option>
                  ))}
                </select>
              )}
              {audience === 'pincode' && (
                <input
                  type="text" inputMode="numeric" maxLength={6}
                  value={pincodePrefix}
                  onChange={(e) => setPincodePrefix(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="e.g. 4 for Maharashtra, 400 for Mumbai region"
                  className="w-full mt-2 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
                  data-testid="nudge-pincode-input"
                />
              )}
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={() => setPreview((p) => !p)}
                className="flex-1 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-sm"
                data-testid="nudge-preview-toggle"
              >
                {preview ? 'Hide preview' : 'Preview email'}
              </button>
              <button
                disabled={sending} onClick={send}
                className="flex-1 py-2 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-700 text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                data-testid="nudge-send-btn"
              >
                <Send size={14} /> {sending ? 'Sending…' : 'Send broadcast'}
              </button>
            </div>

            {/* Best-time-to-send recommendation for this audience */}
            <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-lg p-3 mt-2"
              data-testid="nudge-best-time">
              <div className="flex items-center gap-2 text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">
                <Clock size={12} /> Best time to send · learned from open history
              </div>
              {bestTimeLoading ? (
                <div className="text-xs text-slate-500 mt-1">Analysing open patterns…</div>
              ) : bestTime ? (
                <>
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                    {bestTime.default
                      ? `Not enough open data for this cohort — using platform default (${bestTime.reason || 'Tue-Thu 10-13 IST'})`
                      : `Based on ${bestTime.sample_size} open events across ${bestTime.audience_size || 0} retailer(s)`}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(bestTime.recommendations || []).map((r, i) => (
                      <div
                        key={`${r.day}-${r.hour_start}-${i}`}
                        className={`text-xs px-2.5 py-1 rounded-full border ${
                          i === 0
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-indigo-800 border-indigo-200 dark:bg-slate-800 dark:text-indigo-300 dark:border-indigo-800/40'
                        }`}
                        data-testid={`best-time-slot-${i}`}
                      >
                        {r.day} · {String(r.hour_start).padStart(2, '0')}:00–{String(r.hour_end).padStart(2, '0')}:00 IST
                        {r.confidence > 0 && !bestTime.default && (
                          <span className={`ml-1 ${i === 0 ? 'text-white/80' : 'text-indigo-500'}`}>
                            · {Math.round(r.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 mt-1">Pick an audience to see the best time.</div>
              )}
            </div>

            {preview && (
              <div className="mt-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900 text-xs text-slate-500">Email preview</div>
                <iframe
                  title="preview"
                  className="w-full h-72 bg-white"
                  srcDoc={`<html><body style='font-family:Arial;padding:20px;background:#f5f5f5;'><table cellpadding='0' cellspacing='0' style='max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;'><tr><td style='background:#1e3a52;padding:22px;text-align:center;'><h1 style='color:#d4af37;margin:0;letter-spacing:1.8px;'>ADDRIKA</h1><p style='color:#fff;margin:6px 0 0;font-size:13px;'>${(subject || '').replace(/[<>]/g, '')}</p></td></tr><tr><td style='padding:26px;color:#1e3a52;'><p style='margin:0 0 12px;font-size:14px;'>Namaste [Retailer Name],</p><div style='font-size:14px;line-height:1.55;color:#333;'>${bodyHtml}</div></td></tr></table></body></html>`}
                />
              </div>
            )}
          </div>

          {/* Right column — recent broadcast log */}
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-3">Recent broadcasts</h3>
            <div className="space-y-2" data-testid="nudge-history-list">
              {history.length === 0 && (
                <p className="text-xs text-slate-500">No broadcasts yet.</p>
              )}
              {history.map((h) => (
                <div key={h.broadcast_id} className="text-xs border border-slate-100 dark:border-slate-700 rounded-lg p-2"
                  data-testid={`nudge-history-row-${h.broadcast_id}`}>
                  <div className="font-medium text-slate-800 dark:text-white truncate">{h.subject}</div>
                  <div className="text-slate-500 mt-0.5">
                    {new Date(h.sent_at).toLocaleString('en-IN')} · {h.kind} · {h.audience}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {h.audience_size} recipients · {h.email_sent} email · {h.whatsapp_sent} whatsapp
                    {h.failed > 0 && <span className="text-rose-600"> · {h.failed} failed</span>}
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-[10px]" data-testid={`nudge-analytics-${h.broadcast_id}`}>
                    <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded" title="Unique opens / delivered">
                      Opens {h.unique_opens || 0} · {h.open_rate_pct || 0}%
                    </span>
                    <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded" title="Unique clicks / delivered">
                      Clicks {h.unique_clicks || 0} · {h.click_rate_pct || 0}%
                    </span>
                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded" title="Click-through: clicks / opens">
                      CTR {h.ctr_pct || 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
