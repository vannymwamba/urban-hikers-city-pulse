import React from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Navigation, MapPin } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';

export interface LocationPreviewProps {
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  onClose: () => void;
}

const FitMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(coords, 16);
  }, [coords, map]);
  return null;
};

const buildPinIcon = () =>
  L.divIcon({
    html: renderToStaticMarkup(
      <div style={{
        background: '#FFE01A',
        borderRadius: '50%',
        width: 36,
        height: 36,
        border: '3px solid #0a0a0a',
        boxShadow: '0 0 16px rgba(255,224,26,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#0a0a0a">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    ),
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

export const LocationPreviewModal: React.FC<LocationPreviewProps> = ({
  name,
  address,
  latitude,
  longitude,
  onClose,
}) => {
  const coords: [number, number] = [latitude, longitude];
  const pinIcon = React.useMemo(() => buildPinIcon(), []);
  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        zIndex: 4000,
        display: 'flex',
        alignItems: 'flex-end',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          background: '#0a0a0a',
          borderTop: '1px solid #222',
          borderRadius: '24px 24px 0 0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #1a1a1a',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <MapPin size={14} color="#FFE01A" />
            <div>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: "'Space Mono', monospace",
              }}>{name}</div>
              {address && (
                <div style={{
                  fontSize: 10,
                  color: '#555',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontFamily: "'Space Mono', monospace",
                  marginTop: 2,
                }}>{address}</div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Map */}
        <div style={{ height: 320, flexShrink: 0 }}>
          <MapContainer
            center={coords}
            zoom={16}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            attributionControl={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <FitMap coords={coords} />
            <Marker position={coords} icon={pinIcon} />
          </MapContainer>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px 40px',
          display: 'flex',
          gap: 12,
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: 16,
              color: '#666',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              fontFamily: "'Space Mono', monospace",
            }}
          >
            Close
          </button>
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 2,
              padding: '14px',
              background: '#FFE01A',
              borderRadius: 16,
              color: '#0a0a0a',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              fontFamily: "'Space Mono', monospace",
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textDecoration: 'none',
            }}
          >
            <Navigation size={14} />
            Get Directions
          </a>
        </div>
      </div>
    </div>
  );
};
