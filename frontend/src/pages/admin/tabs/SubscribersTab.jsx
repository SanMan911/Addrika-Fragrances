import React from 'react';
import { Mail } from 'lucide-react';

const SubscribersTab = ({ subscribers }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="subscribers-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Email Subscribers ({subscribers.filter(s => s.isActive).length} active)
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Email</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Name</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Subscribed</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {subscribers.map((sub) => (
              <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                <td className="px-4 py-3 text-slate-800 dark:text-slate-200">{sub.email}</td>
                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{sub.name || '-'}</td>
                <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                  {(() => {
                    const date = new Date(sub.subscribedAt);
                    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                    const day = String(date.getDate()).padStart(2, '0');
                    const month = months[date.getMonth()];
                    const year = date.getFullYear();
                    return `${day}${month}${year}`;
                  })()}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    sub.isActive 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' 
                      : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {sub.isActive ? 'Active' : 'Unsubscribed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {subscribers.length === 0 && (
          <div className="text-center py-12">
            <Mail size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">No subscribers yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SubscribersTab;
