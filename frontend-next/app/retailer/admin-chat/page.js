'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Send, Paperclip, Headset, RefreshCw, Download, X } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const formatTime = (s) => {
  if (!s) return '';
  try {
    return new Date(s).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return s;
  }
};

async function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function RetailerAdminChatPage() {
  const { fetchWithAuth } = useRetailerAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [pendingFiles, setPendingFiles] = useState([]);
  const listRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/admin-chat`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages || []);
      setTimeout(() => {
        if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
      }, 50);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const onFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    const ok = [];
    for (const f of files) {
      if (!ALLOWED_MIME.includes(f.type)) {
        toast.error(`${f.name}: type not allowed (PDF/PNG/JPG/WEBP only)`);
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast.error(`${f.name}: exceeds 5MB`);
        continue;
      }
      const b64 = await readFileAsBase64(f);
      ok.push({ file_base64: b64, file_name: f.name, file_type: f.type });
    }
    setPendingFiles((prev) => [...prev, ...ok]);
    e.target.value = '';
  };

  const send = async () => {
    if (!text.trim() && pendingFiles.length === 0) return;
    setSending(true);
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/retailer-dashboard/admin-chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text.trim() || '(attachment)',
            attachments: pendingFiles,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Send failed');
      }
      setText('');
      setPendingFiles([]);
      await fetchMessages();
    } catch (e) {
      toast.error(e.message || 'Send failed');
    } finally {
      setSending(false);
    }
  };

  const downloadAttachment = async (messageId, idx, name, type) => {
    try {
      const res = await fetchWithAuth(
        `${API_URL}/api/retailer-dashboard/admin-chat/attachment/${messageId}/${idx}`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      const raw = data.file_base64.split(',').pop();
      const bin = atob(raw);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name || 'attachment';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto" data-testid="retailer-admin-chat">
      <div>
        <h1 className="text-2xl font-bold text-[#2B3A4A] flex items-center gap-2">
          <Headset size={22} /> Admin Chat
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Direct secure channel with the Addrika team. Share documents
          (PDF/PNG/JPG/WEBP · up to 5MB).
        </p>
      </div>

      <div
        ref={listRef}
        className="bg-white rounded-xl border h-[55vh] overflow-y-auto p-4 space-y-3"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="animate-spin text-gray-400" size={20} />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-400 pt-16">
            No messages yet — say hello!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_type === 'retailer';
            return (
              <div
                key={m.id}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                data-testid={`chat-msg-${m.id}`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-2 ${
                    mine
                      ? 'bg-[#2B3A4A] text-white rounded-br-sm'
                      : 'bg-amber-50 text-[#2B3A4A] rounded-bl-sm border border-amber-200'
                  }`}
                >
                  <p className="text-[11px] opacity-70 mb-1">
                    {mine ? 'You' : m.sender_name || 'Addrika'} ·{' '}
                    {formatTime(m.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{m.message}</p>
                  {(m.attachments || []).length > 0 && (
                    <div className="mt-2 space-y-1">
                      {m.attachments.map((a, i) => (
                        <button
                          key={i}
                          onClick={() =>
                            downloadAttachment(m.id, i, a.file_name, a.file_type)
                          }
                          className={`flex items-center gap-2 text-xs ${
                            mine ? 'text-amber-200 hover:text-white' : 'text-emerald-700 hover:text-emerald-900'
                          }`}
                          data-testid={`chat-attachment-${m.id}-${i}`}
                        >
                          <Download size={12} /> {a.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {pendingFiles.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 flex flex-wrap gap-2">
          {pendingFiles.map((f, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1 text-xs bg-white px-2 py-1 rounded border"
            >
              {f.file_name}
              <button
                onClick={() =>
                  setPendingFiles((prev) => prev.filter((_, x) => x !== i))
                }
                className="text-red-500 ml-1"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <label className="p-2 rounded-lg border cursor-pointer bg-white hover:bg-slate-50" data-testid="chat-attach">
          <Paperclip size={18} />
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            className="hidden"
            onChange={onFileSelect}
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          rows={2}
          className="flex-1 px-3 py-2 rounded-lg border resize-none focus:outline-none focus:border-[#D4AF37]"
          data-testid="chat-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          onClick={send}
          disabled={sending}
          className="p-3 rounded-lg bg-[#D4AF37] text-white hover:bg-[#b8962d] disabled:opacity-50"
          data-testid="chat-send"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
