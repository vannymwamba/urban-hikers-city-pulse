import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Broadcast, Node, Partner } from '../types';
import { MapPin, Zap, Music, Palette, Calendar, Mic, Ticket } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SponsorBadge } from './SponsorBadge';

interface MapViewProps {
  currentNode: Node | null;
  broadcasts: Broadcast[];
  onSelect: (broadcast: Broadcast) => void;
  partnersMap?: Record<string, Partner>;
}

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createCustomIcon = (type: string, color: string) => {
  const iconMarkup = renderToStaticMarkup(
    <div style={{ 
      backgroundColor: color, 
      borderRadius: '50%', 
      padding: '6px', 
      border: '2px solid white',
      boxShadow: '0 0 10px rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white'
    }}>
      {type === 'flash_deal' && <Zap size={14} />}
      {type === 'conference_panel' && <Mic size={14} />}
      {type === 'event' && <Ticket size={14} />}
      {type === 'music' && <Music size={14} />}
      {type === 'art' && <Palette size={14} />}
      {!['flash_deal', 'conference_panel', 'event', 'music', 'art'].includes(type) && <Calendar size={14} />}
    </div>
  );

  return L.divIcon({
    html: iconMarkup,
    className: 'custom-map-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
};

const currentNodeIcon = L.divIcon({
  html: renderToStaticMarkup(
    <div style={{ 
      backgroundColor: '#F5C800', 
      borderRadius: '50%', 
      padding: '8px', 
      border: '3px solid #1A2B4A',
      boxShadow: '0 0 15px rgba(245, 200, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#1A2B4A'
    }}>
      <MapPin size={18} />
    </div>
  ),
  className: 'current-node-icon',
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Component to auto-center map when currentNode changes
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  React.useEffect(() => {
    map.setView(coords, 15);
  }, [coords, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({ currentNode, broadcasts, onSelect, partnersMap = {} }) => {
  if (!currentNode) return (
    <div className="h-full flex items-center justify-center bg-hud-bg/50 text-white/50 uppercase tracking-widest text-xs">
      Awaiting Location Data...
    </div>
  );

  const center: [number, number] = [currentNode.latitude, currentNode.longitude];

  const getBroadcastType = (b: Broadcast) => {
    if (b.type === 'flash_deal') return 'flash_deal';
    if (b.type === 'conference_panel') return 'conference_panel';
    if (b.title.toLowerCase().includes('music')) return 'music';
    if (b.title.toLowerCase().includes('art')) return 'art';
    return 'event';
  };

  const getBroadcastColor = (b: Broadcast) => {
    if (b.type === 'flash_deal') return '#EF9F27';
    if (b.type === 'conference_panel') return '#378ADD';
    if (b.title.toLowerCase().includes('music')) return '#639922';
    if (b.title.toLowerCase().includes('art')) return '#534AB7';
    return '#E24B4A';
  };

  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={center} 
        zoom={15} 
        style={{ height: '100%', width: '100%', background: '#1A2B4A' }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <RecenterMap coords={center} />

        {/* Current Node Marker */}
        <Marker position={center} icon={currentNodeIcon}>
          <Popup className="hud-popup">
            <div className="p-2 text-hud-bg">
              <div className="font-black text-[10px] uppercase tracking-widest mb-1">CURRENT_HUB</div>
              <div className="font-bold text-sm">{currentNode.name}</div>
              <div className="text-[10px] opacity-60">{currentNode.address}</div>
            </div>
          </Popup>
        </Marker>

        {/* Broadcast Markers */}
        {broadcasts.map((b) => {
          const partner = b.partnerId ? partnersMap[b.partnerId] : null;
          
          return (
            <Marker 
              key={b.id} 
              position={[b.latitude, b.longitude]} 
              icon={createCustomIcon(getBroadcastType(b), getBroadcastColor(b))}
            >
              <Popup className="hud-popup">
                <div className="p-2 text-hud-bg min-w-[150px]">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex flex-col gap-1">
                      <div className="font-black text-[9px] uppercase tracking-widest opacity-60">
                        {b.type.replace('_', ' ')}
                      </div>
                      {partner && <SponsorBadge partner={partner} zone="A" />}
                    </div>
                    <div className="text-[9px] font-bold bg-hud-bg/10 px-1.5 py-0.5 rounded">
                      {b.currentVibe.toUpperCase()}
                    </div>
                  </div>
                  <div className="font-bold text-sm mb-1">{b.title}</div>
                  <div className="text-[10px] mb-1 opacity-80">{b.address?.split(',')[0]}</div>
                  {partner && <SponsorBadge partner={partner} zone="D" />}
                  <div className="mt-3">
                    <button 
                      onClick={() => onSelect(b)}
                      className="w-full py-1.5 bg-hud-bg text-white text-[9px] font-black uppercase tracking-widest rounded hover:bg-hud-bg/80 transition-colors"
                    >
                      VIEW_DETAILS
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Visual Range Circle */}
        <Circle 
          center={center} 
          radius={500} 
          pathOptions={{ color: '#4CD98A', fillColor: '#4CD98A', fillOpacity: 0.05, weight: 1, dashArray: '5, 10' }} 
        />
      </MapContainer>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[500] bg-hud-bg/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl pointer-events-none">
        <div className="text-[8px] font-black tracking-[0.2em] text-white/40 uppercase mb-2">MAP_LEGEND</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#EF9F27]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Flash Deals</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#E24B4A]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Live Events</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#378ADD]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Panels</span>
          </div>
        </div>
      </div>
    </div>
  );
};
