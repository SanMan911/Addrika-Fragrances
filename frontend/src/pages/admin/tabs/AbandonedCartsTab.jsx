import React from 'react';
import { 
  ShoppingCart, DollarSign, Check, Mail, RefreshCw, 
  Loader2, Send, Eye, MessageSquare, Trash2, Phone, AlertTriangle 
} from 'lucide-react';
import { Button } from '../../../components/ui/button';

const AbandonedCartsTab = ({
  abandonedCartStats,
  abandonedCarts,
  loadingAbandonedCarts,
  processingAbandonedCarts,
  fetchAbandonedCarts,
  triggerAbandonedCartProcessing,
  removeCartFromTracking,
  setCartPreviewModal
}) => {
  return (
    <div className="space-y-6" data-testid="abandoned-carts-tab">
      {/* Stats Overview */}
      {abandonedCartStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <ShoppingCart size={20} className="text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {abandonedCartStats.abandoned_carts}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Abandoned Carts</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                <DollarSign size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  ₹{abandonedCartStats.abandoned_value?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Lost Revenue</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <Check size={20} className="text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {abandonedCartStats.converted_carts}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Converted Carts</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Mail size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                  {abandonedCartStats.reminders_sent_30d}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Reminders (30d)</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Abandoned Carts
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Carts inactive for 24+ hours
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={fetchAbandonedCarts}
            variant="outline"
            disabled={loadingAbandonedCarts}
            className="flex items-center gap-2"
            data-testid="refresh-abandoned-carts"
          >
            <RefreshCw size={16} className={loadingAbandonedCarts ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            onClick={triggerAbandonedCartProcessing}
            disabled={processingAbandonedCarts || abandonedCarts.length === 0}
            className="flex items-center gap-2 text-white bg-slate-800 hover:bg-slate-700"
            data-testid="send-reminder-emails"
          >
            {processingAbandonedCarts ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
            Send Reminder Emails
          </Button>
        </div>
      </div>

      {/* Abandoned Carts List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        {loadingAbandonedCarts ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-slate-400" size={32} />
          </div>
        ) : abandonedCarts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Contact</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Items</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Value</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Reminders</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Last Active</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {abandonedCarts.map((cart, index) => (
                  <tr key={cart.user_id || index} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {cart.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {cart.email}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {cart.phone ? (
                        <a 
                          href={`https://wa.me/91${cart.phone.replace(/\D/g, '').slice(-10)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-green-600 hover:text-green-700 dark:text-green-400"
                        >
                          <Phone size={14} />
                          <span className="text-sm">{cart.phone}</span>
                        </a>
                      ) : (
                        <span className="text-sm text-slate-400">No phone</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {cart.item_count} items
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="font-bold" style={{ color: 'var(--metallic-gold)' }}>
                        ₹{cart.cart_total?.toLocaleString() || 0}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        cart.reminder_count > 0 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      }`}>
                        {cart.reminder_count || 0} sent
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {cart.updated_at ? (() => {
                          const date = new Date(cart.updated_at);
                          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                          const day = String(date.getDate()).padStart(2, '0');
                          const month = months[date.getMonth()];
                          const year = date.getFullYear();
                          const hours = String(date.getHours()).padStart(2, '0');
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          return `${day}${month}${year} ${hours}:${minutes}`;
                        })() : 'N/A'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setCartPreviewModal(cart)}
                          className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                          title="View Cart Items"
                          data-testid={`view-cart-${cart.user_id}`}
                        >
                          <Eye size={16} />
                        </button>
                        {cart.phone && (
                          <a
                            href={`https://wa.me/91${cart.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(`Hi ${cart.name || 'there'}! We noticed you have items in your cart at Addrika. Can we help you complete your order?`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 text-green-600 dark:text-green-400 transition-colors"
                            title="Send WhatsApp"
                            data-testid={`whatsapp-${cart.user_id}`}
                          >
                            <MessageSquare size={16} />
                          </a>
                        )}
                        <button
                          onClick={() => removeCartFromTracking(cart.user_id)}
                          className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                          title="Remove from tracking"
                          data-testid={`remove-cart-${cart.user_id}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <Check size={32} className="text-green-600 dark:text-green-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
              No Abandoned Carts!
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm">
              All tracked carts have either been converted to orders or are still active. Great job!
            </p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <AlertTriangle className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">How Abandoned Cart Reminders Work</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Carts are tracked when logged-in users add items</li>
              <li>• A cart is marked "abandoned" after 24 hours of inactivity</li>
              <li>• Reminder emails are sent automatically every hour (with 72-hour cooldown)</li>
              <li>• Use the WhatsApp button to follow up on high-value carts</li>
              <li>• Remove carts from tracking after successful manual follow-up</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbandonedCartsTab;
