'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Package, Plus, Edit2, Trash2, Eye, EyeOff, Clock, Check,
  ChevronDown, ChevronUp, X, Save, Loader2, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const CATEGORIES = ['agarbatti', 'dhoop', 'bakhoor'];
const TYPES = ['agarbatti', 'dhoop', 'bakhoor'];

function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ===================== Size Editor =====================
function SizeEditor({ sizes, onChange }) {
  const addSize = () => {
    onChange([...sizes, { size: '', mrp: 0, price: 0, images: [] }]);
  };

  const removeSize = (idx) => {
    onChange(sizes.filter((_, i) => i !== idx));
  };

  const updateSize = (idx, field, value) => {
    const updated = [...sizes];
    updated[idx] = { ...updated[idx], [field]: value };
    onChange(updated);
  };

  const updateSizeImages = (idx, value) => {
    const updated = [...sizes];
    updated[idx] = { ...updated[idx], images: value.split('\n').filter(Boolean) };
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Sizes & Pricing</label>
        <button
          type="button"
          onClick={addSize}
          className="text-xs px-3 py-1 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
          data-testid="add-size-btn"
        >
          <Plus size={12} className="inline mr-1" />Add Size
        </button>
      </div>
      {sizes.map((s, idx) => (
        <div key={idx} className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Variant {idx + 1}</span>
            <button type="button" onClick={() => removeSize(idx)} className="text-red-400 hover:text-red-300">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text" placeholder="Size (e.g. 50g)"
              value={s.size} onChange={(e) => updateSize(idx, 'size', e.target.value)}
              className="px-2 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white"
              data-testid={`size-name-${idx}`}
            />
            <input
              type="number" placeholder="MRP"
              value={s.mrp || ''} onChange={(e) => updateSize(idx, 'mrp', parseFloat(e.target.value) || 0)}
              className="px-2 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white"
              data-testid={`size-mrp-${idx}`}
            />
            <input
              type="number" placeholder="Price"
              value={s.price || ''} onChange={(e) => updateSize(idx, 'price', parseFloat(e.target.value) || 0)}
              className="px-2 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white"
              data-testid={`size-price-${idx}`}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text" placeholder="Size Label (optional)"
              value={s.sizeLabel || ''} onChange={(e) => updateSize(idx, 'sizeLabel', e.target.value)}
              className="px-2 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white"
            />
            <input
              type="number" placeholder="Weight (g, optional)"
              value={s.weight || ''} onChange={(e) => updateSize(idx, 'weight', parseInt(e.target.value) || null)}
              className="px-2 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white"
            />
          </div>
          <textarea
            placeholder="Image URLs (one per line)"
            value={(s.images || []).join('\n')}
            onChange={(e) => updateSizeImages(idx, e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-sm rounded bg-slate-700 border border-slate-600 text-white resize-none"
          />
        </div>
      ))}
    </div>
  );
}

// ===================== Product Form Modal =====================
function ProductFormModal({ product, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: '', tagline: '', type: 'agarbatti', category: 'agarbatti',
    description: '', notes: [], image: '', burnTime: '',
    sizes: [{ size: '', mrp: 0, price: 0, images: [] }],
    rating: 0, reviews: 0, comingSoon: false, bambooless: false, isActive: true,
  });
  const [notesText, setNotesText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        name: product.name || '',
        tagline: product.tagline || '',
        type: product.type || 'agarbatti',
        category: product.category || 'agarbatti',
        description: product.description || '',
        notes: product.notes || [],
        image: product.image || '',
        burnTime: product.burnTime || '',
        sizes: (product.sizes || []).map(s => ({
          size: s.size || '', sizeLabel: s.sizeLabel || '',
          mrp: s.mrp || 0, price: s.price || 0,
          weight: s.weight || null, includes: s.includes || null,
          images: s.images || [],
        })),
        rating: product.rating || 0,
        reviews: product.reviews || 0,
        comingSoon: product.comingSoon || false,
        bambooless: product.bambooless || false,
        isActive: product.isActive !== false,
      });
      setNotesText((product.notes || []).join(', '));
    }
  }, [product]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (form.sizes.length === 0 || !form.sizes[0].size) {
      toast.error('At least one size variant is required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        name: toTitleCase(form.name.trim()),
        tagline: form.tagline.trim(),
        notes: notesText.split(',').map(n => n.trim()).filter(Boolean),
        bambooless: form.category === 'dhoop' ? form.bambooless : null,
      };

      const url = isEdit
        ? `${API_URL}/api/admin/products/${product.id}`
        : `${API_URL}/api/admin/products`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to save product');
      }

      toast.success(isEdit ? 'Product updated!' : 'Product created!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-slate-800 rounded-2xl border border-slate-700 w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-white">
            {isEdit ? 'Edit Product' : 'Add New Product'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Name + Tagline */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Product Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                placeholder="e.g. Kesar Chandan"
                data-testid="product-name-input"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Tagline</label>
              <input
                value={form.tagline}
                onChange={(e) => setForm({ ...form, tagline: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                placeholder="e.g. Sacred Luxury Blend"
                data-testid="product-tagline-input"
              />
            </div>
          </div>

          {/* Category + Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value, type: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                data-testid="product-category-select"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Burn Time</label>
              <input
                value={form.burnTime}
                onChange={(e) => setForm({ ...form, burnTime: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                placeholder="e.g. 40+ minutes"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium text-slate-300 mb-1 block">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white resize-none"
              placeholder="Product description..."
              data-testid="product-description-input"
            />
          </div>

          {/* Fragrance Notes + Primary Image */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Fragrance Notes (comma-separated)</label>
              <input
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                placeholder="Saffron, Sandalwood, Nutmeg"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1 block">Primary Image URL</label>
              <input
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                placeholder="https://..."
                data-testid="product-image-input"
              />
            </div>
          </div>

          {/* Sizes */}
          <SizeEditor sizes={form.sizes} onChange={(s) => setForm({ ...form, sizes: s })} />

          {/* Toggles */}
          <div className="flex flex-wrap gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={form.comingSoon}
                onChange={(e) => setForm({ ...form, comingSoon: e.target.checked })}
                className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                data-testid="product-coming-soon-toggle"
              />
              <span className="text-sm text-slate-300">Coming Soon</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox" checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                data-testid="product-active-toggle"
              />
              <span className="text-sm text-slate-300">Active</span>
            </label>
            {form.category === 'dhoop' && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox" checked={form.bambooless}
                  onChange={(e) => setForm({ ...form, bambooless: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-700 text-amber-500 focus:ring-amber-500"
                />
                <span className="text-sm text-slate-300">Bambooless</span>
              </label>
            )}
          </div>

          {/* Rating & Reviews (for existing products) */}
          {isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Rating</label>
                <input
                  type="number" step="0.1" min="0" max="5"
                  value={form.rating}
                  onChange={(e) => setForm({ ...form, rating: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-300 mb-1 block">Reviews Count</label>
                <input
                  type="number" min="0"
                  value={form.reviews}
                  onChange={(e) => setForm({ ...form, reviews: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 px-6 py-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors disabled:opacity-50 flex items-center gap-2"
            data-testid="save-product-btn"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===================== Product Row =====================
function ProductRow({ product, onEdit, onDelete, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const lowestPrice = Math.min(...(product.sizes || []).map(s => s.price));

  return (
    <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl overflow-hidden transition-all hover:border-slate-600" data-testid={`product-row-${product.id}`}>
      <div className="flex items-center gap-4 p-4">
        {/* Image */}
        <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-700 flex-shrink-0">
          {product.image ? (
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500">
              <Package size={20} />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white truncate">{product.name}</h3>
            {product.comingSoon && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 font-medium">
                Coming Soon
              </span>
            )}
            {!product.isActive && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 font-medium">
                Inactive
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{product.tagline}</p>
        </div>

        {/* Category */}
        <span className="hidden sm:inline text-xs px-2 py-1 rounded bg-slate-700 text-amber-400 capitalize">
          {product.category}
        </span>

        {/* Price */}
        <span className="text-sm font-semibold text-amber-400 w-16 text-right">
          ₹{lowestPrice}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(product)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Edit"
            data-testid={`edit-product-${product.id}`}
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => onToggle(product.id)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title={product.isActive ? 'Deactivate' : 'Activate'}
            data-testid={`toggle-product-${product.id}`}
          >
            {product.isActive ? <Eye size={16} /> : <EyeOff size={16} />}
          </button>
          <button
            onClick={() => onDelete(product.id, product.name)}
            className="p-2 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"
            title="Delete"
            data-testid={`delete-product-${product.id}`}
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-700/50">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 text-sm">
            <div>
              <span className="text-slate-500 text-xs">Slug</span>
              <p className="text-slate-300 font-mono text-xs">{product.id}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Type</span>
              <p className="text-slate-300 capitalize">{product.type}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Burn Time</span>
              <p className="text-slate-300">{product.burnTime || '—'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Rating</span>
              <p className="text-slate-300">{product.rating} ({product.reviews} reviews)</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Notes</span>
              <p className="text-slate-300">{(product.notes || []).join(', ') || '—'}</p>
            </div>
            <div>
              <span className="text-slate-500 text-xs">Sizes</span>
              <p className="text-slate-300">{(product.sizes || []).map(s => `${s.size} @ ₹${s.price}`).join(', ')}</p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 line-clamp-2">{product.description}</p>
        </div>
      )}
    </div>
  );
}

// ===================== Main Page =====================
export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchProducts = useCallback(async () => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleToggle = async (productId) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/products/${productId}/toggle-active`, { method: 'PATCH' });
      if (res.ok) {
        const data = await res.json();
        toast.success(data.message);
        fetchProducts();
      }
    } catch (err) {
      toast.error('Failed to toggle product');
    }
  };

  const handleDelete = async (productId) => {
    try {
      const res = await authFetch(`${API_URL}/api/admin/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Product deleted');
        setDeleteConfirm(null);
        fetchProducts();
      }
    } catch (err) {
      toast.error('Failed to delete product');
    }
  };

  const filtered = products.filter(p => {
    if (filter === 'active') return p.isActive !== false && !p.comingSoon;
    if (filter === 'coming-soon') return p.comingSoon;
    if (filter === 'inactive') return p.isActive === false;
    return true;
  });

  const stats = {
    total: products.length,
    active: products.filter(p => p.isActive !== false && !p.comingSoon).length,
    comingSoon: products.filter(p => p.comingSoon).length,
    inactive: products.filter(p => p.isActive === false).length,
  };

  return (
    <div className="space-y-6" data-testid="admin-products-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Product Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Manage your product catalog — {stats.total} products
          </p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowForm(true); }}
          className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-semibold hover:bg-amber-400 transition-colors flex items-center gap-2"
          data-testid="add-product-btn"
        >
          <Plus size={18} />
          Add Product
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-white', bg: 'bg-slate-700/50', key: 'all' },
          { label: 'Active', value: stats.active, color: 'text-emerald-400', bg: 'bg-emerald-500/10', key: 'active' },
          { label: 'Coming Soon', value: stats.comingSoon, color: 'text-purple-400', bg: 'bg-purple-500/10', key: 'coming-soon' },
          { label: 'Inactive', value: stats.inactive, color: 'text-red-400', bg: 'bg-red-500/10', key: 'inactive' },
        ].map(s => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`p-3 rounded-xl border transition-all ${
              filter === s.key
                ? 'border-amber-500/50 ring-1 ring-amber-500/30'
                : 'border-slate-700/50 hover:border-slate-600'
            } ${s.bg}`}
            data-testid={`filter-${s.key}`}
          >
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Product List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <Package size={48} className="mx-auto mb-3 opacity-30" />
          <p>No products found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(product => (
            <ProductRow
              key={product.id}
              product={product}
              onEdit={handleEdit}
              onDelete={(id, name) => setDeleteConfirm({ id, name })}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <ProductFormModal
          product={editingProduct}
          onClose={() => { setShowForm(false); setEditingProduct(null); }}
          onSaved={fetchProducts}
        />
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Delete Product</h3>
                <p className="text-sm text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-slate-300 mb-6">
              Are you sure you want to delete <strong className="text-white">{deleteConfirm.name}</strong>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg bg-slate-700 text-slate-300 hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm.id)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-500 flex items-center gap-2"
                data-testid="confirm-delete-btn"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
