import React from 'react';
import { MessageSquare, Mail, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui/button';

const InquiriesTab = ({ inquiries, updateInquiryStatus, deleteInquiry }) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="inquiries-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Inquiries ({inquiries.length})
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {inquiries.filter(i => i.status === 'pending').length} pending
        </p>
      </div>
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {inquiries.map((inquiry) => (
          <div key={inquiry.id || inquiry.inquiry_id} className="p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">
                  {inquiry.name}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {inquiry.email} • {inquiry.phone}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${
                  inquiry.type === 'wholesale' 
                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' 
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {inquiry.type}
                </span>
                <select
                  value={inquiry.status || 'pending'}
                  onChange={(e) => updateInquiryStatus(inquiry.id || inquiry.inquiry_id, e.target.value)}
                  className={`text-xs px-2 py-1 rounded border bg-white dark:bg-slate-700 ${
                    inquiry.status === 'resolved' ? 'border-green-500 text-green-600 dark:text-green-400' :
                    inquiry.status === 'contacted' ? 'border-blue-500 text-blue-600 dark:text-blue-400' :
                    inquiry.status === 'closed' ? 'border-gray-500 text-gray-600 dark:text-gray-400' : 
                    'border-yellow-500 text-yellow-600 dark:text-yellow-400'
                  }`}
                  data-testid={`inquiry-status-${inquiry.id || inquiry.inquiry_id}`}
                >
                  <option value="pending">Pending</option>
                  <option value="contacted">Contacted</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>
            <p className="text-sm mb-2 text-slate-700 dark:text-slate-300">
              <strong>Product:</strong> {inquiry.fragrance} ({inquiry.packageSize}) × {inquiry.quantity}
            </p>
            {inquiry.message && (
              <p className="text-sm p-2 bg-gray-50 dark:bg-slate-700 rounded mb-2 text-slate-600 dark:text-slate-400">
                {inquiry.message}
              </p>
            )}
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {(() => {
                  const date = new Date(inquiry.createdAt || inquiry.created_at);
                  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                  const day = String(date.getDate()).padStart(2, '0');
                  const month = months[date.getMonth()];
                  const year = date.getFullYear();
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  return `${day}${month}${year} ${hours}:${minutes}`;
                })()} IST
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.location.href = `mailto:${inquiry.email}?subject=Re: Your Addrika Inquiry - ${inquiry.fragrance}&body=Dear ${inquiry.name},%0D%0A%0D%0AThank you for your inquiry about ${inquiry.fragrance} (${inquiry.packageSize} x ${inquiry.quantity}).%0D%0A%0D%0A`;
                  }}
                  className="border-slate-300 dark:border-slate-600"
                  data-testid={`reply-inquiry-${inquiry.id || inquiry.inquiry_id}`}
                >
                  <Mail size={14} className="mr-1" /> Reply
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => deleteInquiry(inquiry.id || inquiry.inquiry_id)}
                  className="text-red-500 hover:text-red-700 hover:border-red-500 dark:text-red-400 dark:hover:bg-red-900/20"
                  data-testid={`delete-inquiry-${inquiry.id || inquiry.inquiry_id}`}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          </div>
        ))}
        {inquiries.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-20 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">No inquiries yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default InquiriesTab;
