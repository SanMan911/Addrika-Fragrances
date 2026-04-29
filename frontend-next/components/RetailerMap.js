'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, ExternalLink, Store } from 'lucide-react';

export default function RetailerMap({ retailers }) {
  const mapEl = useRef(null);
  const mapRef = useRef(null);
  const leafletRef = useRef(null);
  const [isMounted, setIsMounted] = useState(false);

  const validRetailers = useMemo(
    () =>
      (retailers || []).filter(
        (r) =>
          r?.coordinates &&
          typeof r.coordinates.lat === 'number' &&
          typeof r.coordinates.lng === 'number'
      ),
    [retailers]
  );

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Initialise / refresh Leaflet map when retailers change
  useEffect(() => {
    if (!isMounted || !mapEl.current) return;

    let cancelled = false;
    (async () => {
      // Load Leaflet only on the client
      if (!leafletRef.current) {
        const L = (await import('leaflet')).default;
        await import('leaflet/dist/leaflet.css');
        // Fix default icon URLs (webpack mangles them)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl:
            'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:
            'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:
            'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });
        leafletRef.current = L;
      }
      if (cancelled) return;
      const L = leafletRef.current;

      // Tear down previous instance (e.g., on retailers prop change)
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.map(mapEl.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
        minZoom: 4,
        maxBounds: [
          [6.0, 67.0],   // SW: covers Lakshadweep / Kerala
          [37.5, 98.0],  // NE: covers J&K / Arunachal
        ],
        maxBoundsViscosity: 0.7,
      }).setView([22.9734, 80.0], 4.6); // India centre — full country in focus

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        }
      ).addTo(map);

      // Custom gold pin (SVG) so it matches the brand
      const goldIcon = L.divIcon({
        className: 'addrika-pin',
        html: `
          <div style="position:relative;width:36px;height:48px;filter:drop-shadow(0 4px 6px rgba(0,0,0,0.5));">
            <svg width="36" height="48" viewBox="0 0 36 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30s18-16.5 18-30C36 8.06 27.94 0 18 0z" fill="#D4AF37"/>
              <path d="M18 2C9.16 2 2 9.16 2 18c0 11.5 16 27 16 27s16-15.5 16-27C34 9.16 26.84 2 18 2z" stroke="#1a1a2e" stroke-width="1.5" fill="#D4AF37"/>
              <circle cx="18" cy="18" r="7" fill="#1a1a2e"/>
              <path d="M14.5 18.5l2.5 2.5 5-5" stroke="#D4AF37" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            </svg>
          </div>
        `,
        iconSize: [36, 48],
        iconAnchor: [18, 46],
        popupAnchor: [0, -42],
      });

      const markers = [];
      validRetailers.forEach((r) => {
        const { lat, lng } = r.coordinates;
        const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        const verifiedBadge = r.is_addrika_verified_partner
          ? `<span style="display:inline-block;background:rgba(212,175,55,0.18);color:#D4AF37;border:1px solid rgba(212,175,55,0.4);padding:2px 8px;border-radius:999px;font-size:10px;font-weight:600;margin-top:6px;letter-spacing:0.5px;">VERIFIED PARTNER</span>`
          : '';
        const fallbackNote =
          r.coordinates_source === 'pincode_fallback'
            ? `<div style="margin-top:6px;font-size:10px;color:#a3a3a3;font-style:italic;">Approximate location (by pincode)</div>`
            : '';
        const popupHtml = `
          <div style="font-family:'Segoe UI',Arial,sans-serif;min-width:220px;max-width:260px;color:#1a1a2e;">
            <div style="font-weight:700;font-size:15px;margin-bottom:4px;color:#1a1a2e;">${escapeHtml(
              r.business_name || 'Addrika Retailer'
            )}</div>
            <div style="font-size:12px;color:#4b5563;line-height:1.4;">
              ${escapeHtml(r.address || '')}${r.address ? ',<br/>' : ''}
              ${escapeHtml(r.district || r.city || '')}${
          r.district || r.city ? ', ' : ''
        }${escapeHtml(r.state || '')} ${escapeHtml(r.pincode || '')}
            </div>
            ${verifiedBadge}
            ${fallbackNote}
            <div style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;">
              <a href="${directionsUrl}" target="_blank" rel="noopener noreferrer"
                 style="display:inline-flex;align-items:center;gap:4px;background:#D4AF37;color:#1a1a2e;text-decoration:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;">
                Directions →
              </a>
              ${
                r.phone
                  ? `<a href="https://wa.me/91${
                      r.phone
                    }?text=${encodeURIComponent(
                      "Hi, I'm interested in Addrika Fragrances"
                    )}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-flex;align-items:center;gap:4px;background:#25D366;color:#fff;text-decoration:none;padding:6px 10px;border-radius:6px;font-size:11px;font-weight:600;">
                       WhatsApp
                     </a>`
                  : ''
              }
            </div>
          </div>
        `;
        const marker = L.marker([lat, lng], { icon: goldIcon })
          .addTo(map)
          .bindPopup(popupHtml, { maxWidth: 280 });
        markers.push(marker);
      });

      // Always land with the full India map in focus.
      // Pins are visible at this zoom; users can click pins or scroll the
      // retailer cards below for details. We deliberately do NOT auto-fit
      // to marker bounds.

      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [isMounted, validRetailers]);

  const openFullMap = () => {
    if (validRetailers.length === 0) return;
    if (validRetailers.length === 1) {
      const r = validRetailers[0];
      window.open(
        `https://www.google.com/maps/search/?api=1&query=${r.coordinates.lat},${r.coordinates.lng}`,
        '_blank'
      );
    } else {
      const params = validRetailers
        .map((r) => `${r.coordinates.lat},${r.coordinates.lng}`)
        .join('/');
      window.open(`https://www.google.com/maps/dir/${params}`, '_blank');
    }
  };

  const scrollToRetailers = () => {
    document
      .getElementById('authorized-retailers')
      ?.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isMounted) {
    return (
      <div
        className="w-full h-[400px] md:h-[500px] rounded-2xl overflow-hidden flex items-center justify-center"
        style={{
          background:
            'linear-gradient(135deg, rgba(26,26,46,0.9) 0%, rgba(22,33,62,0.9) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        data-testid="retailer-map-loading"
      >
        <div className="text-center">
          <MapPin
            size={48}
            className="mx-auto mb-4 text-[#D4AF37] animate-pulse"
          />
          <p className="text-gray-400">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-2xl overflow-hidden relative"
      style={{ border: '1px solid rgba(212,175,55,0.3)' }}
      data-testid="retailer-map"
    >
      <div
        ref={mapEl}
        className="h-[400px] md:h-[500px] w-full"
        style={{ background: '#0f1419' }}
        data-testid="retailer-map-canvas"
      />

      {/* Empty state overlay */}
      {validRetailers.length === 0 && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ background: 'rgba(15,20,25,0.85)' }}
          data-testid="retailer-map-empty"
        >
          <div className="text-center px-6">
            <Store size={40} className="mx-auto mb-3 text-[#D4AF37]" />
            <p className="text-white font-semibold mb-1">
              No mappable stores yet
            </p>
            <p className="text-gray-400 text-sm">
              Retailers will appear here as they come online.
            </p>
          </div>
        </div>
      )}

      {/* Store count overlay */}
      <button
        onClick={scrollToRetailers}
        className="absolute top-4 right-4 p-3 rounded-xl text-left transition-transform hover:scale-105 z-[400]"
        style={{
          background: 'rgba(26,26,46,0.95)',
          border: '1px solid rgba(212,175,55,0.3)',
          backdropFilter: 'blur(8px)',
        }}
        data-testid="retailer-map-count"
      >
        <p className="text-sm font-semibold text-[#D4AF37] mb-1">
          {validRetailers.length} Pinned Store
          {validRetailers.length !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-gray-400">Click to view details ↓</p>
      </button>

      {/* Open in Google Maps */}
      {validRetailers.length > 0 && (
        <button
          onClick={openFullMap}
          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-transform hover:scale-105 z-[400]"
          style={{
            background: 'linear-gradient(135deg, #D4AF37 0%, #c9a432 100%)',
            color: '#1a1a2e',
          }}
          data-testid="retailer-map-open-google"
        >
          <ExternalLink size={14} />
          Open in Google Maps
        </button>
      )}
    </div>
  );
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
