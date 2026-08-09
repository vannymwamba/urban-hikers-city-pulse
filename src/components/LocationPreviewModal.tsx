import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, ArrowUpRight, X, Navigation } from 'lucide-react';

interface LocationPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  locationName: string;
  address: string;
  latitude: number;
  longitude: number;
}

// Custom hook to handle map auto-centering when coordinate changes
const MapRecenter = ({ lat, lng }: { lat: number; lng: number }) => {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      map.setView([lat, lng], 16);
      // Invalidate size to ensure map fills the container completely on lazy load
      setTimeout(() => {
        map.invalidateSize();
      }, 250);
    }
  }, [lat, lng, map]);
  return null;
};

// Creating a gorgeous, high-contrast, fully self-contained yellow pin marker
const createYellowPinIcon = () => {
  return L.divIcon({
    html: `
      <div style="
        background-color: #FFE01A;
        border-radius: 50%;
        padding: 8.5px;
        border: 2.5px solid #111111;
        box-shadow: 0 0 20px rgba(255, 224, 26, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #111111;
        width: 36px;
        height: 36px;
        transition: transform 0.2s ease;
      " class="hover:scale-110">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3" fill="#111111"/></svg>
      </div>
    `,
    className: 'custom-yellow-map-pin',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
};

export const LocationPreviewModal: React.FC<LocationPreviewModalProps> = ({
  isOpen,
  onClose,
  locationName,
  address,
  latitude,
  longitude,
}) => {
  const [mapReady, setMapReady] = useState(false);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Leaflet loads asynchronously smoothly
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setMapReady(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setMapReady(false);
    }
  }, [isOpen]);

  const handleGetDirections = (e: React.MouseEvent) => {
    e.stopPropagation();
    const destination = `${latitude},${longitude}`;
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener,noreferrer');
  };

  const center: [number, number] = [latitude, longitude];

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="location-preview-portal" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-auto">
          {/* Backdrop Blur overlay */}
          <motion.div
            id="location-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm cursor-pointer"
          />

          {/* Bottom Sheet on mobile / Card on desktop */}
          <motion.div
            id="location-preview-sheet"
            initial={{ y: '100%', opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative bg-[#121212] w-full max-w-lg min-h-[480px] rounded-t-[32px] sm:rounded-b-[32px] overflow-hidden flex flex-col border-t border-white/10 sm:border border-white/10 shadow-[0_-15px_50px_rgba(0,0,0,0.9)] z-10"
          >
            {/* Visual Drag Indicator for Bottom Sheets */}
            <div id="drag-handle" className="w-12 h-1 bg-white/15 rounded-full mx-auto mt-3.5 mb-1 shrink-0 sm:hidden" />

            {/* Header section with high visual design standards */}
            <div id="preview-header" className="px-6 py-4 flex items-start justify-between gap-4 shrink-0">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FFE01A] font-mono flex items-center gap-1.5 leading-none">
                  <span className="w-1.5 h-1.5 bg-[#FFE01A] rounded-full inline-block animate-pulse" />
                  Signal_Location
                </span>
                <h3 className="text-white text-lg font-black uppercase tracking-tight leading-tight truncate">
                  {locationName}
                </h3>
                <p className="text-white/45 text-[10px] font-mono truncate leading-none mt-0.5">
                  {address}
                </p>
              </div>

              {/* Close Button */}
              <button
                id="close-preview-btn"
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 hover:text-white text-white/60 active:scale-90 transition-all border border-white/5 cursor-pointer shrink-0"
                aria-label="Dismiss map view"
              >
                <X size={16} strokeWidth={2.5} />
              </button>
            </div>

            {/* Interactive Map Section */}
            <div id="preview-map-container" className="h-[280px] w-full relative bg-[#1a1a1a] border-y border-white/5 overflow-hidden flex-1 flex items-center justify-center">
              {mapReady ? (
                <MapContainer
                  center={center}
                  zoom={16}
                  style={{ height: '100%', width: '100%', background: '#121212' }}
                  zoomControl={false}
                  className="z-0"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  
                  <MapRecenter lat={latitude} lng={longitude} />

                  <Marker position={center} icon={createYellowPinIcon()} />
                </MapContainer>
              ) : (
                <div className="flex flex-col items-center gap-3 text-white/40 uppercase tracking-widest text-[9px] font-mono">
                  <div className="w-5 h-5 border-2 border-t-[#FFE01A] border-white/10 rounded-full animate-spin" />
                  Plotting_Signal_Coordinates...
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div id="preview-actions" className="p-6 bg-[#0c0c0c] flex items-center gap-3 shrink-0">
              <button
                id="dismiss-preview-action-btn"
                onClick={onClose}
                className="flex-1 py-4 px-4 rounded-2xl bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest border border-white/10 active:scale-98 transition-all cursor-pointer"
              >
                Close
              </button>
              
              <button
                id="directions-preview-action-btn"
                onClick={handleGetDirections}
                className="flex-1 py-4 px-4 rounded-2xl bg-[#FFE01A] text-[#111] hover:bg-[#FFE01A]/95 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,224,26,0.15)] active:scale-98 transition-all cursor-pointer"
              >
                <Navigation size={13} fill="#111" />
                Get Directions
                <ArrowUpRight size={13} strokeWidth={2.5} />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
