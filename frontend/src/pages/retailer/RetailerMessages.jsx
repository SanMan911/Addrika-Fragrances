/**
 * Retailer Messages Page - Inter-retailer communication
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowLeft, MessageSquare, Send, Inbox, Mail, 
  RefreshCw, User, Clock, Check
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useRetailerAuth } from '../../context/RetailerAuthContext';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const RetailerMessages = () => {
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

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now - date;
      
      if (diff < 86400000) { // Less than 24 hours
        return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    } catch {
      return 'N/A';
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <header 
        className="sticky top-0 z-30 px-4 py-4"
        style={{ backgroundColor: 'white', borderBottom: '1px solid var(--border)' }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/retailer/dashboard" className="p-2 rounded-lg hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
              Messages
            </h1>
          </div>
          <Button onClick={() => setShowCompose(true)} style={{ backgroundColor: 'var(--japanese-indigo)' }}>
            <Send className="w-4 h-4 mr-2" />
            Compose
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'inbox' ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Inbox
            {unreadCount > 0 && (
              <span 
                className="px-2 py-0.5 text-xs rounded-full"
                style={{ backgroundColor: 'var(--metallic-gold)', color: 'white' }}
              >
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
            <Send className="w-4 h-4" />
            Sent
          </button>
        </div>

        {/* Info Banner */}
        <div 
          className="p-3 rounded-lg mb-4 text-sm flex items-center gap-2"
          style={{ backgroundColor: '#DBEAFE', color: '#2563EB' }}
        >
          <MessageSquare className="w-4 h-4" />
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
          <div className="text-center py-12 bg-white rounded-xl">
            <Mail className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p style={{ color: 'var(--text-subtle)' }}>
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
                  !msg.is_read && activeTab === 'inbox' ? 'border-l-4' : ''
                }`}
                style={{ 
                  borderLeftColor: !msg.is_read && activeTab === 'inbox' ? 'var(--metallic-gold)' : 'transparent'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'var(--cream)' }}
                    >
                      <User className="w-5 h-5" style={{ color: 'var(--japanese-indigo)' }} />
                    </div>
                    <div>
                      <div className={`font-medium ${!msg.is_read && activeTab === 'inbox' ? 'font-bold' : ''}`}>
                        {activeTab === 'inbox' ? msg.from_retailer_name : msg.to_retailer_name}
                      </div>
                      <div 
                        className={`text-sm ${!msg.is_read && activeTab === 'inbox' ? 'font-semibold' : ''}`}
                        style={{ color: 'var(--japanese-indigo)' }}
                      >
                        {msg.subject}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-subtle)' }}>
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
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                  New Message
                </h2>
                <button onClick={() => setShowCompose(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSendMessage} className="p-6 space-y-4">
              <div>
                <Label>To (District Retailer)</Label>
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
                  <p className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                    No other retailers in your district yet
                  </p>
                )}
              </div>

              <div>
                <Label>Subject</Label>
                <Input
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="Message subject"
                  maxLength={200}
                />
              </div>

              <div>
                <Label>Message</Label>
                <textarea
                  value={composeData.message}
                  onChange={(e) => setComposeData({ ...composeData, message: e.target.value })}
                  placeholder="Write your message..."
                  rows={5}
                  className="w-full px-3 py-2 border rounded-lg resize-none"
                  maxLength={2000}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowCompose(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={sending || districtRetailers.length === 0}
                  className="flex-1"
                  style={{ backgroundColor: 'var(--japanese-indigo)' }}
                >
                  {sending ? 'Sending...' : 'Send Message'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                    {selectedMessage.subject}
                  </h2>
                  <div className="text-sm mt-1" style={{ color: 'var(--text-subtle)' }}>
                    {activeTab === 'inbox' ? 'From' : 'To'}: {activeTab === 'inbox' ? selectedMessage.from_retailer_name : selectedMessage.to_retailer_name}
                  </div>
                </div>
                <button onClick={() => setSelectedMessage(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <ArrowLeft className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              <div 
                className="p-4 rounded-lg mb-4"
                style={{ backgroundColor: 'var(--cream)' }}
              >
                <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
              </div>

              <div className="text-xs flex items-center gap-1" style={{ color: 'var(--text-subtle)' }}>
                <Clock className="w-3 h-3" />
                {new Date(selectedMessage.created_at).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RetailerMessages;
