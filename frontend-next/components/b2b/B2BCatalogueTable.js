'use client';

import Image from 'next/image';
import { Minus, Plus } from 'lucide-react';

const PREORDER_STATUSES = new Set(['out_of_stock', 'restocking', 'manufacturing', 'delayed']);
const isPreorderAvailable = (product) => {
  if (!product) return false;
  const status = String(product.stock_status || '').toLowerCase();
  if (PREORDER_STATUSES.has(status)) return true;
  return Number(product.stock_pieces || 0) <= 0;
};

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

/**
 * B2B catalogue table.
 *
 * Extracted from `app/retailer/b2b/page.js` in Iter 99 — behavior +
 * markup + data-testids identical to the previous inline block. Owns
 * layout only; ALL state (quantities, category filter) is provided by
 * the parent so the "increment/decrement -> recompute totals" loop
 * still lives on the page.
 *
 * Props
 * -----
 * catalog:          [{ id, name, image, net_weight, units_per_box, price_per_box, price_per_half_box, category, stock_status, stock_pieces, pricing_tiers }]
 * quantities:       { [productId]: number } — allows halves (0.5 increments)
 * categoryFilter:   'all' | category
 * loading:          boolean — renders a skeleton block
 * onQuantityChange: (productId, delta: -1|+1) => void
 */
export default function B2BCatalogueTable({
  catalog,
  quantities,
  categoryFilter,
  loading,
  onQuantityChange,
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-white rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const rows = catalog.filter(
    (p) => categoryFilter === 'all' || p.category === categoryFilter,
  );

  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-3 text-sm font-semibold bg-[#2B3A4A] text-white">
        <div className="col-span-1">Image</div>
        <div className="col-span-3">Product Name</div>
        <div className="col-span-1 text-center">Weight</div>
        <div className="col-span-2 text-center">Price/Box</div>
        <div className="col-span-2 text-center">Price/½ Box</div>
        <div className="col-span-3 text-center">Quantity</div>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-gray-100">
        {rows.map((product) => {
          const qty = quantities[product.id] || 0;
          const preorder = isPreorderAvailable(product);
          return (
            <div
              key={product.id}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50 transition-colors"
              data-testid={`product-row-${product.id}`}
            >
              {/* Mobile Layout */}
              <div className="md:hidden flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden relative">
                    {product.image && (
                      <Image src={product.image} alt={product.name} fill className="object-cover" />
                    )}
                  </div>
                  <div>
                    <p className="font-semibold text-[#2B3A4A]">{product.name}</p>
                    <p className="text-xs text-gray-500">
                      {product.units_per_box} units/box • {product.net_weight}
                    </p>
                    <p className="text-sm font-medium text-[#D4AF37]">
                      {formatCurrency(product.price_per_box)}/box
                    </p>
                    {preorder && (
                      <span
                        className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300"
                        data-testid={`preorder-badge-mobile-${product.id}`}
                        title="This SKU is currently out of stock but bookable via a 50% token pre-order — you'll be prioritized in the Next Production Batch."
                      >
                        PRE-ORDER AVAILABLE
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onQuantityChange(product.id, -1)}
                    disabled={qty <= 0}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center disabled:opacity-30"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="w-12 text-center font-bold" data-testid={`qty-mobile-${product.id}`}>
                    {qty}
                  </span>
                  <button
                    onClick={() => onQuantityChange(product.id, 1)}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center hover:border-[#D4AF37]"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Desktop Layout */}
              <div className="hidden md:contents">
                <div className="col-span-1">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden relative">
                    {product.image && (
                      <Image src={product.image} alt={product.name} fill className="object-cover" />
                    )}
                  </div>
                </div>
                <div className="col-span-3">
                  <p className="font-semibold text-[#2B3A4A]">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.units_per_box} units/box</p>
                  {preorder && (
                    <span
                      className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300"
                      data-testid={`preorder-badge-${product.id}`}
                      title="Out of stock — bookable via 50% token pre-order. You'll be prioritized in the Next Production Batch."
                    >
                      PRE-ORDER AVAILABLE
                    </span>
                  )}
                  {product.pricing_tiers?.length > 0 && (
                    <p
                      className="text-[11px] text-green-700 mt-1 font-medium"
                      data-testid={`tiers-${product.id}`}
                    >
                      {product.pricing_tiers
                        .filter((t) => t.discount_percent > 0)
                        .map((t) => `${t.min_boxes}+ box: -${t.discount_percent}%`)
                        .join(' • ') || 'Bulk discounts available'}
                    </p>
                  )}
                </div>
                <div className="col-span-1 text-center">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-[#F5F0E8] text-[#2B3A4A]">
                    {product.net_weight}
                  </span>
                </div>
                <div className="col-span-2 text-center font-bold text-[#D4AF37]">
                  {formatCurrency(product.price_per_box)}
                </div>
                <div className="col-span-2 text-center font-medium text-[#2B3A4A]">
                  {formatCurrency(product.price_per_half_box)}
                </div>
                <div className="col-span-3 flex items-center justify-center gap-3">
                  <button
                    onClick={() => onQuantityChange(product.id, -1)}
                    disabled={qty <= 0}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center disabled:opacity-30"
                  >
                    <Minus size={14} />
                  </button>
                  <span
                    className="w-16 text-center text-lg font-bold text-[#2B3A4A]"
                    data-testid={`qty-${product.id}`}
                  >
                    {qty}
                  </span>
                  <button
                    onClick={() => onQuantityChange(product.id, 1)}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center hover:border-[#D4AF37] hover:bg-amber-50"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
