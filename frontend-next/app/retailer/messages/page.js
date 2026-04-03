'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Send, Inbox, Mail, User, Clock, Check, X } from 'lucide-react';
import { useRetailerAuth } from '../../../context/RetailerAuthContext';
import { toast } from 'sonner';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://product-size-sync.preview.emergentagent.com';
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 86400000) {
      return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  } catch {
    return 'N/A';
  }
};
export default function RetailerMessagesPage() {
  const [activeTab, setActiveTab] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [districtRetailers, setDistrictRetailers] = useState([]);
  const [sending, setSending] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  
  const [composeData, setComposeData] = useState({
    to_retailer_id: '',
    subject: '',
    message: ''
  });
  const { retailer, fetchWithAuth } = useRetailerAuth();
  const fetchMessages = useCallback(async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === 'inbox' ? 'inbox' : 'sent';
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/messages/${endpoint}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        if (activeTab === 'inbox') {
          setUnreadCount(data.unread_count || 0);
        }
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, fetchWithAuth]);
  const fetchDistrictRetailers = async () => {
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/messages/retailers`);
      if (response.ok) {
        const data = await response.json();
        setDistrictRetailers(data.retailers || []);
      }
    } catch (error) {
      console.error('Failed to fetch retailers:', error);
    }
  };
  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);
  useEffect(() => {
    if (showCompose) {
      fetchDistrictRetailers();
    }
  }, [showCompose]);
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!composeData.to_retailer_id || !composeData.subject || !composeData.message) {
      toast.error('Please fill in all fields');
      return;
    }
    setSending(true);
    try {
      const response = await fetchWithAuth(`${API_URL}/api/retailer-dashboard/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(composeData)
      });
      if (response.ok) {
        toast.success('Message sent successfully');
        setShowCompose(false);
        setComposeData({ to_retailer_id: '', subject: '', message: '' });
        if (activeTab === 'sent') {
          fetchMessages();
        }
      } else {
        const error = await response.json();
        toast.error(error.detail || 'Failed to send message');
      }
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };
  const markAsRead = async (messageId) => {
    try {
      await fetchWithAuth(`${API_URL}/api/retailer-dashboard/messages/${messageId}/read`, {
        method: 'PUT'
      });
      fetchMessages();
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };
  const openMessage = (msg) => {
    setSelectedMessage(msg);
    if (!msg.is_read && activeTab === 'inbox') {
      markAsRead(msg.id);
    }
  };
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#2B3A4A]">Messages</h1>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2B3A4A] text-white rounded-lg"
        >
          <Send size={18} />
          Compose
        </button>
      </div>
      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('inbox')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'inbox' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <Inbox size={18} />
          Inbox
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-[#D4AF37] text-white">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'sent' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
          }`}
        >
          <Send size={18} />
          Sent
        </button>
      </div>
      {/* Info Banner */}
      <div className="p-3 rounded-lg text-sm flex items-center gap-2 bg-blue-50 text-blue-700">
        <MessageSquare size={18} />
        You can message retailers in your district: <strong>{retailer?.district}</strong>
      </div>
      {/* Messages List */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white rounded-xl animate-pulse" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500">
            {activeTab === 'inbox' ? 'No messages received' : 'No messages sent'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              onClick={() => openMessage(msg)}
              className={`bg-white rounded-xl p-4 cursor-pointer hover:shadow-md transition-shadow ${
                !msg.is_read && activeTab === 'inbox' ? 'border-l-4 border-l-[#D4AF37]' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#F5F0E8]">
                    <User className="w-5 h-5 text-[#2B3A4A]" />
                  </div>
                  <div>
                    <div className={`font-medium ${!msg.is_read && activeTab === 'inbox' ? 'font-bold' : ''}`}>
                      {activeTab === 'inbox' ? msg.from_retailer_name : msg.to_retailer_name}
                    </div>
                    <div className={`text-sm ${!msg.is_read && activeTab === 'inbox' ? 'font-semibold' : ''} text-[#2B3A4A]`}>
                      {msg.subject}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {activeTab === 'inbox' && msg.is_read && (
                    <Check className="w-4 h-4 text-green-500" />
                  )}
                  {formatDate(msg.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#2B3A4A]">New Message</h2>
              <button onClick={() => setShowCompose(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">To (District Retailer)</label>
                <select
                  value={composeData.to_retailer_id}
                  onChange={(e) => setComposeData({ ...composeData, to_retailer_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select retailer...</option>
                  {districtRetailers.map((r) => (
                    <option key={r.retailer_id} value={r.retailer_id}>
                      {r.name} - {r.city}
                    </option>
                  ))}
                </select>
                {districtRetailers.length === 0 && (
                  <p className="text-sm mt-1 text-gray-500">No other retailers in your district yet</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <input
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="Message subject"
                  maxLength={200}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  value={composeData.message}
                  onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                  placeholder="Write your message..."
                  rows={5}
                  maxLength={2000}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCompose(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={sending || districtRetailers.length === 0}
                  className="flex-1 py-2 bg-[#2B3A4A] text-white rounded-lg disabled:opacity-50"
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#2B3A4A]">{selectedMessage.subject}</h2>
                <div className="text-sm mt-1 text-gray-500">
                  {activeTab === 'inbox' ? 'From' : 'To'}: {activeTab === 'inbox' ? selectedMessage.from_retailer_name : selectedMessage.to_retailer_name}
                </div>
              </div>
              <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="p-4 rounded-lg mb-4 bg-[#F5F0E8]">
                <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>
              <div className="text-xs flex items-center gap-1 text-gray-500">
                <Clock size={12} />
                {new Date(selectedMessage.created_at).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
