'use client';

import { useState, useEffect } from 'react';
import { MapPin, Navigation, Phone, ExternalLink } from 'lucide-react';

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

  // Generate Google Maps URL with markers for all retailers
  const getGoogleMapWithMarkers = () => {
    if (!retailers || retailers.length === 0) {
      // Default India view
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7340000!2d78.9629!3d22.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30635ff06b92b791%3A0xd78c4fa1854213a6!2sIndia!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin`;
    }

    const validRetailers = retailers.filter(r => r.coordinates?.lat && r.coordinates?.lng);
    
    if (validRetailers.length === 0) {
      return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7340000!2d78.9629!3d22.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30635ff06b92b791%3A0xd78c4fa1854213a6!2sIndia!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin`;
    }

    // For multiple retailers, create a directions/places URL that shows all locations
    // Using the "dir" mode with waypoints to show multiple markers
    if (validRetailers.length === 1) {
      const r = validRetailers[0];
      return `https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=${r.coordinates.lat},${r.coordinates.lng}&zoom=14`;
    }

    // For multiple retailers, show a view that encompasses all of them
    // Calculate center point
    const lats = validRetailers.map(r => r.coordinates.lat);
    const lngs = validRetailers.map(r => r.coordinates.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    
    // Create a search query that shows India with focus on retailer regions
    return `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d7340000!2d78.9629!3d22.5!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30635ff06b92b791%3A0xd78c4fa1854213a6!2sIndia!5e0!3m2!1sen!2sin!4v1700000000000!5m2!1sen!2sin`;
  };

  // Open Google Maps with all retailer locations as waypoints
  const openFullMap = () => {
    if (!retailers || retailers.length === 0) return;
    
    const validRetailers = retailers.filter(r => r.coordinates?.lat && r.coordinates?.lng);
    if (validRetailers.length === 0) return;

    // Create a Google Maps URL with all locations
    if (validRetailers.length === 1) {
      const r = validRetailers[0];
      window.open(`https://www.google.com/maps/search/?api=1&query=${r.coordinates.lat},${r.coordinates.lng}`, '_blank');
    } else {
      // For multiple locations, use the first as origin, last as destination, rest as waypoints
      const origin = validRetailers[0];
      const destination = validRetailers[validRetailers.length - 1];
      const waypoints = validRetailers.slice(1, -1).map(r => `${r.coordinates.lat},${r.coordinates.lng}`).join('|');
      
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin.coordinates.lat},${origin.coordinates.lng}&destination=${destination.coordinates.lat},${destination.coordinates.lng}`;
      if (waypoints) {
        url += `&waypoints=${waypoints}`;
      }
      window.open(url, '_blank');
    }
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

  const validRetailers = retailers?.filter(r => r.coordinates?.lat && r.coordinates?.lng) || [];

  return (
    <div className="space-y-4">
      {/* Map Container with Retailer Markers Overlay */}
      <div 
        className="w-full rounded-2xl overflow-hidden relative"
        style={{ border: '1px solid rgba(212,175,55,0.3)' }}
      >
        {/* Google Maps Embed */}
        <div className="h-[350px] md:h-[400px] relative">
          <iframe
            src={getGoogleMapWithMarkers()}
            className="w-full h-full"
            style={{ border: 0 }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title="Addrika Retailers - India Map"
          />
          
          {/* Overlay with retailer markers legend */}
          <div 
            className="absolute top-4 right-4 p-3 rounded-xl max-w-[200px]"
            style={{ 
              background: 'rgba(26,26,46,0.95)',
              border: '1px solid rgba(212,175,55,0.3)',
              backdropFilter: 'blur(8px)'
            }}
          >
            <p className="text-xs font-semibold text-[#D4AF37] mb-2">
              {validRetailers.length} Store{validRetailers.length !== 1 ? 's' : ''} in India
            </p>
            <div className="space-y-1">
              {validRetailers.slice(0, 3).map((retailer, idx) => (
                <div key={retailer.id || idx} className="flex items-center gap-2 text-xs text-gray-300">
                  <div 
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: '#D4AF37' }}
                  />
                  <span className="truncate">{retailer.district}, {retailer.state}</span>
                </div>
              ))}
              {validRetailers.length > 3 && (
                <p className="text-xs text-gray-500">+{validRetailers.length - 3} more</p>
              )}
            </div>
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
              View All on Google Maps
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

      {/* Retailer Cards with Map Links */}
      {retailers && retailers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {retailers.map((retailer, index) => (
            <div
              key={retailer.id || index}
              className="p-5 rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg"
              style={{ 
                background: 'linear-gradient(165deg, rgba(26,26,46,0.95) 0%, rgba(22,33,62,0.95) 100%)',
                border: selectedRetailer?.id === retailer.id 
                  ? '2px solid #D4AF37' 
                  : '1px solid rgba(212,175,55,0.2)'
              }}
              onClick={() => handleRetailerClick(retailer)}
            >
              <div className="flex items-start gap-4">
                {/* Store Icon with Marker Number */}
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                  style={{ background: 'linear-gradient(135deg, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.1) 100%)' }}
                >
                  <MapPin size={24} className="text-[#D4AF37]" />
                  <span 
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#D4AF37', color: '#1a1a2e' }}
                  >
                    {index + 1}
                  </span>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white">{retailer.business_name}</h4>
                  <p className="text-sm text-gray-400 mt-1">
                    {retailer.address}
                  </p>
                  <p className="text-xs text-[#D4AF37] mt-1">
                    {retailer.district}, {retailer.state} - {retailer.pincode}
                  </p>
                  
                  {/* Contact & Actions */}
                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    {retailer.phone && (
                      <a
                        href={`tel:+91${retailer.phone}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{ 
                          background: 'rgba(212,175,55,0.15)',
                          color: '#D4AF37',
                          border: '1px solid rgba(212,175,55,0.3)'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Phone size={12} />
                        +91 {retailer.phone}
                      </a>
                    )}
                    {retailer.coordinates?.lat && retailer.coordinates?.lng && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${retailer.coordinates.lat},${retailer.coordinates.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
                        style={{ 
                          background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
                          color: '#1a1a2e'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Navigation size={12} />
                        View on Map
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Info text */}
      <p className="text-center text-xs text-gray-500">
        Click on any store card to view its location on Google Maps. New authorized retailers are automatically added here.
      </p>
    </div>
  );
}
