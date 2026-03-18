import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Boxes, RefreshCw, Plus, AlertTriangle, Check } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AdminInventoryPage = () => {
  const { authFetch } = useOutletContext();
  
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/inventory`);
      if (res.ok) {
        const data = await res.json();
        setInventory(data.inventory || []);
      }
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const updateStock = async (productId, size, newStock) => {
    try {
      const res = await authFetch(`${API_URL}/api/inventory/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: productId,
          size,
          stock: parseInt(newStock)
        })
      });

      if (res.ok) {
        toast.success('Stock updated');
        fetchInventory();
      } else {
        toast.error('Failed to update stock');
      }
    } catch (error) {
      toast.error('Failed to update stock');
    }
  };

  const initInventory = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/inventory/init`, {
        method: 'POST'
      });

      if (res.ok) {
        toast.success('Inventory initialized');
        fetchInventory();
      } else {
        toast.error('Failed to initialize inventory');
      }
    } catch (error) {
      toast.error('Failed to initialize inventory');
    }
  };

  const lowStockItems = inventory.filter(item => item.stock <= (item.low_stock_threshold || 10));
  const inStockItems = inventory.filter(item => item.stock > (item.low_stock_threshold || 10));

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Inventory</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage product stock levels</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={initInventory} variant="outline">
            <Plus size={18} className="mr-2" />
            Initialize
          </Button>
          <Button onClick={fetchInventory} variant="outline" disabled={loading}>
            <RefreshCw size={18} className={loading ? 'animate-spin mr-2' : 'mr-2'} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-red-600" />
            <h2 className="font-semibold text-red-800 dark:text-red-400">Low Stock Alerts ({lowStockItems.length})</h2>
          </div>
          <div className="grid gap-2">
            {lowStockItems.map((item) => (
              <div
                key={`${item.product_id}-${item.size}`}
                className="flex items-center justify-between p-3 bg-white dark:bg-slate-800 rounded-lg"
              >
                <div>
                  <p className="font-medium text-slate-800 dark:text-white">{item.product_name || item.product_id}</p>
                  <p className="text-sm text-slate-500">Size: {item.size}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-red-600 font-bold">{item.stock} left</span>
                  <Input
                    type="number"
                    className="w-20"
                    defaultValue={item.stock}
                    onBlur={(e) => {
                      if (e.target.value !== String(item.stock)) {
                        updateStock(item.product_id, item.size, e.target.value);
                      }
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Inventory */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-white">All Products ({inventory.length})</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="animate-spin text-slate-400" size={32} />
          </div>
        ) : inventory.length === 0 ? (
          <div className="p-8 text-center">
            <Boxes size={48} className="mx-auto text-slate-400 mb-4" />
            <p className="text-slate-500 dark:text-slate-400">No inventory items. Click "Initialize" to set up.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Product</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Size</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Stock</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Threshold</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 dark:text-slate-200">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {inventory.map((item) => {
                  const isLowStock = item.stock <= (item.low_stock_threshold || 10);
                  return (
                    <tr key={`${item.product_id}-${item.size}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                      <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                        {item.product_name || item.product_id}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{item.size}</td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                          {item.stock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                        {item.low_stock_threshold || 10}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          isLowStock
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                          {isLowStock ? <AlertTriangle size={12} /> : <Check size={12} />}
                          {isLowStock ? 'Low' : 'OK'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          className="w-20"
                          defaultValue={item.stock}
                          onBlur={(e) => {
                            if (e.target.value !== String(item.stock)) {
                              updateStock(item.product_id, item.size, e.target.value);
                            }
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInventoryPage;
