import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, ArrowLeft, Home, Navigation, Phone, Mail, MessageCircle } from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const FindRetailers = () => {
  const navigate = useNavigate();
  const [selectedCountry, setSelectedCountry] = useState('India');
  const [selectedState, setSelectedState] = useState('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [retailers, setRetailers] = useState([]);
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);

  // State coordinates for zoom functionality with bounds for fitBounds
  const stateCoordinates = {
    'Delhi': { lat: 28.6139, lng: 77.2090, zoom: 10, bounds: [[28.40, 76.83], [28.88, 77.35]] },
    'Bihar': { lat: 25.0961, lng: 85.3131, zoom: 7, bounds: [[24.28, 83.32], [27.52, 88.17]] },
    'Maharashtra': { lat: 19.7515, lng: 75.7139, zoom: 6, bounds: [[15.60, 72.60], [22.03, 80.90]] },
    'Uttar Pradesh': { lat: 26.8467, lng: 80.9462, zoom: 6, bounds: [[23.87, 77.08], [30.41, 84.63]] },
    'Karnataka': { lat: 15.3173, lng: 75.7139, zoom: 7, bounds: [[11.59, 74.05], [18.45, 78.57]] },
    'Tamil Nadu': { lat: 11.1271, lng: 78.6569, zoom: 7, bounds: [[8.07, 76.23], [13.56, 80.35]] },
    'Gujarat': { lat: 22.2587, lng: 71.1924, zoom: 7, bounds: [[20.12, 68.16], [24.71, 74.48]] },
    'Rajasthan': { lat: 27.0238, lng: 74.2179, zoom: 6, bounds: [[23.06, 69.48], [30.19, 78.27]] },
    'West Bengal': { lat: 22.9868, lng: 87.8550, zoom: 7, bounds: [[21.53, 85.82], [27.22, 89.88]] },
    'Madhya Pradesh': { lat: 22.9734, lng: 78.6569, zoom: 6, bounds: [[21.08, 74.03], [26.87, 82.81]] },
    'Punjab': { lat: 31.1471, lng: 75.3412, zoom: 8, bounds: [[29.53, 73.87], [32.51, 76.94]] },
    'Haryana': { lat: 29.0588, lng: 76.0856, zoom: 8, bounds: [[27.65, 74.45], [30.92, 77.60]] },
    'Andhra Pradesh': { lat: 15.9129, lng: 79.7400, zoom: 7, bounds: [[12.62, 76.76], [19.91, 84.78]] },
    'Telangana': { lat: 18.1124, lng: 79.0193, zoom: 8, bounds: [[15.83, 77.27], [19.91, 81.33]] },
    'Kerala': { lat: 10.8505, lng: 76.2711, zoom: 8, bounds: [[8.29, 74.86], [12.79, 77.41]] },
    'Odisha': { lat: 20.9517, lng: 85.0985, zoom: 7, bounds: [[17.78, 81.38], [22.57, 87.48]] },
    'Jharkhand': { lat: 23.6102, lng: 85.2799, zoom: 8, bounds: [[21.97, 83.32], [25.34, 87.92]] },
    'Assam': { lat: 26.2006, lng: 92.9376, zoom: 7, bounds: [[24.13, 89.69], [28.00, 96.02]] },
    'Chhattisgarh': { lat: 21.2787, lng: 81.8661, zoom: 7, bounds: [[17.78, 80.24], [24.12, 84.40]] },
    'Uttarakhand': { lat: 30.0668, lng: 79.0193, zoom: 8, bounds: [[28.72, 77.57], [31.46, 81.02]] },
    'Himachal Pradesh': { lat: 31.1048, lng: 77.1734, zoom: 8, bounds: [[30.38, 75.58], [33.26, 79.00]] },
    'Goa': { lat: 15.2993, lng: 74.1240, zoom: 10, bounds: [[14.89, 73.68], [15.80, 74.34]] }
  };

  // Default retailers (fallback) - now with WhatsApp and email
  const defaultRetailers = [
    {
      id: 1,
      name: 'M.G. Shoppie',
      address: '745, Sector 17 Pocket A Phase II, Dwarka',
      city: 'South-West Delhi',
      pincode: '110078',
      state: 'Delhi',
      phone: '(+91) 6202-311-736',
      phone_raw: '6202311736',
      whatsapp: '916202311736',
      email: 'amitkumar.911@proton.me',  // Test email
      coordinates: { lat: 28.5921, lng: 77.0460 }
    },
    {
      id: 2,
      name: 'Mela Stores',
      address: 'D. N. Singh Road, Variety Chowk',
      city: 'Bhagalpur',
      pincode: '812002',
      state: 'Bihar',
      phone: '(+91) 70-614-83-566',
      phone_raw: '7061483566',
      whatsapp: '917061483566',
      email: 'mr.amitbgp@gmail.com',  // Test email
      coordinates: { lat: 25.2425, lng: 87.0048 }
    }
  ];

  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Fetch retailers from backend
  useEffect(() => {
    const fetchRetailers = async () => {
      try {
        const response = await axios.get(`${API_URL}/api/maps/retailers`);
        if (response.data?.retailers) {
          setRetailers(response.data.retailers);
        } else {
          setRetailers(defaultRetailers);
        }
      } catch (error) {
        console.error('Failed to fetch retailers:', error);
        setRetailers(defaultRetailers);
      }
    };
    fetchRetailers();
  }, []);

  // Handle state selection - zoom to selected state using fitBounds
  useEffect(() => {
    if (!mapLoaded || !leafletMapRef.current) return;
    
    const coords = selectedState ? stateCoordinates[selectedState] : null;
    const map = leafletMapRef.current;
    
    if (coords && coords.bounds) {
      map.fitBounds(coords.bounds, { padding: [20, 20], maxZoom: coords.zoom + 1 });
    } else {
      map.setView([22.5937, 78.9629], 5);
    }
  }, [selectedState, mapLoaded]);

  // Zoom to specific retailer on map
  const zoomToRetailer = (retailer) => {
    if (!mapLoaded || !leafletMapRef.current) return;
    
    const { lat, lng } = retailer.coordinates;
    const map = leafletMapRef.current;
    map.setView([lat, lng], 15);
    
    // Scroll to map section
    if (mapRef.current) {
      mapRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Initialize Leaflet map
  useEffect(() => {
    if (retailers.length === 0) return;

    let isMounted = true;

    const initMap = async () => {
      // Load Leaflet CSS
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      
      // Dynamically import Leaflet
      const L = await import('leaflet');
      
      // Fix default marker icon issue
      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (!isMounted || !mapRef.current || leafletMapRef.current) return;

      // Create map centered on India
      const indiaBounds = L.latLngBounds([[6.0, 68.0], [37.0, 97.5]]);
      
      const map = L.map(mapRef.current, {
        minZoom: 4,
        maxZoom: 18,
        maxBounds: indiaBounds,
        maxBoundsViscosity: 1.0
      }).setView([22.5937, 78.9629], 5);
      
      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Add markers for each retailer
      retailers.forEach(retailer => {
        L.marker([retailer.coordinates.lat, retailer.coordinates.lng])
          .addTo(map)
          .bindPopup(`
            <div style="min-width: 200px; font-family: 'Montserrat', sans-serif;">
              <h3 style="margin: 0 0 8px 0; color: #1e3a52; font-weight: bold; font-size: 14px;">${retailer.name}</h3>
              <p style="margin: 4px 0; font-size: 12px; color: #333;">${retailer.address}</p>
              <p style="margin: 4px 0; font-size: 12px; color: #333;">${retailer.city}, ${retailer.state} - ${retailer.pincode}</p>
              <p style="margin: 8px 0 0 0; font-size: 13px; color: #d4af37; font-weight: bold;">📞 ${retailer.phone}</p>
            </div>
          `);
      });

      // Ensure India view is set
      setTimeout(() => {
        map.invalidateSize();
      }, 100);

      leafletMapRef.current = map;
      setMapLoaded(true);
    };

    initMap();

    // Cleanup
    return () => {
      isMounted = false;
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
    };
  }, [retailers]);

  const indianStates = [
    'Delhi', 'Bihar', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Gujarat',
    'Rajasthan', 'Uttar Pradesh', 'Madhya Pradesh', 'West Bengal',
    'Andhra Pradesh', 'Telangana', 'Kerala', 'Odisha', 'Punjab',
    'Haryana', 'Uttarakhand', 'Himachal Pradesh', 'Jammu and Kashmir',
    'Goa', 'Chhattisgarh', 'Jharkhand', 'Assam', 'Arunachal Pradesh',
    'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura'
  ].sort();

  const filteredRetailers = selectedState
    ? retailers.filter(r => r.state === selectedState)
    : retailers;

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-slate-900">
      <SEO 
        title="Find Addrika Retailers Near You | Store Locator India"
        description="Find authorized Addrika premium incense retailers near you. Locate stores selling Kesar Chandan, Regal Rose, Oriental Oudh & Bold Bakhoor across India."
        url="https://centraders.com/find-retailers"
        keywords="addrika retailers, incense store near me, buy agarbatti delhi, premium incense stores india, addrika dealers"
      />
      <Header />
      
      <main className="flex-1 pt-24 pb-16">
        {/* Navigation buttons */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="back-button"
            >
              <ArrowLeft size={20} />
              <span>Back</span>
            </button>
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--japanese-indigo)' }}
              data-testid="home-button"
            >
              <Home size={20} />
              <span>Home</span>
            </button>
          </div>
        </div>

        {/* Hero Section */}
        <section className="py-12 bg-[var(--cream)] dark:bg-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 
              className="text-4xl sm:text-5xl font-bold mb-4"
              style={{ color: 'var(--japanese-indigo)', fontFamily: "'Exo', sans-serif" }}
            >
              Find Authorized Retailers
            </h1>
            <p className="text-lg dark:text-gray-300" style={{ color: 'var(--text-subtle)' }}>
              Locate stores near you carrying authentic Addrika premium agarbattis
            </p>
          </div>
        </section>

        {/* Map Section */}
        <section className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-6 mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--japanese-indigo)' }}>
                  Store Locations
                </h2>
              </div>

              {/* Location Filters - Above Map with high z-index */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 relative z-[100]">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-dark)' }}>
                    Country
                  </label>
                  <Select value={selectedCountry} onValueChange={setSelectedCountry} disabled>
                    <SelectTrigger data-testid="country-select" className="dark:bg-slate-700 dark:border-slate-600">
                      <SelectValue placeholder="Select Country" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999] bg-white dark:bg-slate-700">
                      <SelectItem value="India">India</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-dark)' }}>
                    State / UT
                  </label>
                  <Select value={selectedState || "all"} onValueChange={(val) => setSelectedState(val === "all" ? "" : val)}>
                    <SelectTrigger data-testid="state-select" className="dark:bg-slate-700 dark:border-slate-600">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent className="z-[9999] bg-white dark:bg-slate-700 max-h-[300px]" position="popper" sideOffset={5}>
                      <SelectItem value="all">All States</SelectItem>
                      {indianStates.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Map Container - Lower z-index to not interfere with dropdowns */}
              <div 
                className="w-full h-96 rounded-lg mb-6 overflow-hidden relative z-0"
                style={{ backgroundColor: '#e5e7eb' }}
              >
                <div ref={mapRef} id="map-container" className="w-full h-full" />
                
                {!mapLoaded && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--japanese-indigo)] mx-auto mb-2"></div>
                      <p className="text-sm text-gray-500">Loading map...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Retailers List */}
              <div className="space-y-4">
                <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--japanese-indigo)' }}>
                  {filteredRetailers.length} Retailer{filteredRetailers.length !== 1 ? 's' : ''} Found
                </h3>

                {filteredRetailers.map(retailer => (
                  <div
                    key={retailer.id}
                    className="border rounded-lg p-6 hover:shadow-md transition-shadow bg-white dark:bg-slate-700"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <div className="flex items-start gap-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--metallic-gold)' }}
                      >
                        <Store size={24} color="white" />
                      </div>
                      
                      <div className="flex-1">
                        <h4 className="text-xl font-bold mb-2" style={{ color: 'var(--japanese-indigo)' }}>
                          {retailer.name}
                        </h4>
                        <div className="space-y-2 mb-4">
                          <p className="dark:text-gray-300" style={{ color: 'var(--text-dark)' }}>{retailer.address}</p>
                          <p className="dark:text-gray-300" style={{ color: 'var(--text-dark)' }}>
                            {retailer.city}, {retailer.state} {retailer.pincode}
                          </p>
                          
                          {/* Phone with call link */}
                          <a 
                            href={`tel:+91${retailer.phone_raw || retailer.phone.replace(/[^0-9]/g, '')}`}
                            className="flex items-center gap-2 font-semibold hover:underline"
                            style={{ color: 'var(--metallic-gold)' }}
                          >
                            <Phone size={16} />
                            {retailer.phone}
                          </a>
                          
                          {/* Email */}
                          {retailer.email && (
                            <a 
                              href={`mailto:${retailer.email}`}
                              className="flex items-center gap-2 hover:underline text-sm"
                              style={{ color: 'var(--japanese-indigo)' }}
                            >
                              <Mail size={16} />
                              {retailer.email}
                            </a>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <Button
                            onClick={() => zoomToRetailer(retailer)}
                            variant="outline"
                            size="sm"
                            style={{ borderColor: 'var(--metallic-gold)', color: 'var(--metallic-gold)' }}
                          >
                            <Navigation size={16} className="mr-1" />
                            View on Map
                          </Button>
                          
                          {/* WhatsApp Link */}
                          <Button
                            onClick={() => {
                              const whatsappNumber = retailer.whatsapp || `91${(retailer.phone_raw || retailer.phone.replace(/[^0-9]/g, ''))}`;
                              const message = `Hi! I'd like to know more about Addrika products available at ${retailer.name}`;
                              window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
                            }}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <MessageCircle size={16} className="mr-1" />
                            WhatsApp
                          </Button>
                          
                          {/* Email Button */}
                          {retailer.email && (
                            <Button
                              onClick={() => {
                                window.location.href = `mailto:${retailer.email}?subject=Inquiry about Addrika Products`;
                              }}
                              variant="outline"
                              size="sm"
                              style={{ borderColor: 'var(--japanese-indigo)', color: 'var(--japanese-indigo)' }}
                            >
                              <Mail size={16} className="mr-1" />
                              Email
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {filteredRetailers.length === 0 && (
                  <div className="text-center py-12">
                    <Store size={64} className="mx-auto mb-4 opacity-20" />
                    <p className="text-lg" style={{ color: 'var(--text-subtle)' }}>
                      No retailers found in {selectedState}
                    </p>
                    <Button
                      onClick={() => setSelectedState('')}
                      className="mt-4"
                      style={{ backgroundColor: 'var(--japanese-indigo)', color: 'white' }}
                    >
                      View All Retailers
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Contact Section */}
            <div 
              className="bg-white rounded-lg shadow-lg p-8 text-center"
              style={{ backgroundColor: 'var(--japanese-indigo)' }}
            >
              <h3 className="text-2xl font-bold mb-4 text-white">
                Want to Become a Retailer?
              </h3>
              <p className="mb-6 text-white/90">
                Join our growing network of authorized Addrika retailers across India
              </p>
              <Button
                onClick={() => {
                  const whatsappNumber = '916202311736';
                  const message = 'Hi! I am interested in becoming an Addrika retailer.';
                  window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, '_blank');
                }}
                className="bg-white font-semibold"
                style={{ color: 'var(--japanese-indigo)' }}
              >
                Contact Us for Partnership
              </Button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default FindRetailers;
