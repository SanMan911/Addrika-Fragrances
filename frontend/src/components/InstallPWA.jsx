import React, { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from './ui/button';

const InstallPWA = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches 
      || window.navigator.standalone 
      || document.referrer.includes('android-app://');
    setIsStandalone(standalone);

    // Check if iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);

    // Check if dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    if (dismissed && dismissedTime > sevenDaysAgo) {
      return; // Don't show if dismissed within last 7 days
    }

    // Listen for beforeinstallprompt event (Android/Chrome)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      // Show prompt after a delay (better UX)
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000); // Show after 5 seconds on site
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show custom instructions after some time on site
    if (isIOSDevice && !standalone) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 10000); // Show after 10 seconds for iOS
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      // For iOS, just close the prompt (instructions are shown)
      setShowPrompt(false);
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // Clear the deferredPrompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  // Don't show if already installed or shouldn't show
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <div 
      className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-40 animate-fade-in-up"
      data-testid="pwa-install-prompt"
    >
      <div 
        className="rounded-xl shadow-2xl overflow-hidden"
        style={{ 
          backgroundColor: 'var(--japanese-indigo)',
          border: '1px solid rgba(212, 175, 55, 0.3)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(212, 175, 55, 0.2)' }}
            >
              <Smartphone size={20} style={{ color: 'var(--metallic-gold)' }} />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Install Addrika</h3>
              <p className="text-white/60 text-xs">Add to Home Screen</p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Dismiss"
          >
            <X size={18} className="text-white/60" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {isIOS ? (
            // iOS instructions
            <div className="text-white/80 text-sm space-y-2">
              <p>Install this app on your iPhone:</p>
              <ol className="list-decimal list-inside space-y-1 text-white/70 text-xs">
                <li>Tap the <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded">Share</span> button</li>
                <li>Scroll down and tap <span className="font-medium text-white">"Add to Home Screen"</span></li>
                <li>Tap <span className="font-medium text-white">"Add"</span> to confirm</li>
              </ol>
            </div>
          ) : (
            // Android/Desktop
            <p className="text-white/80 text-sm mb-3">
              Install our app for quick access, offline browsing, and a better shopping experience.
            </p>
          )}

          <Button
            onClick={handleInstallClick}
            className="w-full mt-2 font-medium"
            style={{ 
              backgroundColor: 'var(--metallic-gold)',
              color: 'var(--japanese-indigo)'
            }}
          >
            <Download size={16} className="mr-2" />
            {isIOS ? 'Got it!' : 'Install App'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default InstallPWA;
