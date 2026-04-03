'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink, Phone } from 'lucide-react';

export default function RetailerMap({ retailers, onSelectRetailer }) {
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleRetailerClick = (retailer) => {
    setSelectedRetailer(retailer);
    if (onSelectRetailer) onSelectRetailer(retailer);
  };

  if (!isMounted) {
    return (
      <div 
        className="w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden flex items-center justify-center"
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

  // Use Google Maps embed - respects Indian territorial boundaries
  // Center on India with both Delhi and Bihar visible
  const getGoogleMapUrl = () => {
    // Center point between Delhi (28.6, 77.2) and Bhagalpur (25.2, 87.0)
    // Approximate center: 26.9, 82.1
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7340000!2d78.9629!3d22.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30635ff06b92b791%3A0xd78c4fa1854213a6!2sIndia!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin`;
  };

  return (
    <div className="space-y-4">
      {/* Map Container - Using Google Maps which shows correct Indian borders */}
      <div 
        className="w-full h-[350px] md:h-[450px] rounded-2xl overflow-hidden relative"
        style={{ border: '1px solid rgba(212,175,55,0.3)' }}
      >
        <iframe
          src={getGoogleMapUrl()}
          className="w-full h-full"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Addrika Retailers - India Map"
        />
        
        {/* Map Overlay with Legend */}
        <div 
          className="absolute bottom-4 left-4 px-4 py-2 rounded-lg text-xs"
          style={{ 
            background: 'rgba(26,26,46,0.95)',
            border: '1px solid rgba(212,175,55,0.3)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <span className="text-gray-400">Map data </span>
          <span className="text-[#D4AF37]">© Google</span>
        </div>
      </div>

      {/* Retailer Location Cards */}
      {retailers && retailers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {retailers.map((retailer, index) => (
            <div
              key={retailer.id || index}
              className="p-4 rounded-xl transition-all hover:scale-[1.02]"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                border: '1px solid rgba(212,175,55,0.3)'
              }}
            >
              <div className="flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(212,175,55,0.2)' }}
                >
                  <MapPin size={20} className="text-[#D4AF37]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white text-sm">{retailer.business_name}</h4>
                  <p className="text-xs text-gray-400 mt-1">
                    {retailer.district}, {retailer.state}
                  </p>
                  
                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {retailer.phone && (
                      <a
                        href={`tel:+91${retailer.phone}`}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{ 
                          background: 'rgba(212,175,55,0.15)',
                          color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.3)'
                        }}
                      >
                        <Phone size={12} />
                        Call
                      </a>
                    )}
                    {retailer.coordinates?.lat && retailer.coordinates?.lng && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${retailer.coordinates.lat},${retailer.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{ 
                          background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                          color: '#1a1a2e'
                        }}
                      >
                        <Navigation size={12} />
                        Directions
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
