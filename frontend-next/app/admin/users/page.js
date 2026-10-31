'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Search, RefreshCw, Mail, Phone, Calendar, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../layout';
import ConfirmDeleteDialog from '../../../components/admin/ConfirmDeleteDialog';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const formatDate = (date) => {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState(null);

  const deleteUser = async () => {
    const id = deleting.id || deleting.email;
    const res = await authFetch(
      `${API_URL}/api/admin/users/${encodeURIComponent(id)}?confirm_email=${encodeURIComponent(deleting.email)}`,
      { method: 'DELETE' }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.detail || 'Could not delete this user');
      throw new Error(data.detail || 'delete failed');
    }
    toast.success(`${deleting.email} removed`);
    setUsers((prev) => prev.filter((u) => (u.id || u.email) !== id));
  };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/api/admin/users`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const query = searchQuery.toLowerCase();
    return users.filter(u =>
      (u.name || '').toLowerCase().includes(query) ||
      (u.email || '').toLowerCase().includes(query) ||
      (u.phone || '').toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

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
          <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Users</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {filteredUsers.length} registered users
          </p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name, email, or phone..."
            className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-white"
          />
        </div>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <div
            key={user.id || user.email}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                <Users size={24} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-800 dark:text-white truncate">
                  {user.salutation} {user.name}
                </h3>
                <div className="mt-2 space-y-1 text-sm">
                  <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Mail size={14} />
                    <span className="truncate">{user.email}</span>
                  </p>
                  {user.phone && (
                    <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <Phone size={14} />
                      <span>{user.country_code} {user.phone}</span>
                    </p>
                  )}
                  <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                    <Calendar size={14} />
                    <span>Joined {formatDate(user.created_at || user.createdAt)}</span>
                  </p>
                  {user.order_count > 0 && (
                    <p className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <ShoppingBag size={14} />
                      <span>{user.order_count} orders</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setDeleting(user)}
                  className="mt-3 flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20"
                  data-testid={`user-delete-btn-${user.id || user.email}`}
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDeleteDialog
        open={!!deleting}
        title="Delete this user permanently?"
        description="The account and its sessions are erased for good. Users with real orders cannot be deleted."
        confirmValue={deleting?.email || ''}
        onConfirm={deleteUser}
        onClose={() => setDeleting(null)}
        testId="user-confirm-delete"
      />

      {filteredUsers.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 text-center text-slate-500 dark:text-slate-400">
          No users found
        </div>
      )}
    </div>
  );
}
