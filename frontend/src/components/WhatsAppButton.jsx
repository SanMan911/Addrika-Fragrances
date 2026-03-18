import React from 'react';
import { MessageCircle } from 'lucide-react';

const WhatsAppButton = () => {
  const whatsappNumber = '919667269711'; // Format: country code + number (no spaces or special chars)
  const defaultMessage = 'Hi! I am interested in Addrika premium agarbattis.';
  
  const handleWhatsAppClick = () => {
    const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(defaultMessage)}`;
    window.open(url, '_blank');
  };

  return (
    <button
      onClick={handleWhatsAppClick}
      className="fixed z-[9999] flex items-center justify-center gap-2 sm:gap-3 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
      style={{
        backgroundColor: '#25D366',
        color: 'white',
        transform: 'scale(1)',
        bottom: '8px',
        right: '8px',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      aria-label="Chat on WhatsApp"
      data-testid="whatsapp-chat-btn"
    >
      {/* Mobile: smaller circular button, Desktop: pill with text */}
      <div className="p-3 sm:py-3 sm:px-6 flex items-center gap-2 sm:gap-3">
        <MessageCircle size={24} className="sm:w-6 sm:h-6 w-5 h-5" />
        <span className="hidden sm:inline font-semibold text-base">Chat with us</span>
      </div>
    </button>
  );
};

export default WhatsAppButton;
