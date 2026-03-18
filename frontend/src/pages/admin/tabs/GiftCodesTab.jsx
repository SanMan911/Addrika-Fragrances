import React, { useState } from 'react';
import { 
  Gift, Cake, Heart, Sparkles, RefreshCw, Loader2, Send, Plus, X 
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { authFetch, API_URL } from '../utils';
import { toast } from 'sonner';

const GiftCodesTab = ({ 
  giftCodeStats, 
  loadingGiftCodes, 
  fetchGiftCodeStats,
  triggerBirthdayProcessing,
  triggerAnniversaryProcessing,
  processingBirthdays,
  processingAnniversaries,
  sendBirthdayCode,
  sendAnniversaryCode
}) => {
  const [showFestivalForm, setShowFestivalForm] = useState(false);
  const [creatingFestivalCode, setCreatingFestivalCode] = useState(false);
  const [newFestival, setNewFestival] = useState({
    festival_name: '',
    start_date: '',
    end_date: ''
  });

  // Create festival code
  const createFestivalCode = async (e) => {
    e.preventDefault();
    if (!newFestival.festival_name || !newFestival.start_date || !newFestival.end_date) {
      toast.error('Please fill all festival details');
      return;
    }
    
    setCreatingFestivalCode(true);
    try {
      const res = await authFetch(`${API_URL}/api/gift-codes/admin/festivals/create-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newFestival)
      });
      
      if (res.ok) {
        const result = await res.json();
        toast.success(`Festival code ${result.code} created!`);
        setNewFestival({ festival_name: '', start_date: '', end_date: '' });
        setShowFestivalForm(false);
        fetchGiftCodeStats();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to create festival code');
      }
    } catch (error) {
      console.error('Error creating festival code:', error);
      toast.error('Error creating festival code');
    } finally {
      setCreatingFestivalCode(false);
    }
  };

  // Deactivate festival code
  const deactivateFestivalCode = async (code) => {
    if (!window.confirm(`Are you sure you want to deactivate festival code ${code}?`)) return;
    
    try {
      const res = await authFetch(`${API_URL}/api/gift-codes/admin/festivals/deactivate/${code}`, {
        method: 'DELETE'
      });
      
      if (res.ok) {
        toast.success(`Festival code ${code} deactivated`);
        fetchGiftCodeStats();
      } else {
        const error = await res.json();
        toast.error(error.detail || 'Failed to deactivate code');
      }
    } catch (error) {
      console.error('Error deactivating festival code:', error);
      toast.error('Error deactivating festival code');
    }
  };

  return (
    <div className="space-y-6" data-testid="gift-codes-tab">
      {/* Stats Overview */}
      {giftCodeStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard 
            icon={Cake} 
            iconBg="bg-pink-100 dark:bg-pink-900/30"
            iconColor="text-pink-600 dark:text-pink-400"
            value={giftCodeStats.upcoming_birthdays_7d}
            label="Birthdays (7d)"
          />
          <StatCard 
            icon={Heart} 
            iconBg="bg-rose-100 dark:bg-rose-900/30"
            iconColor="text-rose-600 dark:text-rose-400"
            value={giftCodeStats.upcoming_anniversaries_7d}
            label="Anniversaries (7d)"
          />
          <StatCard 
            icon={Gift} 
            iconBg="bg-amber-100 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
            value={giftCodeStats.birthday_code_usages_this_year ?? giftCodeStats.birthday_codes_sent_this_year ?? 0}
            label="Birthday Uses (Year)"
          />
          <StatCard 
            icon={Gift} 
            iconBg="bg-purple-100 dark:bg-purple-900/30"
            iconColor="text-purple-600 dark:text-purple-400"
            value={giftCodeStats.anniversary_code_usages_this_year ?? giftCodeStats.anniversary_codes_sent_this_year ?? 0}
            label="Anniversary Uses (Year)"
          />
          <StatCard 
            icon={Sparkles} 
            iconBg="bg-amber-100 dark:bg-amber-900/30"
            iconColor="text-amber-600 dark:text-amber-400"
            value={giftCodeStats.active_festival_codes?.length ?? 0}
            label="Active Festival Codes"
          />
        </div>
      )}

      {/* Actions Bar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Birthday & Anniversary Gift Codes
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Auto-generated discount codes for special occasions
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            onClick={fetchGiftCodeStats}
            variant="outline"
            disabled={loadingGiftCodes}
            className="flex items-center gap-2"
          >
            <RefreshCw size={16} className={loadingGiftCodes ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <Button
            onClick={triggerBirthdayProcessing}
            disabled={processingBirthdays}
            className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white"
          >
            {processingBirthdays ? <Loader2 size={16} className="animate-spin" /> : <Cake size={16} />}
            Send Birthday Wishes
          </Button>
          <Button
            onClick={triggerAnniversaryProcessing}
            disabled={processingAnniversaries}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white"
          >
            {processingAnniversaries ? <Loader2 size={16} className="animate-spin" /> : <Heart size={16} />}
            Send Anniversary Wishes
          </Button>
        </div>
      </div>

      {/* Discount Configuration */}
      {giftCodeStats && (
        <div className="bg-gradient-to-r from-amber-50 to-pink-50 dark:from-amber-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Current Gift Code Configuration</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 dark:text-slate-400">Birthday Discount:</span>
              <span className="ml-2 font-bold text-pink-600 dark:text-pink-400">{giftCodeStats.birthday_discount}% OFF</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Anniversary Discount:</span>
              <span className="ml-2 font-bold text-rose-600 dark:text-rose-400">{giftCodeStats.anniversary_discount}% OFF</span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400">Code Validity:</span>
              <span className="ml-2 font-bold text-slate-800 dark:text-slate-100">{giftCodeStats.code_validity_days} days</span>
            </div>
          </div>
        </div>
      )}

      {/* Upcoming Birthdays & Anniversaries */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingList
          title="Upcoming Birthdays (Next 7 Days)"
          icon={Cake}
          iconColor="text-pink-500"
          loading={loadingGiftCodes}
          items={giftCodeStats?.upcoming_birthdays}
          emptyMessage="No upcoming birthdays in the next 7 days"
          itemBgClass="bg-pink-50 dark:bg-pink-900/20 border-pink-100 dark:border-pink-800"
          itemTextColor="text-pink-600 dark:text-pink-400"
          buttonClass="bg-pink-600 hover:bg-pink-700"
          onSendCode={sendBirthdayCode}
          type="birthday"
        />
        <UpcomingList
          title="Upcoming Anniversaries (Next 7 Days)"
          icon={Heart}
          iconColor="text-rose-500"
          loading={loadingGiftCodes}
          items={giftCodeStats?.upcoming_anniversaries}
          emptyMessage="No upcoming anniversaries in the next 7 days"
          itemBgClass="bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800"
          itemTextColor="text-rose-600 dark:text-rose-400"
          buttonClass="bg-rose-600 hover:bg-rose-700"
          onSendCode={sendAnniversaryCode}
          type="anniversary"
        />
      </div>

      {/* Recent Codes Sent */}
      {giftCodeStats?.recent_codes_sent?.length > 0 && (
        <RecentCodesSentTable codes={giftCodeStats.recent_codes_sent} />
      )}

      {/* Festival Codes Section */}
      <FestivalCodesSection
        showForm={showFestivalForm}
        setShowForm={setShowFestivalForm}
        newFestival={newFestival}
        setNewFestival={setNewFestival}
        creating={creatingFestivalCode}
        onCreate={createFestivalCode}
        onDeactivate={deactivateFestivalCode}
        activeCodes={giftCodeStats?.active_festival_codes}
      />

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
        <div className="flex gap-3">
          <Gift className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={20} />
          <div>
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-1">How Gift Codes Work</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• <strong>Birthday (HAPPYBDAY):</strong> {giftCodeStats?.birthday_discount || 20}% OFF - reusable code, one-time per user per year</li>
              <li>• <strong>Anniversary (ANNIVERSARY):</strong> {giftCodeStats?.anniversary_discount || 15}% OFF - reusable code, one-time per user per year</li>
              <li>• <strong>Festival codes:</strong> {giftCodeStats?.festival_discount || 10}% OFF - custom name, unlimited usage during validity</li>
              <li>• Birthday/Anniversary valid within ±{giftCodeStats?.code_validity_days || 7} days of special date</li>
              <li>• Users need DOB/Anniversary set in their profile to use personal codes</li>
              <li>• System auto-sends birthday/anniversary wishes at 9 AM IST</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

// Sub-components
const StatCard = ({ icon: Icon, iconBg, iconColor, value, label }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${iconBg}`}>
        <Icon size={20} className={iconColor} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
    </div>
  </div>
);

const UpcomingList = ({ 
  title, icon: Icon, iconColor, loading, items, emptyMessage, 
  itemBgClass, itemTextColor, buttonClass, onSendCode, type 
}) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
      <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <Icon size={18} className={iconColor} />
        {title}
      </h3>
    </div>
    <div className="p-4">
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-slate-400" size={24} />
        </div>
      ) : items?.length > 0 ? (
        <div className="space-y-3">
          {items.map((user, idx) => (
            <div key={idx} className={`flex items-center justify-between p-3 rounded-lg border ${itemBgClass}`}>
              <div>
                <p className="font-medium text-slate-800 dark:text-slate-100">{user.name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{user.email}</p>
                <p className={`text-xs ${itemTextColor} mt-1`}>
                  {user.days_until === 0 
                    ? (type === 'birthday' ? '🎂 Today!' : '💕 Today!') 
                    : `In ${user.days_until} day(s)`}
                  {type === 'anniversary' && user.years > 0 && ` • ${user.years} years`}
                </p>
              </div>
              <Button
                onClick={() => onSendCode(user.email)}
                size="sm"
                className={`${buttonClass} text-white`}
              >
                <Send size={14} className="mr-1" />
                Send Code
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Icon size={32} className="mx-auto mb-2 opacity-50" />
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  </div>
);

const RecentCodesSentTable = ({ codes }) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
      <h3 className="font-bold text-slate-800 dark:text-slate-100">Recent Gift Codes Sent</h3>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-slate-50 dark:bg-slate-700/50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Email</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Type</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Code</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase">Sent At</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {codes.map((code, idx) => (
            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
              <td className="px-4 py-3 text-sm text-slate-800 dark:text-slate-200">{code.email}</td>
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  code.type === 'birthday' 
                    ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300'
                    : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                }`}>
                  {code.type === 'birthday' ? '🎂 Birthday' : '💕 Anniversary'}
                </span>
              </td>
              <td className="px-4 py-3">
                <code className="text-sm font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                  {code.code}
                </code>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {(() => {
                  const date = new Date(code.sent_at);
                  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                  const day = String(date.getDate()).padStart(2, '0');
                  const month = months[date.getMonth()];
                  const year = date.getFullYear();
                  const hours = String(date.getHours()).padStart(2, '0');
                  const minutes = String(date.getMinutes()).padStart(2, '0');
                  return `${day}${month}${year} ${hours}:${minutes}`;
                })()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const FestivalCodesSection = ({ 
  showForm, setShowForm, newFestival, setNewFestival, 
  creating, onCreate, onDeactivate, activeCodes 
}) => (
  <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
    <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-4">
      <div>
        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Sparkles size={18} className="text-amber-500" />
          Festival Codes (10% OFF)
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Create custom festival codes for any occasion - unlimited usage during validity
        </p>
      </div>
      <Button
        onClick={() => setShowForm(!showForm)}
        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        data-testid="new-festival-code-btn"
      >
        <Plus size={16} />
        New Festival Code
      </Button>
    </div>

    {/* New Festival Form */}
    {showForm && (
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-amber-50 dark:bg-amber-900/10">
        <form onSubmit={onCreate} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-slate-700 dark:text-slate-300">Festival Name *</Label>
            <Input
              value={newFestival.festival_name}
              onChange={(e) => setNewFestival({ ...newFestival, festival_name: e.target.value })}
              placeholder="e.g., Diwali Sale, Christmas Special"
              required
              className="dark:bg-slate-800 dark:border-slate-600"
              data-testid="festival-name-input"
            />
          </div>
          <div>
            <Label className="text-slate-700 dark:text-slate-300">Start Date *</Label>
            <Input
              type="date"
              value={newFestival.start_date}
              onChange={(e) => setNewFestival({ ...newFestival, start_date: e.target.value })}
              required
              className="dark:bg-slate-800 dark:border-slate-600"
              data-testid="festival-start-date"
            />
          </div>
          <div>
            <Label className="text-slate-700 dark:text-slate-300">End Date *</Label>
            <Input
              type="date"
              value={newFestival.end_date}
              onChange={(e) => setNewFestival({ ...newFestival, end_date: e.target.value })}
              required
              className="dark:bg-slate-800 dark:border-slate-600"
              data-testid="festival-end-date"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={creating}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="create-festival-code-btn"
            >
              {creating ? <Loader2 size={16} className="animate-spin mr-1" /> : <Plus size={16} className="mr-1" />}
              Create
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowForm(false)}
              className="dark:border-slate-600 dark:text-slate-300"
            >
              Cancel
            </Button>
          </div>
        </form>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
          Code will be auto-generated as: FESTIVALNAME{new Date().getFullYear()} (e.g., DIWALI{new Date().getFullYear()})
        </p>
      </div>
    )}

    {/* Active Festival Codes List */}
    <div className="p-4">
      {activeCodes?.length > 0 ? (
        <div className="space-y-3">
          {activeCodes.map((code, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded">
                      {code.code}
                    </code>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                      {code.discount_percent}% OFF
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {code.festival} • Expires: {code.expires_at ? (() => {
                      const date = new Date(code.expires_at);
                      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                      const day = String(date.getDate()).padStart(2, '0');
                      const month = months[date.getMonth()];
                      const year = date.getFullYear();
                      return `${day}${month}${year}`;
                    })() : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">
                    Used {code.times_used || 0} times
                  </p>
                </div>
              </div>
              <Button
                onClick={() => onDeactivate(code.code)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                data-testid={`deactivate-${code.code}`}
              >
                <X size={14} className="mr-1" />
                Deactivate
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 dark:text-slate-400">
          <Sparkles size={32} className="mx-auto mb-2 opacity-50" />
          <p>No active festival codes</p>
          <p className="text-sm mt-1">Create a festival code to offer 10% discount during special occasions</p>
        </div>
      )}
    </div>
  </div>
);

export default GiftCodesTab;
