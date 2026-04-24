'use client';

import { useState, useEffect, useCallback } from 'react';
import { Receipt, Download, RefreshCw, FileText } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatCurrency = (v) =>
  v == null
    ? '—'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(v || 0);

const formatDate = (s) => {
  if (!s) return '—';
  try {
    return new Date(s).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
};

function downloadBase64File(base64, fileName, mime) {
  const raw = base64.split(',').pop();
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'bill';
  a.click();
  URL.revokeObjectURL(url);
}

export default function RetailerBillsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const { fetchWithAuth } = useRetailerAuth();

  const fetchBills = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/bills`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setBills(data.bills || []);
    } catch {
      toast.error('Failed to load bills');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  const download = async (bill) => {
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/retailer-dashboard/bills/${bill.bill_id}/download`
      );
      if (!res.ok) throw new Error();
      const full = await res.json();
      downloadBase64File(full.file_base64, full.file_name, full.file_type);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-6" data-testid="retailer-bills-page">
      <div>
        <h1 className="text-2xl font-bold text-[#2B3A4A] flex items-center gap-2">
          <Receipt size={22} /> Bills & Invoices
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          All invoices and statements uploaded by the Addrika team for your
          store. Download anytime.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <RefreshCw className="animate-spin text-gray-400" size={24} />
        </div>
      ) : bills.length === 0 ? (
        <div className="bg-white rounded-xl border p-8 text-center text-gray-500">
          <FileText className="mx-auto mb-3 text-gray-300" size={40} />
          No bills uploaded yet.
        </div>
      ) : (
        <div className="space-y-3">
          {bills.map((b) => (
            <div
              key={b.id}
              className="bg-white rounded-xl border p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4"
              data-testid={`bill-${b.bill_id}`}
            >
              <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Receipt className="text-amber-600" size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#2B3A4A] truncate">{b.title}</p>
                <p className="text-xs text-gray-500">
                  {b.bill_id} · {formatDate(b.bill_date || b.created_at)}
                  {b.amount != null && <> · {formatCurrency(b.amount)}</>}
                </p>
                {b.notes && (
                  <p className="text-sm text-gray-600 mt-1">{b.notes}</p>
                )}
              </div>
              <button
                onClick={() => download(b)}
                className="px-4 py-2 rounded-lg bg-[#2B3A4A] text-white text-sm font-medium hover:bg-[#1e3a52] flex items-center gap-2"
                data-testid={`bill-download-${b.bill_id}`}
              >
                <Download size={14} /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
