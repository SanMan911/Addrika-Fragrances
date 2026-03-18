import React from 'react';
import { Send } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';

const InstagramTab = ({ 
  instaNotification, 
  setInstaNotification, 
  sendInstagramNotification,
  activeSubscribersCount 
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700" data-testid="instagram-tab">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
          Instagram Notifications
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          @addrika.fragrances • Notify subscribers about new posts
        </p>
      </div>
      
      <div className="p-6">
        <div className="p-4 rounded-lg mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
          <h3 className="font-semibold mb-4 text-slate-800 dark:text-slate-100">
            Send Instagram Post Notification
          </h3>
          <form onSubmit={sendInstagramNotification} className="space-y-4">
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Instagram Post URL *</Label>
              <Input
                value={instaNotification.postUrl}
                onChange={(e) => setInstaNotification({ ...instaNotification, postUrl: e.target.value })}
                placeholder="https://www.instagram.com/p/..."
                required
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                data-testid="instagram-post-url"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Caption (optional)</Label>
              <textarea
                value={instaNotification.caption}
                onChange={(e) => setInstaNotification({ ...instaNotification, caption: e.target.value })}
                placeholder="Add a caption for the email"
                className="w-full p-2 border rounded min-h-[80px] bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                data-testid="instagram-caption"
              />
            </div>
            <div>
              <Label className="text-slate-700 dark:text-slate-300">Image URL (optional - for email preview)</Label>
              <Input
                value={instaNotification.imageUrl}
                onChange={(e) => setInstaNotification({ ...instaNotification, imageUrl: e.target.value })}
                placeholder="https://..."
                className="dark:bg-slate-700 dark:border-slate-600 dark:text-slate-200"
                data-testid="instagram-image-url"
              />
            </div>
            <Button 
              type="submit" 
              className="flex items-center gap-2 text-white bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              data-testid="send-instagram-notification"
            >
              <Send size={18} /> Notify {activeSubscribersCount} Subscribers
            </Button>
          </form>
        </div>

        <p className="text-sm text-center text-slate-500 dark:text-slate-400">
          <strong>Tip:</strong> After posting on Instagram, paste the post URL here to notify your subscribers via email.
        </p>
      </div>
    </div>
  );
};

export default InstagramTab;
