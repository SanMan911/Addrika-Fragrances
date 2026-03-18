import React, { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';

const LANGUAGE_STORAGE_KEY = 'addrika_language_preference';

// Language code to name mapping for display
const LANGUAGE_NAMES = {
  'en': 'English',
  'hi': 'Hindi',
  'bn': 'Bengali',
  'te': 'Telugu',
  'mr': 'Marathi',
  'ta': 'Tamil',
  'gu': 'Gujarati',
  'kn': 'Kannada',
  'ml': 'Malayalam',
  'pa': 'Punjabi',
  'or': 'Odia',
  'as': 'Assamese',
  'ur': 'Urdu',
  'sd': 'Sindhi',
  'ks': 'Kashmiri',
  'ne': 'Nepali',
  'sa': 'Sanskrit',
  'kok': 'Konkani',
  'doi': 'Dogri',
  'mni': 'Manipuri',
  'sat': 'Santali',
  'mai': 'Maithili'
};

const GoogleTranslate = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  // Function to set language via Google Translate cookie
  const setLanguagePreference = (langCode) => {
    if (langCode && langCode !== 'en') {
      // Set Google Translate cookie
      document.cookie = `googtrans=/en/${langCode}; path=/; domain=${window.location.hostname}`;
      document.cookie = `googtrans=/en/${langCode}; path=/`;
    } else {
      // Clear translation (back to English)
      document.cookie = `googtrans=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  };

  // Function to get saved language from localStorage
  const getSavedLanguage = () => {
    return localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'en';
  };

  // Function to save language to localStorage
  const saveLanguage = (langCode) => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, langCode);
  };

  // Watch for language changes from Google Translate
  useEffect(() => {
    const checkLanguageChange = () => {
      const iframe = document.querySelector('.goog-te-menu-frame');
      if (iframe) {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          const links = iframeDoc.querySelectorAll('.goog-te-menu2-item');
          
          links.forEach(link => {
            link.addEventListener('click', () => {
              // Small delay to let Google Translate update
              setTimeout(() => {
                const currentLang = getCurrentLanguage();
                if (currentLang) {
                  saveLanguage(currentLang);
                }
              }, 500);
            });
          });
        } catch (e) {
          // Cross-origin issues - use cookie-based detection instead
        }
      }
    };

    // Also monitor cookie changes
    const observeLanguageFromCookie = () => {
      const cookies = document.cookie.split(';');
      for (let cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'googtrans' && value) {
          const langMatch = value.match(/\/en\/(\w+)/);
          if (langMatch && langMatch[1]) {
            const currentSaved = getSavedLanguage();
            if (langMatch[1] !== currentSaved) {
              saveLanguage(langMatch[1]);
            }
          }
        }
      }
    };

    // Check periodically for language changes
    const interval = setInterval(() => {
      observeLanguageFromCookie();
    }, 2000);

    // Initial check
    setTimeout(checkLanguageChange, 3000);

    return () => clearInterval(interval);
  }, [isLoaded]);

  // Get current language from Google Translate cookie
  const getCurrentLanguage = () => {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split('=');
      if (name === 'googtrans' && value) {
        const langMatch = value.match(/\/en\/(\w+)/);
        if (langMatch && langMatch[1]) {
          return langMatch[1];
        }
      }
    }
    return 'en';
  };

  useEffect(() => {
    // Restore saved language preference on mount
    const savedLang = getSavedLanguage();
    if (savedLang && savedLang !== 'en') {
      setLanguagePreference(savedLang);
    }

    // Add Google Translate script
    const addGoogleTranslateScript = () => {
      // Check if script already exists
      if (document.getElementById('google-translate-script')) {
        setIsLoaded(true);
        return;
      }

      // Define the callback function globally
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,ml,pa,or,as,ur,sd,ks,ne,sa,kok,doi,mni,sat,mai',
            // English, Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, 
            // Punjabi, Odia, Assamese, Urdu, Sindhi, Kashmiri, Nepali, Sanskrit, Konkani, 
            // Dogri, Manipuri, Santali, Maithili
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          },
          'google_translate_element'
        );
        setIsLoaded(true);
      };

      // Create and append the script
      const script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    };

    addGoogleTranslateScript();

    // Cleanup function
    return () => {
      // Remove the callback function
      delete window.googleTranslateElementInit;
    };
  }, []);

  return (
    <div className="flex items-center gap-2">
      <Globe 
        size={18} 
        className="flex-shrink-0"
        style={{ color: 'var(--japanese-indigo)' }} 
      />
      <div 
        id="google_translate_element" 
        className="google-translate-wrapper"
      />
      
      {/* Custom CSS to style Google Translate widget */}
      <style>{`
        /* Hide Google Translate branding and improve styling */
        .google-translate-wrapper {
          display: inline-block;
        }
        
        .google-translate-wrapper .goog-te-gadget {
          font-family: inherit !important;
          font-size: 13px !important;
        }
        
        .google-translate-wrapper .goog-te-gadget-simple {
          background-color: transparent !important;
          border: 1px solid var(--border) !important;
          border-radius: 6px !important;
          padding: 4px 8px !important;
          cursor: pointer !important;
          transition: border-color 0.2s ease !important;
        }
        
        .google-translate-wrapper .goog-te-gadget-simple:hover {
          border-color: var(--japanese-indigo) !important;
        }
        
        .google-translate-wrapper .goog-te-gadget-icon {
          display: none !important;
        }
        
        .google-translate-wrapper .goog-te-gadget-simple span {
          color: var(--text-primary) !important;
          font-size: 13px !important;
        }
        
        /* Hide "Powered by Google" text */
        .goog-te-gadget span {
          display: none !important;
        }
        
        .goog-te-gadget span:first-child {
          display: inline !important;
        }
        
        /* Dark mode adjustments */
        .dark .google-translate-wrapper .goog-te-gadget-simple {
          background-color: var(--card-background) !important;
          border-color: var(--border) !important;
        }
        
        .dark .google-translate-wrapper .goog-te-gadget-simple span {
          color: var(--text-primary) !important;
        }
        
        /* Hide the Google Translate top bar */
        .goog-te-banner-frame {
          display: none !important;
        }
        
        body {
          top: 0 !important;
        }
        
        /* Style the dropdown */
        .goog-te-menu-frame {
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
        }
      `}</style>
    </div>
  );
};

export default GoogleTranslate;
