'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  RefreshCw,
  Boxes,
  IndianRupee,
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const EMPTY_PRODUCT = {
  id: '',
  product_id: '',
  name: '',
  image: '',
  net_weight: '',
  units_per_box: 12,
  mrp_per_unit: 0,
  price_per_box: 0,
  price_per_half_box: 0,
  min_order: 0.5,
  gst_rate: 5,
  hsn_code: '33074100',
  is_active: true,
};

// B2B price = 76.52% of MRP
const B2B_DISCOUNT_RATE = 0.7652;
const calcBoxPrice = (units, mrp) =>
  Math.round((Number(units) || 0) * (Number(mrp) || 0) * B2B_DISCOUNT_RATE);
const calcHalfBoxPrice = (units, mrp) =>
  Math.round(((Number(units) || 0) / 2) * (Number(mrp) || 0) * B2B_DISCOUNT_RATE);

export default function AdminB2BCatalogPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | EMPTY_PRODUCT | existing row
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/b2b/products`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      toast.error('Failed to load B2B catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSave = async () => {
    const p = editing;
    if (!p?.id || !p?.product_id || !p?.name || !p?.net_weight) {
      toast.error('id, product_id, name, and net_weight are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...p,
        units_per_box: Number(p.units_per_box),
        mrp_per_unit: Number(p.mrp_per_unit),
        price_per_box: Number(p.price_per_box),
        price_per_half_box: Number(p.price_per_half_box),
        min_order: Number(p.min_order),
        gst_rate: Number(p.gst_rate),
      };
      const res = await authFetch(`${API_URL}/api/admin/b2b/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Save failed');
      }
      toast.success(`Saved ${p.name} (${p.net_weight})`);
      setEditing(null);
      fetchProducts();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId, name) => {
    if (!confirm(`Delete "${name}" from B2B catalog?\n\nThis affects future orders only — existing order history is preserved.`))
      return;
    try {
      const res = await authFetch(
        `${API_URL}/api/admin/b2b/products/${productId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Delete failed');
      }
      toast.success(`Deleted ${name}`);
      fetchProducts();
    } catch (e) {
      toast.error(e.message || 'Delete failed');
    }
  };

  const recalcPrices = () => {
    if (!editing) return;
    setEditing({
      ...editing,
      price_per_box: calcBoxPrice(editing.units_per_box, editing.mrp_per_unit),
      price_per_half_box: calcHalfBoxPrice(editing.units_per_box, editing.mrp_per_unit),
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-b2b-catalog-page">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/b2b"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            data-testid="back-to-b2b"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Boxes size={22} /> B2B Catalog
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
              Wholesale SKUs offered to retailers — pricing auto-derived at
              76.52% of MRP. Quantity-tier discounts live in{' '}
              <Link
                href="/admin/settings/b2b"
                className="underline hover:text-amber-600"
              >
                B2B Settings
              </Link>
              .
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchProducts}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1"
            data-testid="catalog-refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button
            onClick={() => setEditing({ ...EMPTY_PRODUCT })}
            className="px-3 py-1.5 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1 font-medium"
            data-testid="catalog-add"
          >
            <Plus size={14} /> Add SKU
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total SKUs" value={products.length} />
        <Stat
          label="Active"
          value={products.filter((p) => p.is_active !== false).length}
          tone="emerald"
        />
        <Stat
          label="Inactive"
          value={products.filter((p) => p.is_active === false).length}
          tone={products.some((p) => p.is_active === false) ? 'amber' : 'slate'}
        />
        <Stat
          label="Avg ₹/box"
          value={
            products.length === 0
              ? 0
              : Math.round(
                  products.reduce((s, p) => s + (Number(p.price_per_box) || 0), 0) /
                    products.length
                )
          }
          prefix="₹"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="animate-spin text-slate-400" size={24} />
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500">
          No B2B products yet. Click <b>Add SKU</b> to create one.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 text-left">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Weight</th>
                <th className="px-4 py-3 text-right">Units/Box</th>
                <th className="px-4 py-3 text-right">MRP</th>
                <th className="px-4 py-3 text-right">₹/Box</th>
                <th className="px-4 py-3 text-right">₹/Half</th>
                <th className="px-4 py-3 text-right">GST</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {products.map((p) => (
                <tr
                  key={p.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-900/40"
                  data-testid={`catalog-row-${p.id}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {p.name}
                  </td>
                  <td className="px-4 py-3">{p.net_weight}</td>
                  <td className="px-4 py-3 text-right">{p.units_per_box}</td>
                  <td className="px-4 py-3 text-right">₹{p.mrp_per_unit}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">
                    ₹{p.price_per_box}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-500">
                    ₹{p.price_per_half_box}
                  </td>
                  <td className="px-4 py-3 text-right">{p.gst_rate}%</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.is_active === false
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {p.is_active === false ? 'Inactive' : 'Active'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing({ ...p })}
                        className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                        title="Edit"
                        data-testid={`catalog-edit-${p.id}`}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600"
                        title="Delete"
                        data-testid={`catalog-delete-${p.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal editor */}
      {editing && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto"
          data-testid="catalog-editor"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditing(null);
          }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                {products.find((x) => x.id === editing.id)
                  ? `Edit ${editing.name}`
                  : 'Add B2B SKU'}
              </h2>
              <button
                onClick={() => setEditing(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                data-testid="catalog-editor-close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="B2B SKU id" hint="kebab-case, suffix -b2b" required>
                  <input
                    type="text"
                    value={editing.id}
                    onChange={(e) => setEditing({ ...editing, id: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    className={inputCls}
                    placeholder="kesar-chandan-b2b"
                    data-testid="catalog-field-id"
                  />
                </Field>
                <Field label="Linked product slug" hint="matches /products/[slug]" required>
                  <input
                    type="text"
                    value={editing.product_id}
                    onChange={(e) => setEditing({ ...editing, product_id: e.target.value.toLowerCase() })}
                    className={inputCls}
                    placeholder="kesar-chandan"
                    data-testid="catalog-field-product-id"
                  />
                </Field>
                <Field label="Display name" required>
                  <input
                    type="text"
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className={inputCls}
                    data-testid="catalog-field-name"
                  />
                </Field>
                <Field label="Net weight" hint="e.g. 50g, 200g" required>
                  <input
                    type="text"
                    value={editing.net_weight}
                    onChange={(e) => setEditing({ ...editing, net_weight: e.target.value })}
                    className={inputCls}
                    data-testid="catalog-field-weight"
                  />
                </Field>
              </div>
              <Field label="Image URL">
                <input
                  type="url"
                  value={editing.image || ''}
                  onChange={(e) => setEditing({ ...editing, image: e.target.value })}
                  className={inputCls}
                  placeholder="https://..."
                  data-testid="catalog-field-image"
                />
              </Field>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Field label="Units per box" required>
                  <input
                    type="number"
                    min="1"
                    value={editing.units_per_box}
                    onChange={(e) => setEditing({ ...editing, units_per_box: e.target.value })}
                    className={inputCls}
                    data-testid="catalog-field-units"
                  />
                </Field>
                <Field label="MRP per unit (₹)" required>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editing.mrp_per_unit}
                    onChange={(e) => setEditing({ ...editing, mrp_per_unit: e.target.value })}
                    className={inputCls}
                    data-testid="catalog-field-mrp"
                  />
                </Field>
                <Field label="Min order (boxes)">
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editing.min_order}
                    onChange={(e) => setEditing({ ...editing, min_order: e.target.value })}
                    className={inputCls}
                    data-testid="catalog-field-minorder"
                  />
                </Field>
                <Field label="GST rate (%)" required>
                  <input
                    type="number"
                    min="0"
                    max="28"
                    value={editing.gst_rate}
                    onChange={(e) => setEditing({ ...editing, gst_rate: e.target.value })}
                    className={inputCls}
                    data-testid="catalog-field-gst"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <Field label="Price per box (₹)" hint="auto = 76.52% × units × MRP">
                  <div className="flex items-center gap-1 text-slate-400">
                    <IndianRupee size={14} />
                    <input
                      type="number"
                      min="0"
                      value={editing.price_per_box}
                      onChange={(e) => setEditing({ ...editing, price_per_box: e.target.value })}
                      className={inputCls}
                      data-testid="catalog-field-pricebox"
                    />
                  </div>
                </Field>
                <Field label="Price per half-box (₹)">
                  <div className="flex items-center gap-1 text-slate-400">
                    <IndianRupee size={14} />
                    <input
                      type="number"
                      min="0"
                      value={editing.price_per_half_box}
                      onChange={(e) => setEditing({ ...editing, price_per_half_box: e.target.value })}
                      className={inputCls}
                      data-testid="catalog-field-pricehalf"
                    />
                  </div>
                </Field>
                <button
                  type="button"
                  onClick={recalcPrices}
                  className="px-3 py-2 text-xs rounded-lg bg-amber-100 text-amber-800 hover:bg-amber-200 self-end h-9 inline-flex items-center gap-1"
                  data-testid="catalog-field-recalc"
                  title="Auto-calculate at 76.52% of MRP"
                >
                  <RefreshCw size={12} /> Re-calc
                </button>
              </div>

              <Field label="HSN code">
                <input
                  type="text"
                  value={editing.hsn_code || ''}
                  onChange={(e) => setEditing({ ...editing, hsn_code: e.target.value })}
                  className={inputCls}
                  placeholder="33074100"
                  data-testid="catalog-field-hsn"
                />
              </Field>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.is_active !== false}
                  onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })}
                  data-testid="catalog-field-active"
                />
                <span className="text-slate-700 dark:text-slate-200">Active (visible to retailers)</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 sticky bottom-0 bg-white dark:bg-slate-800">
              <button
                onClick={() => setEditing(null)}
                className="px-4 py-2 text-sm rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                data-testid="catalog-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center gap-1 font-medium"
                data-testid="catalog-save"
              >
                <Save size={14} />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-900 outline-none focus:border-emerald-500 text-sm';

function Field({ label, hint, required, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Stat({ label, value, tone = 'slate', prefix = '' }) {
  const toneMap = {
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    slate: 'text-slate-700 dark:text-slate-200',
  };
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`text-xl font-bold ${toneMap[tone]}`}>
        {prefix}
        {value}
      </p>
    </div>
  );
}
