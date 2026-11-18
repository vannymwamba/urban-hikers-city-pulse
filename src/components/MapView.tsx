import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Broadcast, Node, Partner, BroadcastType } from '../types';
import { MapPin, Zap, Music, Palette, Calendar, Truck, Footprints, ShoppingBag, X } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SponsorBadge } from './SponsorBadge';
import { WalkCard } from './WalkCard';
import { WalkJoinSheet } from './WalkJoinSheet';
import { isWalkVisible, useWalkSyncVersion } from '../utils/walkUtils';
import { CARTO_API_KEY, CARTO_ATTRIBUTION } from '../constants';

interface MapViewProps {
  currentNode: Node | null;
  nodes?: Node[];
  user?: any;
  isAdmin?: boolean;
  broadcasts: Broadcast[];
  onSelect: (broadcast: Broadcast) => void;
  onConfirm?: (id: string) => void;
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
  nodes = [],
  user = null,
  isAdmin = false,
  broadcasts,
  onSelect,
  onConfirm,
  partnersMap = {},
}) => {
  useWalkSyncVersion();
  const [selectedWalkId, setSelectedWalkId] = React.useState<string | null>(null);
  const [joiningWalk, setJoiningWalk] = React.useState<Broadcast | null>(null);
  const currentNodeIcon = React.useMemo(() => getCurrentNodeIcon(), []);

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
        style={{ height: '100%', width: '100%', background: '#F4F3EF' }}
        zoomControl={false}
      >
        <TileLayer
          attribution={CARTO_ATTRIBUTION}
          url={`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${process.env.CARTO_API_KEY || CARTO_API_KEY}`}
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
        {Array.isArray(broadcasts) && broadcasts.map((b) => {
          if (!b || typeof b.latitude !== 'number' || typeof b.longitude !== 'number') return null;
          if (isNaN(b.latitude) || isNaN(b.longitude)) return null;

          const isWalk = (b.type || '').toString().toLowerCase() === BroadcastType.WALKING_EVENT;
          if (isWalk && !isWalkVisible(b)) return null;

          if (isWalk) {
            return (
              <Marker
                key={b.id}
                position={[b.latitude, b.longitude]}
                icon={createCustomIcon(getBroadcastType(b), getBroadcastColor(b))}
                eventHandlers={{
                  click: () => setSelectedWalkId(b.id),
                }}
              />
            );
          }

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
          pathOptions={{ color: '#10B981', fillColor: '#10B981', fillOpacity: 0.08, weight: 1.5, dashArray: '5, 10' }} 
        />
      </MapContainer>

      {/* Selected Walking Pin Card Overlay */}
      {(() => {
        const activeWalk = selectedWalkId
          ? (broadcasts || []).find((b) => b.id === selectedWalkId) || null
          : null;
        if (!activeWalk || !isWalkVisible(activeWalk)) return null;

        return (
          <div className="absolute bottom-4 left-4 right-4 z-[600] max-w-md mx-auto">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSelectedWalkId(null)}
                aria-label="Close walk card"
                className="absolute -top-3 -right-2 z-10 min-h-[36px] min-w-[36px] rounded-full bg-[#0B0B0D] border border-white/20 text-white flex items-center justify-center shadow-lg cursor-pointer"
              >
                <X size={16} />
              </button>
              <WalkCard
                walk={activeWalk}
                nodes={nodes}
                currentNode={currentNode}
                user={user}
                isAdmin={isAdmin}
                layout="stack"
                onJoinClick={(w) => setJoiningWalk(w)}
                onSelectDetails={(w) => {
                  setSelectedWalkId(null);
                  onSelect(w);
                }}
              />
            </div>
          </div>
        );
      })()}

      {/* Map Legend Overlay */}
      {!selectedWalkId && (
        <div className="absolute bottom-4 left-4 z-[500] bg-hud-bg/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl shadow-xl pointer-events-none">
          <div className="text-[8px] font-black tracking-[0.2em] text-uh-black/40 uppercase mb-2">MAP_LEGEND</div>
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
      )}

      <WalkJoinSheet
        walk={joiningWalk}
        nodes={nodes}
        currentNode={currentNode}
        isOpen={Boolean(joiningWalk)}
        onClose={() => setJoiningWalk(null)}
        onJoined={(id) => onConfirm?.(id)}
      />
    </div>
  );
};
