'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Tag, BookOpen, RefreshCw, Send, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const STATUS_STYLES = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
  closed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
};

const fmtDate = (v) =>
  v ? new Date(v).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function Thread({ ticket, onReplied }) {
  const [body, setBody] = useState('');
  const [closing, setClosing] = useState(false);
  const [sending, setSending] = useState(false);

  const send = async (closeTicket) => {
    if (body.trim().length < 2) return;
    setSending(true);
    setClosing(closeTicket);
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/app-support/grievances/${ticket.id}/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: body.trim(), close_ticket: closeTicket }),
        }
      );
      if (!res.ok) throw new Error((await res.json()).detail || 'Reply failed');
      const data = await res.json();
      toast.success(
        data.retailer_notified
          ? `Reply sent — ${ticket.business_name} has been emailed`
          : 'Reply saved (email could not be delivered)'
      );
      setBody('');
      onReplied();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSending(false);
      setClosing(false);
    }
  };

  const isClosed = ticket.status === 'closed';

  return (
    <div
      className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
      data-testid={`grievance-thread-${ticket.id}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-700">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">{ticket.subject}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {ticket.business_name} · {ticket.gstin || '—'}
            {ticket.order_number ? ` · Order ${ticket.order_number}` : ''}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {ticket.category} · raised {fmtDate(ticket.created_at)}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLES[ticket.status] || ''}`}
          data-testid={`grievance-status-${ticket.id}`}
        >
          {ticket.status}
        </span>
      </div>

      <div className="py-4 space-y-3 max-h-[26rem] overflow-y-auto" data-testid="grievance-messages">
        {(ticket.thread || []).map((m) => (
          <div
            key={m.id}
            className={`flex ${m.author === 'admin' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 ${
                m.author === 'admin'
                  ? 'bg-[#1e3a52] text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100'
              }`}
            >
              <p className="text-[11px] font-semibold opacity-70 uppercase tracking-wide">
                {m.author === 'admin' ? 'Aarohmm Team' : m.author_name || 'Retailer'}
                {m.is_origin ? ' · original complaint' : ''}
              </p>
              <p className="text-sm whitespace-pre-wrap mt-1 leading-relaxed">{m.body}</p>
              <p className="text-[10px] opacity-60 mt-1.5">{fmtDate(m.created_at)}</p>
            </div>
          </div>
        ))}
      </div>

      {ticket.image_urls?.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-4">
          {ticket.image_urls.map((u) => (
            <a key={u} href={u} target="_blank" rel="noopener noreferrer">
              <img
                src={u}
                alt="Grievance attachment"
                className="w-20 h-20 object-cover rounded-lg border border-slate-200 dark:border-slate-600"
              />
            </a>
          ))}
        </div>
      )}

      {isClosed ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 pt-4 border-t border-slate-200 dark:border-slate-700">
          <Lock className="w-4 h-4" />
          Closed {fmtDate(ticket.closed_at)}
          {ticket.closed_by ? ` by ${ticket.closed_by}` : ''}
        </div>
      ) : (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          <textarea
            data-testid="grievance-reply-input"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="Reply to this shop — they'll get it in the app and by email"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-white"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              data-testid="grievance-send-reply"
              disabled={sending || body.trim().length < 2}
              onClick={() => send(false)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a52] text-[#d4af37] text-sm font-semibold disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {sending && !closing ? 'Sending…' : 'Send reply'}
            </button>
            <button
              data-testid="grievance-reply-and-close"
              disabled={sending || body.trim().length < 2}
              onClick={() => send(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-300 text-sm font-semibold disabled:opacity-40"
            >
              <CheckCircle2 className="w-4 h-4" />
              {sending && closing ? 'Closing…' : 'Reply & close ticket'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Grievances() {
  const [tickets, setTickets] = useState([]);
  const [counts, setCounts] = useState({ total: 0, unread: 0 });
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const qs = filter ? `?status=${filter}` : '';
      const res = await authFetch(`${API_URL}/api/admin/app-support/grievances${qs}`);
      if (!res.ok) throw new Error('Could not load grievances');
      const data = await res.json();
      setTickets(data.tickets || []);
      setCounts(data.counts || { total: 0, unread: 0 });
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (id) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/app-support/grievances/${id}`);
      if (!res.ok) throw new Error('Could not open ticket');
      setSelected(await res.json());
      load();
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div className="grid lg:grid-cols-[22rem_1fr] gap-5" data-testid="admin-grievances">
      <div>
        <div className="flex items-center gap-2 mb-3">
          {['', 'open', 'in_progress', 'closed'].map((s) => (
            <button
              key={s || 'all'}
              data-testid={`grievance-filter-${s || 'all'}`}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                filter === s
                  ? 'bg-[#1e3a52] text-[#d4af37]'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {s === '' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          {counts.total} ticket{counts.total === 1 ? '' : 's'} · {counts.unread} awaiting reply
        </p>
        <div className="space-y-2 max-h-[38rem] overflow-y-auto">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {!loading && tickets.length === 0 && (
            <p className="text-sm text-slate-500" data-testid="grievances-empty">
              No grievances {filter ? `with status “${filter}”` : 'yet'}.
            </p>
          )}
          {tickets.map((t) => (
            <button
              key={t.id}
              data-testid={`grievance-item-${t.id}`}
              onClick={() => open(t.id)}
              className={`w-full text-left p-3 rounded-xl border transition-colors ${
                selected?.id === t.id
                  ? 'border-[#d4af37] bg-amber-50 dark:bg-slate-800'
                  : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800 dark:text-white line-clamp-1">
                  {t.subject}
                </p>
                {t.unread_for_admin && (
                  <span className="shrink-0 w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                {t.business_name} · {t.category}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_STYLES[t.status] || ''}`}
                >
                  {t.status}
                </span>
                <span className="text-[10px] text-slate-400">
                  {t.reply_count} repl{t.reply_count === 1 ? 'y' : 'ies'}
                  {t.image_count > 0 ? ` · ${t.image_count} photo${t.image_count === 1 ? '' : 's'}` : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        {selected ? (
          <Thread ticket={selected} onReplied={() => open(selected.id)} />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-10 text-center">
            <MessageSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 dark:text-slate-400 mt-3 text-sm">
              Select a ticket to read the whole conversation and reply.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

const EMPTY_SCHEME = {
  title: '',
  description: '',
  terms: '',
  min_cartons: '',
  discount_pct: '',
  valid_from: '',
  valid_to: '',
  is_active: true,
  min_boxes: '',
  min_order_value: '',
  max_discount_inr: '',
  applies_to: 'all',
  categories: [],
  skus: [],
  priority: 100,
};

function Schemes() {
  const [schemes, setSchemes] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY_SCHEME);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))];

  const load = useCallback(async () => {
    const res = await authFetch(`${API_URL}/api/admin/app-support/schemes`);
    if (res.ok) setSchemes((await res.json()).schemes || []);
    // Brochure items double as the SKU/category picker source.
    const pr = await authFetch(`${API_URL}/api/admin/app-support/brochure`);
    if (pr.ok) setProducts((await pr.json()).items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        min_cartons: form.min_cartons ? Number(form.min_cartons) : null,
        discount_pct: form.discount_pct ? Number(form.discount_pct) : null,
        valid_from: form.valid_from || null,
        valid_to: form.valid_to || null,
        min_boxes: form.min_boxes === '' ? null : Number(form.min_boxes),
        min_order_value: form.min_order_value === '' ? null : Number(form.min_order_value),
        max_discount_inr: form.max_discount_inr === '' ? null : Number(form.max_discount_inr),
        applies_to: form.applies_to || 'all',
        categories: form.applies_to === 'category' ? form.categories : [],
        skus: form.applies_to === 'sku' ? form.skus : [],
        priority: Number(form.priority) || 100,
      };
      const res = await authFetch(
        `${API_URL}/api/admin/app-support/schemes${editing ? `/${editing}` : ''}`,
        {
          method: editing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error((await res.json()).detail || 'Save failed');
      toast.success(editing ? 'Scheme updated' : 'Scheme published to the app');
      setForm(EMPTY_SCHEME);
      setEditing(null);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    const res = await authFetch(`${API_URL}/api/admin/app-support/schemes/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Scheme deleted');
      load();
    } else toast.error('Could not delete');
  };

  return (
    <div className="grid lg:grid-cols-2 gap-5" data-testid="admin-schemes">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <h3 className="font-bold text-slate-800 dark:text-white mb-4">
          {editing ? 'Edit scheme' : 'Publish a new scheme'}
        </h3>
        <div className="space-y-3">
          {[
            ['title', 'Title', 'text'],
            ['description', 'Description', 'textarea'],
            ['terms', 'Terms & conditions', 'textarea'],
            ['discount_pct', 'Discount %', 'number'],
            ['min_boxes', 'Minimum boxes to unlock', 'number'],
            ['min_order_value', 'Minimum qualifying value (₹)', 'number'],
            ['max_discount_inr', 'Cap the discount at (₹)', 'number'],
            ['priority', 'Priority (higher wins)', 'number'],
            ['valid_from', 'Valid from', 'date'],
            ['valid_to', 'Valid to', 'date'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                {label}
              </label>
              {type === 'textarea' ? (
                <textarea
                  data-testid={`scheme-${key}`}
                  rows={2}
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
                />
              ) : (
                <input
                  data-testid={`scheme-${key}`}
                  type={type}
                  value={form[key] || ''}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
                />
              )}
            </div>
          ))}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Applies to
            </label>
            <select
              data-testid="scheme-applies-to"
              value={form.applies_to}
              onChange={(e) => setForm({ ...form, applies_to: e.target.value })}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 px-3 py-2 text-sm dark:text-white"
            >
              <option value="all">Everything in the catalogue</option>
              <option value="category">Specific categories</option>
              <option value="sku">Specific products</option>
            </select>
          </div>

          {form.applies_to === 'category' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Categories
              </label>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => {
                  const on = form.categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      data-testid={`scheme-cat-${c}`}
                      onClick={() =>
                        setForm({
                          ...form,
                          categories: on
                            ? form.categories.filter((x) => x !== c)
                            : [...form.categories, c],
                        })
                      }
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                        on
                          ? 'bg-[#1e3a52] text-[#d4af37]'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {form.applies_to === 'sku' && (
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Products ({form.skus.length} selected)
              </label>
              <div className="max-h-48 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                {products.map((p) => (
                  <label
                    key={p.sku}
                    className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200"
                  >
                    <input
                      type="checkbox"
                      data-testid={`scheme-sku-${p.sku}`}
                      checked={form.skus.includes(p.sku)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          skus: e.target.checked
                            ? [...form.skus, p.sku]
                            : form.skus.filter((x) => x !== p.sku),
                        })
                      }
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              data-testid="scheme-active"
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            Visible in the app
          </label>
          <div className="flex gap-2 pt-1">
            <button
              data-testid="scheme-save"
              disabled={saving || form.title.trim().length < 3}
              onClick={save}
              className="px-4 py-2 rounded-lg bg-[#1e3a52] text-[#d4af37] text-sm font-semibold disabled:opacity-40"
            >
              {saving ? 'Saving…' : editing ? 'Update scheme' : 'Publish scheme'}
            </button>
            {editing && (
              <button
                onClick={() => {
                  setEditing(null);
                  setForm(EMPTY_SCHEME);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm dark:text-white"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {schemes.length === 0 && (
          <p className="text-sm text-slate-500" data-testid="schemes-empty">
            No schemes yet. Anything you publish here shows up in the retailer app.
          </p>
        )}
        {schemes.map((s) => (
          <div
            key={s.id}
            data-testid={`scheme-row-${s.id}`}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-800 dark:text-white">{s.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {s.discount_pct ? `${s.discount_pct}% off · ` : ''}
                  {s.min_boxes ? `min ${s.min_boxes} boxes · ` : ''}
                  {s.applies_to === 'all'
                    ? 'all products'
                    : s.applies_to === 'category'
                      ? `${(s.categories || []).length} categor${(s.categories || []).length === 1 ? 'y' : 'ies'}`
                      : `${(s.skus || []).length} product${(s.skus || []).length === 1 ? '' : 's'}`}
                  {' · '}
                  {s.is_active ? 'live' : 'hidden'}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  data-testid={`scheme-edit-${s.id}`}
                  onClick={() => {
                    setEditing(s.id);
                    setForm({
                      ...s,
                      valid_from: s.valid_from ? String(s.valid_from).slice(0, 10) : '',
                      valid_to: s.valid_to ? String(s.valid_to).slice(0, 10) : '',
                      min_cartons: s.min_cartons ?? '',
                      discount_pct: s.discount_pct ?? '',
                      min_boxes: s.min_boxes ?? '',
                      min_order_value: s.min_order_value ?? '',
                      max_discount_inr: s.max_discount_inr ?? '',
                      applies_to: s.applies_to || 'all',
                      categories: s.categories || [],
                      skus: s.skus || [],
                      priority: s.priority ?? 100,
                    });
                  }}
                  className="text-xs font-semibold text-[#1e3a52] dark:text-[#d4af37]"
                >
                  Edit
                </button>
                <button
                  data-testid={`scheme-delete-${s.id}`}
                  onClick={() => remove(s.id)}
                  className="text-xs font-semibold text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Brochure() {
  const [items, setItems] = useState([]);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch(`${API_URL}/api/admin/app-support/brochure`);
    if (res.ok) setItems((await res.json()).items || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/app-support/brochure/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      toast.success(`Brochure rebuilt — ${data.items} products, ${data.with_image} with images`);
      load();
    } catch {
      toast.error('Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div data-testid="admin-brochure">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Built automatically from your website products — image, fragrance notes and a short
          detail. Runs every 15 minutes.
        </p>
        <button
          data-testid="brochure-sync-btn"
          onClick={sync}
          disabled={syncing}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a52] text-[#d4af37] text-sm font-semibold disabled:opacity-40"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      </div>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {items.map((i) => (
          <div
            key={i.sku}
            data-testid={`brochure-item-${i.sku}`}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex gap-3"
          >
            {i.image_url ? (
              <img
                src={i.image_url}
                alt={i.name}
                className="w-16 h-16 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-700 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-semibold text-sm text-slate-800 dark:text-white line-clamp-1">
                {i.name}
              </p>
              {i.notes && (
                <p className="text-[11px] text-[#1e3a52] dark:text-[#d4af37] mt-0.5 line-clamp-1">
                  {i.notes}
                </p>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-3">
                {i.detail || 'No description on the website yet.'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TABS = [
  { key: 'grievances', label: 'Grievances', icon: MessageSquare },
  { key: 'schemes', label: 'Trade Schemes', icon: Tag },
  { key: 'brochure', label: 'Brochure', icon: BookOpen },
];

export default function AppSupportPage() {
  const [tab, setTab] = useState('grievances');

  return (
    <div className="p-4 sm:p-6 max-w-[100rem] mx-auto" data-testid="app-support-page">
      <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Aarohmm App Desk</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
        Grievances, trade schemes and the auto-built brochure for the retailer app.
      </p>

      <div className="flex gap-2 mt-5 mb-6 border-b border-slate-200 dark:border-slate-700">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            data-testid={`app-support-tab-${key}`}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              tab === key
                ? 'border-[#d4af37] text-[#1e3a52] dark:text-[#d4af37]'
                : 'border-transparent text-slate-500 dark:text-slate-400'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'grievances' && <Grievances />}
      {tab === 'schemes' && <Schemes />}
      {tab === 'brochure' && <Brochure />}
    </div>
  );
}
