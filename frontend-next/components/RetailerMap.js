'use client';

import { useState, useEffect } from 'react';
import { MapPin, ExternalLink } from 'lucide-react';

export default function RetailerMap({ retailers }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Generate Google Maps URL
  const getGoogleMapUrl = () => {
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7340000!2d78.9629!3d22.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30635ff06b92b791%3A0xd78c4fa1854213a6!2sIndia!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin`;
  };

  // Open Google Maps with all retailer locations
  const openFullMap = () => {
    if (!retailers || retailers.length === 0) return;
    
    const validRetailers = retailers.filter(r => r.coordinates?.lat && r.coordinates?.lng);
    if (validRetailers.length === 0) return;

    if (validRetailers.length === 1) {
      const r = validRetailers[0];
      window.open(`https://www.google.com/maps/search/?api=1&query=${r.coordinates.lat},${r.coordinates.lng}`, '_blank');
    } else {
      const origin = validRetailers[0];
      const destination = validRetailers[validRetailers.length - 1];
      window.open(`https://www.google.com/maps/dir/?api=1&origin=${origin.coordinates.lat},${origin.coordinates.lng}&destination=${destination.coordinates.lat},${destination.coordinates.lng}`, '_blank');
    }
  };

  // Scroll to retailers section
  const scrollToRetailers = () => {
    document.getElementById('authorized-retailers')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isMounted) {
    return (
      <div 
        className="w-full h-[350px] md:h-[400px] rounded-2xl overflow-hidden flex items-center justify-center"
        style={{ 
          background: 'linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.1)'
        }}
      >
        <div className="text-center">
          <MapPin size={48} className="mx-auto mb-4 text-[#D4AF37] animate-pulse" />
          <p className="text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  const validRetailers = retailers?.filter(r => r.coordinates?.lat && r.coordinates?.lng) || [];

  return (
    <div 
      className="w-full rounded-2xl overflow-hidden relative"
      style={{ border: '1px solid rgba(212,175,55,0.3)' }}
    >
      {/* Google Maps Embed */}
      <div className="h-[350px] md:h-[400px] relative">
        <iframe
          src={getGoogleMapUrl()}
          className="w-full h-full"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Addrika Retailers - India Map"
        />
        
        {/* Store count overlay */}
        <div 
          className="absolute top-4 right-4 p-3 rounded-xl cursor-pointer hover:scale-105 transition-transform"
          style={{ 
            background: 'rgba(26,26,46,0.95)',
            border: '1px solid rgba(212,175,55,0.3)',
            backdropFilter: 'blur(8px)'
          }}
          onClick={scrollToRetailers}
        >
          <p className="text-sm font-semibold text-[#D4AF37] mb-1">
            {validRetailers.length} Store{validRetailers.length !== 1 ? 's' : ''} in India
          </p>
          <p className="text-xs text-gray-400">Click to view details ↓</p>
        </div>

        {/* View All on Map button */}
        {validRetailers.length > 0 && (
          <button
            onClick={openFullMap}
            className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
            style={{ 
              background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
              color: '#1a1a2e'
            }}
          >
            <ExternalLink size={14} />
            Open in Google Maps
          </button>
        )}
        
        {/* Attribution */}
        <div 
          className="absolute bottom-4 left-4 px-3 py-1.5 rounded-lg text-xs"
          style={{ 
            background: 'rgba(26,26,46,0.95)',
            border: '1px solid rgba(212,175,55,0.3)'
          }}
        >
          <span className="text-gray-400">Map © </span>
          <span className="text-[#D4AF37]">Google</span>
        </div>
      </div>
    </div>
  );
}
