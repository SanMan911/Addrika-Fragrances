'use client';

import { useState, useEffect, useCallback } from 'react';
import { Boxes, RefreshCw, AlertTriangle, Package } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/inventory`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const lowStockProducts = products.filter(p => (p.stock || 0) < (p.low_stock_threshold || 10));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inventory</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {products.length} products, {lowStockProducts.length} low stock alerts
          </p>
        </div>
        <button
          onClick={fetchInventory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Low Stock Alerts */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-red-600" size={20} />
            <h2 className="font-semibold text-red-800 dark:text-red-400">Low Stock Alerts</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockProducts.map((product) => (
              <div key={product.id} className="bg-white dark:bg-slate-800 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <Package size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800 dark:text-white text-sm">{product.name}</p>
                  <p className="text-xs text-red-600">Only {product.stock || 0} left</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => {
          const stockLevel = product.stock || 0;
          const isLowStock = stockLevel < (product.low_stock_threshold || 10);
          
          return (
            <div
              key={product.id}
              className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isLowStock ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  <Boxes size={24} className={isLowStock ? 'text-red-600' : 'text-green-600'} />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-white">{product.name}</h3>
                  <p className="text-sm text-slate-500">SKU: {product.sku || 'N/A'}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                {product.sizes?.map((size, idx) => (
                  <div key={idx} className="flex justify-between text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded">
                    <span className="text-slate-600 dark:text-slate-400">{size.weight}</span>
                    <span className={`font-medium ${
                      (size.stock || 0) < 10 ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {size.stock || 0} units
                    </span>
                  </div>
                )) || (
                  <div className="flex justify-between text-sm bg-slate-50 dark:bg-slate-900 p-2 rounded">
                    <span className="text-slate-600 dark:text-slate-400">Total Stock</span>
                    <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                      {stockLevel} units
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border p-8 text-center text-slate-500">
          No products found
        </div>
      )}
    </div>
  );
}
