'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';

export default function RetailerMap({ retailers, onSelectRetailer }) {
  const [selectedRetailer, setSelectedRetailer] = useState(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // India bounding box - shows entire India map
  // bbox format: west,south,east,north (minLng,minLat,maxLng,maxLat)
  const INDIA_BBOX = '68.1766,6.7471,97.4026,35.5087';
  
  const getMapUrl = () => {
    // Always show India map with proper zoom
    return `https://www.openstreetmap.org/export/embed.html?bbox=${INDIA_BBOX}&layer=mapnik`;
  };

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

  return (
    <div className="space-y-4">
      {/* Map Container */}
      <div 
        className="w-full h-[350px] md:h-[450px] rounded-2xl overflow-hidden relative"
        style={{ border: '1px solid rgba(212,175,55,0.3)' }}
      >
        <iframe
          src={getMapUrl()}
          className="w-full h-full"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Addrika Retailers Map - India"
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
          <span className="text-gray-400">Powered by </span>
          <span className="text-[#D4AF37]">OpenStreetMap</span>
        </div>
      </div>

      {/* Quick Location Buttons */}
      {retailers && retailers.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {retailers.map((retailer, index) => (
            retailer.coordinates?.lat && retailer.coordinates?.lng && (
              <a
                key={retailer.id || index}
                href={`https://www.google.com/maps/search/?api=1&query=${retailer.coordinates.lat},${retailer.coordinates.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-3 rounded-xl transition-all hover:scale-105"
                style={{ 
                  background: selectedRetailer?.id === retailer.id 
                    ? 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)'
                    : 'linear-gradient(165deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
                  color: selectedRetailer?.id === retailer.id ? '#1a1a2e' : 'white',
                  border: '1px solid rgba(212,175,55,0.3)'
                }}
                onClick={(e) => {
                  // Don't prevent default - let the link work
                  handleRetailerClick(retailer);
                }}
              >
                <MapPin size={16} className={selectedRetailer?.id === retailer.id ? 'text-[#1a1a2e]' : 'text-[#D4AF37]'} />
                <div className="text-left">
                  <div className="font-semibold text-sm">{retailer.business_name}</div>
                  <div className={`text-xs ${selectedRetailer?.id === retailer.id ? 'text-[#1a1a2e]/70' : 'text-gray-400'}`}>
                    {retailer.district}, {retailer.state}
                  </div>
                </div>
                <ExternalLink size={14} className={`ml-2 ${selectedRetailer?.id === retailer.id ? 'text-[#1a1a2e]' : 'text-gray-500'}`} />
              </a>
            )
          ))}
        </div>
      )}
    </div>
  );
}
