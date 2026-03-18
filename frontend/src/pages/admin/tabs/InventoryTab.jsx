import React from 'react';
import { Boxes } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const InventoryTab = ({ inventory, initInventory, updateInventory }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="inventory-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Inventory Management
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {inventory.filter(i => i.stock === 0).length} out of stock • 
            {inventory.filter(i => i.stock > 0 && i.stock <= i.lowStockThreshold).length} low stock
          </p>
        </div>
        {inventory.length === 0 && (
          <Button 
            onClick={initInventory} 
            className="text-white bg-slate-800 hover:bg-slate-700"
            data-testid="init-inventory-btn"
          >
            Initialize Inventory
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Product</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Size</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Stock</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Status</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
            {inventory.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{item.productName}</td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{item.size}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    defaultValue={item.stock}
                    min="0"
                    className="w-20 px-2 py-1 border rounded bg-white dark:bg-slate-600 dark:border-slate-500 dark:text-gray-100"
                    onBlur={(e) => {
                      if (e.target.value !== String(item.stock)) {
                        updateInventory(item.productId, item.size, e.target.value);
                      }
                    }}
                    data-testid={`stock-input-${item.id}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    item.stock === 0 
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' 
                      : item.stock <= item.lowStockThreshold 
                        ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400' 
                        : 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                  }`}>
                    {item.stock === 0 ? 'Out of Stock' : 
                     item.stock <= item.lowStockThreshold ? 'Low Stock' : 'In Stock'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {(() => {
                    const date = new Date(item.updatedAt);
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = months[date.getMonth()];
                    const year = date.getFullYear();
                    return `${day}${month}${year}`;
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {inventory.length === 0 && (
          <div className="text-center py-12">
            <Boxes size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">Click "Initialize Inventory" to set up stock tracking</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryTab;
