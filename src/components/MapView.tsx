import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, Polyline, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Broadcast, Node, Partner, BroadcastType, Route } from '../types';
import { MapPin, Zap, Music, Palette, Calendar, Mic, Ticket, Truck, Footprints, ShoppingBag, Navigation2, Target } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SponsorBadge } from './SponsorBadge';

interface MapViewProps {
  currentNode: Node | null;
  broadcasts: Broadcast[];
  activeRoute?: Route | null;
  userLocation?: [number, number] | null;
  onSelect: (broadcast: Broadcast) => void;
  onGeolocate?: () => void;
  partnersMap?: Record<string, Partner>;
}

// Fix for default marker icons in Leaflet
const fixLeafletIcons = () => {
  if (typeof L !== 'undefined' && L.Icon && L.Icon.Default) {
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }
};

fixLeafletIcons();

const createCustomIcon = (type: string, color: string) => {
  try {
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
        {type === BroadcastType.FLASH_DEAL && <Zap size={14} />}
        {type === BroadcastType.LIVE_EVENT && <Music size={14} />}
        {type === BroadcastType.FOOD_TRUCK && <Truck size={14} />}
        {type === BroadcastType.WALKING_EVENT && <Footprints size={14} />}
        {type === BroadcastType.MURAL && <Palette size={14} />}
        {type === BroadcastType.STREET_ART && <Palette size={14} />}
        {type === BroadcastType.POP_UP && <ShoppingBag size={14} />}
        {!Object.values(BroadcastType).includes(type as any) && <Calendar size={14} />}
      </div>
    );

    return L.divIcon({
      html: iconMarkup,
      className: 'custom-map-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    });
  } catch (e) {
    console.error("Error creating custom icon:", e);
    return new L.Icon.Default();
  }
};

const getCurrentNodeIcon = () => {
  try {
    return L.divIcon({
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
  } catch (e) {
    return new L.Icon.Default();
  }
};

const getUserIcon = () => {
  try {
    return L.divIcon({
      html: renderToStaticMarkup(
        <div className="relative">
          <div className="absolute inset-0 bg-hud-magenta rounded-full animate-ping opacity-20" />
          <div style={{ 
            backgroundColor: '#FF00FF', 
            borderRadius: '50%', 
            padding: '6px', 
            border: '2px solid white',
            boxShadow: '0 0 10px rgba(255, 0, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            position: 'relative',
            zIndex: 10
          }}>
            <Navigation2 size={14} className="transform rotate-45" />
          </div>
        </div>
      ),
      className: 'user-location-icon',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  } catch (e) {
    return new L.Icon.Default();
  }
};

// Component to auto-center map when currentNode changes
const RecenterMap = ({ coords }: { coords: [number, number] }) => {
  const map = useMap();
  React.useEffect(() => {
    if (coords && typeof coords[0] === 'number' && typeof coords[1] === 'number' && !isNaN(coords[0]) && !isNaN(coords[1])) {
      map.setView(coords, 15);
    }
  }, [coords, map]);
  return null;
};

export const MapView: React.FC<MapViewProps> = ({ 
  currentNode, 
  broadcasts, 
  activeRoute, 
  userLocation, 
  onSelect, 
  onGeolocate, 
  partnersMap = {} 
}) => {
  const currentNodeIcon = React.useMemo(() => getCurrentNodeIcon(), []);
  const userIcon = React.useMemo(() => getUserIcon(), []);

  const lat = currentNode ? Number(currentNode.latitude) : NaN;
  const lng = currentNode ? Number(currentNode.longitude) : NaN;

  if (!currentNode || isNaN(lat) || isNaN(lng)) return (
    <div className="h-full flex items-center justify-center bg-hud-bg/50 text-white/50 uppercase tracking-widest text-xs">
      Awaiting Valid Location Data...
    </div>
  );

  const center: [number, number] = [lat, lng];

  const getBroadcastType = (b: Broadcast) => {
    return b.type;
  };

  const getBroadcastColor = (b: Broadcast) => {
    switch (b.type) {
      case BroadcastType.LIVE_EVENT: return '#FF3B30';
      case BroadcastType.FOOD_TRUCK: return '#F97316';
      case BroadcastType.WALKING_EVENT: return '#10B981';
      case BroadcastType.FLASH_DEAL: return '#FFE01A';
      case BroadcastType.MURAL:
      case BroadcastType.STREET_ART: return '#8B5CF6';
      case BroadcastType.POP_UP: return '#0EA5E9';
      default: return '#1A1A1A';
    }
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

        {/* User Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Tooltip permanent direction="top" className="hud-tooltip">
              <span className="font-bold text-[8px] tracking-widest uppercase">YOU</span>
            </Tooltip>
          </Marker>
        )}

        {/* Active Route Polylines */}
        {activeRoute && activeRoute.points && activeRoute.points.length > 0 && (
          <>
            {/* Outer Glow */}
            <Polyline 
              positions={activeRoute.points.map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{ 
                color: '#F5C800', 
                weight: 8, 
                opacity: 0.2,
                lineJoin: 'round'
              }}
            />
            {/* Inner Core */}
            <Polyline 
              positions={activeRoute.points.map(p => [p.lat, p.lng] as [number, number])}
              pathOptions={{ 
                color: '#F5C800', 
                weight: 4, 
                opacity: 1,
                lineJoin: 'round'
              }}
            />
          </>
        )}

        {/* Broadcast Markers */}
        {Array.isArray(broadcasts) && broadcasts.map((b) => {
          if (!b || typeof b.latitude !== 'number' || typeof b.longitude !== 'number') return null;
          if (isNaN(b.latitude) || isNaN(b.longitude)) return null;
          
          const partner = b.partnerId ? partnersMap[b.partnerId] : null;
          const vibe = (b.currentVibe || b.current_vibe || 'CHILL').toUpperCase();
          const type = b.type || 'event';
          
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
                        {type.replace('_', ' ')}
                      </div>
                      {partner && <SponsorBadge partner={partner} zone="A" />}
                    </div>
                    <div className="text-[9px] font-bold bg-hud-bg/10 px-1.5 py-0.5 rounded">
                      {vibe}
                    </div>
                  </div>
                  <div className="font-bold text-sm mb-1">{b.title || 'UNKNOWN_SIGNAL'}</div>
                  <div className="text-[10px] mb-1 opacity-80">{b.address?.split(',')[0] || 'NO_ADDRESS_DATA'}</div>
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
          radius={Number(currentNode.radius_limit) || 500} 
          pathOptions={{ color: '#4CD98A', fillColor: '#4CD98A', fillOpacity: 0.05, weight: 1, dashArray: '5, 10' }} 
        />
      </MapContainer>

      {/* Map Actions HUD */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col gap-2">
        <button 
          onClick={onGeolocate}
          className="bg-hud-bg/90 backdrop-blur-md border border-white/10 p-3 rounded-full shadow-xl hover:bg-hud-bg transition-colors group"
          title="Geolocate"
        >
          <Target size={20} className="text-hud-yellow group-hover:scale-110 transition-transform" />
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-4 left-4 z-[500] bg-hud-bg/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl pointer-events-none">
        <div className="text-[8px] font-black tracking-[0.2em] text-white/40 uppercase mb-2">MAP_LEGEND</div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FF3B30]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Live Event</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#F97316]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Food Truck</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#10B981]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Walking Event</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#FFE01A]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Flash Deal</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#8B5CF6]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Art/Mural</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0EA5E9]" />
            <span className="text-[9px] font-bold uppercase tracking-wider">Pop-up</span>
          </div>
        </div>
      </div>
    </div>
  );
};
