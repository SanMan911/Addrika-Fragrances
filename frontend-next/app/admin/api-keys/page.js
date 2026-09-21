'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, Plus, RefreshCw, Copy, Ban, Trash2, ShieldCheck, Check, X, Boxes,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

function fmtDate(s) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState([]);
  const [scopes, setScopes] = useState(['stock:read']);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKey, setNewKey] = useState(null); // one-time raw key reveal

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/api-keys`);
      if (!res.ok) throw new Error('Failed to load keys');
      const data = await res.json();
      setKeys(data.items || []);
      setScopes(data.available_scopes || ['stock:read']);
    } catch (e) {
      toast.error(e.message || 'Could not load API keys');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createKey = async () => {
    if (newName.trim().length < 2) { toast.error('Give the key a name (e.g. Field Sales Manager)'); return; }
    setCreating(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), scopes: ['stock:read'] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Could not create key');
      setNewKey({ name: data.name, key: data.key });
      setNewName('');
      toast.success('API key created — copy it now, it won\u2019t be shown again');
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  };

  const copyKey = (val) => {
    navigator.clipboard?.writeText(val);
    toast.success('Copied to clipboard');
  };

  const revoke = async (id) => {
    if (!confirm('Revoke this key? Apps using it will immediately lose access.')) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/api-keys/${id}/revoke`, { method: 'POST' });
      if (!res.ok) throw new Error('Revoke failed');
      toast.success('Key revoked');
      load();
    } catch (e) { toast.error(e.message); }
  };

  const del = async (id) => {
    if (!confirm('Delete this key permanently?')) return;
    try {
      const res = await authFetch(`${API_URL}/api/admin/api-keys/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      toast.success('Key deleted');
      load();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6" data-testid="admin-api-keys-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1e3a52] flex items-center justify-center">
            <KeyRound className="w-6 h-6 text-[#D4AF37]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1e3a52]">External API Keys</h1>
            <p className="text-sm text-gray-500">Grant related apps (Field Sales Manager, etc.) live read access to stock.</p>
          </div>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50" data-testid="api-keys-refresh">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Create */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-[#1e3a52] uppercase tracking-wider mb-3">Generate a new key</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Key name — e.g. Field Sales Manager"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-[#1e3a52] focus:border-[#D4AF37] outline-none"
            data-testid="api-key-name-input"
          />
          <button
            onClick={createKey}
            disabled={creating}
            className="flex items-center justify-center gap-2 px-5 py-2 rounded-lg bg-[#1e3a52] text-white font-semibold hover:bg-[#16293b] disabled:opacity-50"
            data-testid="api-key-create-btn"
          >
            <Plus className="w-4 h-4" /> {creating ? 'Creating…' : 'Create key'}
          </button>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          Scope: <code className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">{scopes.join(', ')}</code> — read-only stock access.
        </div>
      </div>

      {/* One-time reveal */}
      {newKey && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5" data-testid="api-key-reveal">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-900">Copy your new key now — it won&rsquo;t be shown again.</p>
              <p className="text-xs text-amber-700 mb-2">Key for: {newKey.name}</p>
              <code className="block bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm text-[#1e3a52] break-all" data-testid="api-key-reveal-value">{newKey.key}</code>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => copyKey(newKey.key)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#D4AF37] text-white text-sm font-semibold" data-testid="api-key-copy-btn">
                <Copy className="w-4 h-4" /> Copy
              </button>
              <button onClick={() => setNewKey(null)} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-300 text-amber-800 text-sm">
                <X className="w-4 h-4" /> Dismiss
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-amber-800">
            Use it as header <code className="bg-white px-1 rounded">X-API-Key</code> against
            <code className="bg-white px-1 rounded ml-1">GET /api/external/v1/stock</code>.
          </p>
        </div>
      )}

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 text-sm font-semibold text-[#1e3a52]">
          <Boxes className="w-4 h-4" /> Active & revoked keys
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
        ) : keys.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm" data-testid="api-keys-empty">No API keys yet. Create one above.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {keys.map((k) => (
              <div key={k.id} className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap" data-testid={`api-key-row-${k.id}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#1e3a52]">{k.name}</span>
                    {k.is_active ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800"><Check className="w-3 h-3" /> Active</span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800"><Ban className="w-3 h-3" /> Revoked</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Prefix: <code className="bg-gray-100 px-1 rounded">{k.key_prefix}</code></span>
                    <span>Scopes: {(k.scopes || []).join(', ')}</span>
                    <span>Created: {fmtDate(k.created_at)}</span>
                    <span>Last used: {fmtDate(k.last_used_at)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {k.is_active && (
                    <button onClick={() => revoke(k.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-300 text-orange-700 text-sm hover:bg-orange-50" data-testid={`api-key-revoke-${k.id}`}>
                      <Ban className="w-4 h-4" /> Revoke
                    </button>
                  )}
                  <button onClick={() => del(k.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm hover:bg-red-50" data-testid={`api-key-delete-${k.id}`}>
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
