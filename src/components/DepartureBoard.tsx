import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile, Partner, Route, Guide, Sponsor } from '../types';
import { MapView } from './MapView';
import { BroadcastCard } from './BroadcastCard';
import { RouteCard } from './RouteCard';
import { Clock, ShieldCheck, MapPin, Home, LayoutGrid, Share2, Ticket, Map as MapIcon, ArrowRight, AlertCircle, Lock, Navigation, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDistance } from '../utils/geo';
import { WalletCard } from './WalletCard';
import { getEventStatus } from '../utils/broadcastHelpers';

interface DepartureBoardProps {
  nodeName: string;
  currentNode: Node | null;
  broadcasts: Broadcast[];
  onSelect: (broadcast: Broadcast) => void;
  user: any;
  userProfile: UserProfile | null;
  onLogin: () => void;
  isTappedIn: boolean;
  onTapToggle: (active: boolean) => void;
  accessVector?: 'nfc' | 'direct' | 'qr';
  onShareNode: () => void;
  onShareEvent: (broadcast: Broadcast) => void;
  onSaveToWallet?: (node?: Node) => void;
  isSaved?: boolean;
  activeTab?: 'home' | 'feed' | 'explore' | 'wallet' | 'profile';
  onTabChange?: (tab: 'home' | 'feed' | 'explore' | 'wallet' | 'profile') => void;
  savedHubs?: Node[];
  partnersMap?: Record<string, Partner>;
  routes?: Route[];
  guidesMap?: Record<string, Guide>;
  sponsorsMap?: Record<string, Sponsor>;
  onStartRoute?: (route: Route) => void;
  onBookRoute?: (route: Route) => void;
  nfcStatus?: 'idle' | 'scanning' | 'error' | 'unsupported';
}

export const DepartureBoard: React.FC<DepartureBoardProps> = ({ 
  nodeName, 
  currentNode, 
  broadcasts, 
  onSelect, 
  user, 
  userProfile, 
  onLogin,
  isTappedIn,
  onTapToggle,
  accessVector = 'direct',
  onShareNode,
  onShareEvent,
  onSaveToWallet,
  isSaved = false,
  activeTab = 'feed',
  onTabChange,
  savedHubs = [],
  partnersMap = {},
  routes = [],
  guidesMap = {},
  sponsorsMap = {},
  onStartRoute = () => {},
  onBookRoute = () => {},
  nfcStatus = 'idle'
}) => {
  const [time, setTime] = useState(new Date());
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tapConfirmAction, setTapConfirmAction] = useState<'in' | 'out' | null>(null);
  const [uptime, setUptime] = useState(99.9);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setUptime(prev => {
        const change = (Math.random() - 0.5) * 0.02;
        const newVal = prev + change;
        return Number(Math.min(100, Math.max(99.7, newVal)).toFixed(2));
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Calculate real stats
  const activeNodesCount = new Set(broadcasts.map(b => `${b.latitude},${b.longitude}`)).size || 1;
  
  const maxRadiusMeters = broadcasts.length > 0 && currentNode && typeof currentNode.latitude === 'number' && typeof currentNode.longitude === 'number'
    ? Math.max(...broadcasts.map(b => {
        if (typeof b.latitude !== 'number' || typeof b.longitude !== 'number' || isNaN(b.latitude) || isNaN(b.longitude)) return 0;
        return getDistance(currentNode.latitude, currentNode.longitude, b.latitude, b.longitude);
      }))
    : 0;
    
  // Convert meters to miles (approx)
  const radiusInMiles = maxRadiusMeters > 0 ? (maxRadiusMeters / 1609.34).toFixed(1) : "0.0";

  const handleTapOut = () => {
    onTapToggle(false);
    setShowConfirmation(true);
    setTapConfirmAction(null);
    setTimeout(() => setShowConfirmation(false), 5000);
  };

  const handleTapIn = () => {
    onTapToggle(true);
    setTapConfirmAction(null);
  };

  const handleDirections = (item: Broadcast) => {
    const destination = item.address || `${item.latitude},${item.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    window.open(url, '_blank');
  };

  const flashDeals = broadcasts.filter(b => b.type === 'flash_deal');
  const liveEvents = broadcasts.filter(b => b.type === 'event');
  const civicEvents = broadcasts.filter(b => b.type === 'civic_free');
  const murals = broadcasts.filter(b => b.type === 'civic_mural');
  const conferenceFeed = broadcasts.filter(b => b.type === 'conference_panel');

  const renderSection = (title: string, items: Broadcast[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-bold tracking-wider text-[#888780] font-sans whitespace-nowrap">{title}</span>
          <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
        </div>
        
        {items.map((item, idx) => {
          const route = routes.find(r => r.partnerId === (item.partner_id || item.partnerId));
          return (
            <BroadcastCard 
              key={item.id}
              item={item}
              idx={idx}
              currentNode={currentNode}
              onSelect={onSelect}
              onShareEvent={onShareEvent}
              handleDirections={handleDirections}
              onBook={route ? () => onBookRoute(route) : undefined}
              partner={partnersMap[item.partnerId || item.partner_id || ''] || null}
              sponsor={sponsorsMap[item.sponsorId || ''] || null}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-hud-bg text-white relative overflow-hidden">
      {/* Top Bar — Full Brand Yellow */}
      <div className="bg-hud-yellow px-4 py-2.5 flex justify-between items-center shrink-0">
        <div className="flex flex-col">
          <div className="text-[12px] font-black tracking-[0.08em] text-hud-dark uppercase font-mono">URBAN HIKERS</div>
          <div className="text-[8px] font-bold text-hud-dark/50 uppercase tracking-[0.06em] font-mono">FLUX_PROTOCOL_OS</div>
        </div>
        <div className="flex gap-1.5">
          {[
            { label: 'ANONYMOUS', active: true },
            { label: 'NO GPS', active: true },
            { label: 'ENCRYPTED', active: userProfile?.uid }
          ].map(tag => (
            <span 
              key={tag.label} 
              className={`text-[8px] font-black px-2 py-0.5 rounded-sm tracking-tighter font-mono transition-colors ${
                tag.active 
                  ? 'bg-hud-dark text-hud-yellow' 
                  : 'border border-hud-dark/20 text-hud-dark/40'
              }`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>

      {/* SectorHub — Node Header */}
      <div className="p-4 bg-navy-mid border-b border-white/5 shrink-0">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-hud-teal animate-pulse shadow-[0_0_12px_var(--color-live)]" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black tracking-[0.2em] text-white/30 uppercase font-mono">SECTOR_HUB_IDENTIFIER</span>
              <h1 className="text-[24px] font-black tracking-tighter text-hud-yellow uppercase leading-none font-mono">
                {nodeName}
              </h1>
            </div>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-[8px] font-black tracking-[0.2em] text-white/30 uppercase font-mono">SYSTEM_TIME</span>
            <div className="text-[18px] font-black text-white tracking-widest tabular-nums leading-none font-mono">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1 max-w-[60%]">
            <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium truncate font-sans">
              <MapPin size={12} className="shrink-0" />
              <span className="truncate">{currentNode?.address || 'LOCATION_PENDING'}</span>
            </div>
            {currentNode?.capacity && (
              <div className="flex items-center gap-2 text-[9px] text-hud-green font-bold uppercase tracking-widest font-mono">
                <Users size={10} /> CAPACITY: {currentNode.capacity}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={onShareNode}
              className="p-1.5 text-white/40 hover:text-hud-yellow transition-colors"
              title="Share Sector"
            >
              <Share2 size={16} />
            </button>
            {currentNode && (
              <button 
                onClick={() => handleDirections({ address: currentNode.address, latitude: currentNode.latitude, longitude: currentNode.longitude } as any)}
                className="flex items-center gap-1 bg-hud-yellow/10 text-hud-yellow px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border border-hud-yellow/20 font-mono"
              >
                DIRECTIONS
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Session Status Strip */}
      <div className="px-4 py-3 bg-hud-dark border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isTappedIn ? 'bg-hud-yellow animate-pulse' : 'bg-white/20'}`} />
          <span className="text-[11px] font-medium text-white/90 font-sans">
            {isTappedIn ? (
              <>Checked in · <span className="font-mono font-black text-hud-yellow">NODE #{currentNode?.id || '00'}</span> · 14 min</>
            ) : (
              "Not checked in"
            )}
          </span>
        </div>
        {isTappedIn ? (
          <button 
            onClick={() => setTapConfirmAction('out')}
            className="text-[10px] font-black text-hud-magenta uppercase tracking-widest font-mono px-3 py-1 border border-hud-magenta/30 rounded-sm bg-hud-magenta/5 hover:bg-hud-magenta/10 transition-colors"
          >
            [End session]
          </button>
        ) : (
          <button 
            onClick={() => setTapConfirmAction('in')}
            className="text-[10px] font-black text-hud-yellow uppercase tracking-widest font-mono px-3 py-1 border border-hud-yellow/30 rounded-sm bg-hud-yellow/5 hover:bg-hud-yellow/10 transition-colors"
          >
            [Start session]
          </button>
        )}
      </div>

      <div className="p-4 bg-hud-bg shrink-0 border-b border-white/5">
        <div className="mt-0">
          {!user ? (
            <div className="text-[9px] font-medium text-white/30 flex items-center justify-between font-sans">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={10} className="text-hud-teal" />
                Anonymous by default
              </div>
              <button 
                onClick={() => setShowLogin(!showLogin)}
                className="text-hud-yellow font-black hover:underline flex items-center gap-1 font-mono uppercase tracking-wider"
              >
                UPGRADE_TO_PERSISTENT <ArrowRight size={10} />
              </button>
            </div>
          ) : (
            <div className="text-[9px] font-medium text-hud-green flex items-center gap-1.5 font-sans">
              <ShieldCheck size={10} />
              Identity verified · Wallet active
            </div>
          )}

          <AnimatePresence>
            {showLogin && !user && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden mt-4"
              >
                <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {['wallet', 'bookings', 'history', 'saved hubs'].map(perk => (
                      <div key={perk} className="bg-white/5 px-2 py-1.5 rounded-lg text-[8px] font-bold text-white/60 uppercase tracking-widest flex items-center gap-1.5 border border-white/5 font-mono">
                        <div className="w-1 h-1 rounded-full bg-[#5BB8F5]" />
                        {perk}
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={onLogin}
                    className="w-full py-2.5 bg-[#5BB8F5] text-hud-dark rounded-xl text-[10px] font-black uppercase tracking-[0.2em] shadow-[0_4px_15px_rgba(91,184,245,0.3)] font-mono"
                  >
                    SECURE_SIGN_IN
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Open Bar — System Declaration */}
      <div className="bg-hud-teal/10 px-4 py-3 flex items-center gap-3 border-y border-hud-teal/20 shrink-0">
        <div className="w-2 h-2 bg-hud-teal animate-pulse" />
        <div className="text-[10px] text-hud-teal font-medium tracking-wider font-sans">
          Open feed · All live events visible · No account required
        </div>
      </div>

      <div className={`flex-1 ${activeTab === 'explore' ? 'overflow-hidden' : 'overflow-y-auto'} bg-feed-bg transition-all duration-500 ${!isTappedIn && activeTab === 'feed' ? 'opacity-60 grayscale' : ''}`}>
        {activeTab === 'explore' ? (
          <div className="h-full flex flex-col">
            <div className="h-1/2 min-h-[300px]">
              <MapView 
                currentNode={currentNode} 
                broadcasts={broadcasts} 
                onSelect={onSelect} 
                partnersMap={partnersMap}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 border-t border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold tracking-wider text-[#888780] font-sans whitespace-nowrap">Mission Board</span>
                <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
              </div>
              
              {routes.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="text-white/40 italic mb-4 tracking-wider text-[10px] font-sans leading-relaxed max-w-[280px]">
                    No routes available in this sector.
                  </div>
                </div>
              ) : (
                routes.map((route) => (
                  <RouteCard 
                    key={route.id} 
                    route={route} 
                    guide={guidesMap[route.guideId || '']}
                    sponsor={sponsorsMap[route.sponsorId || '']}
                    endPartner={partnersMap[route.endPartnerId || '']}
                    onStart={onStartRoute} 
                    onBook={onBookRoute} 
                  />
                ))
              )}
            </div>
          </div>
        ) : activeTab === 'wallet' ? (
          <div className="p-4 flex flex-col gap-6 py-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold tracking-wider text-[#888780] font-sans whitespace-nowrap">Wallet</span>
              <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
            </div>
            
            {savedHubs.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center">
                <div className="text-white/40 italic mb-4 tracking-wider text-[10px] font-sans leading-relaxed max-w-[280px]">
                  Wallet empty.
                </div>
                <div className="text-hud-yellow font-bold tracking-tight text-sm font-sans leading-relaxed max-w-[280px]">
                  Save hubs to access them quickly later.
                </div>
              </div>
            ) : (
              savedHubs.map((hub, index) => (
                <motion.div 
                  key={hub.id} 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group"
                >
                  <WalletCard sector={hub} />
                  <button 
                    onClick={() => onSaveToWallet?.(hub)}
                    className="absolute top-4 right-4 p-2 bg-hud-magenta text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from Wallet"
                  >
                    <Lock size={14} />
                  </button>
                  <a 
                    href={`/tap/${hub.id}`}
                    className="absolute bottom-4 right-16 p-2 bg-hud-green text-hud-bg rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-black"
                  >
                    Go to hub
                  </a>
                </motion.div>
              ))
            )}
          </div>
        ) : activeTab === 'profile' ? (
          <div className="p-4 flex flex-col gap-6 py-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold tracking-wider text-[#888780] font-sans whitespace-nowrap">User Profile</span>
              <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
            </div>
            
            <div className="bg-white/5 p-6 rounded-sm border border-white/5">
              {user ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-hud-yellow/20 flex items-center justify-center border border-hud-yellow/40">
                      <Users className="text-hud-yellow" size={24} />
                    </div>
                    <div>
                      <div className="text-white font-bold">{user.email}</div>
                      <div className="text-[10px] text-white/40 font-mono">UID: {user.uid}</div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="text-[10px] text-white/40 uppercase tracking-widest font-mono mb-2">Access Level</div>
                    <div className="text-hud-teal font-black uppercase tracking-widest font-mono">Verified_Hiker</div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-white/40 text-[10px] mb-6 uppercase tracking-[0.2em] font-mono">Identity_Not_Verified</div>
                  <button 
                    onClick={onLogin}
                    className="bg-hud-yellow text-hud-dark px-8 py-3 rounded-sm text-[12px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,224,26,0.3)]"
                  >
                    Login to Pulse
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'home' ? (
          <div className="p-4 flex flex-col gap-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-bold tracking-wider text-[#888780] font-sans whitespace-nowrap">Home Highlights</span>
              <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
            </div>
            
            {flashDeals.length > 0 ? (
              <div className="space-y-4">
                <div className="text-[11px] text-white/60 font-sans italic">Top deals in your sector:</div>
                {flashDeals.slice(0, 2).map((item, idx) => (
                  <BroadcastCard 
                    key={item.id}
                    item={item}
                    idx={idx}
                    currentNode={currentNode}
                    onSelect={onSelect}
                    onShareEvent={onShareEvent}
                    handleDirections={handleDirections}
                    partner={partnersMap[item.partnerId || item.partner_id || ''] || null}
                    sponsor={sponsorsMap[item.sponsorId || ''] || null}
                  />
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-white/40 text-[10px] uppercase tracking-widest font-mono">
                No highlights available.
              </div>
            )}
          </div>
        ) : (
          <div className="p-4">
            {currentNode?.type === 'conference_center' && (
          <div className="mb-6">
            <div className="bg-[#1A2B4A] rounded-2xl p-4 flex items-center justify-between shadow-lg border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#243D5C] flex items-center justify-center">
                  <LayoutGrid size={20} className="text-hud-yellow" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-white leading-tight">{currentNode.name}</div>
                  <div className="text-[10px] text-white/40 mt-0.5">{currentNode.address}</div>
                </div>
              </div>
              <button 
                onClick={() => handleDirections({ address: currentNode.address, latitude: currentNode.latitude, longitude: currentNode.longitude } as any)}
                className="bg-hud-yellow text-hud-bg px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
              >
                DIRECTIONS
              </button>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-[#888780] font-medium px-1">
              <ShieldCheck size={12} />
              ALL SESSIONS BELOW ARE AT THIS VENUE.
            </div>
          </div>
        )}

        <AnimatePresence>
          {showConfirmation && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-4 p-4 rounded-2xl border border-hud-magenta bg-hud-magenta/5 text-hud-magenta text-center"
            >
              <div className="text-xs font-black tracking-[0.2em] mb-1">Session terminated</div>
              <div className="text-[10px] font-bold opacity-80 uppercase">Zero data stored · Anonymity preserved</div>
            </motion.div>
          )}
        </AnimatePresence>

        {broadcasts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[400px]">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-8"
            >
              <div className="w-32 h-32 bg-hud-yellow/5 rounded-full flex items-center justify-center shadow-xl mx-auto mb-6 border border-hud-yellow/20">
                <svg width="60%" height="60%" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g transform="translate(15, 25) scale(0.7)">
                    <circle cx="25" cy="15" r="8" fill="#FFE01A" />
                    <path d="M25 25 L25 50 L10 75 M25 50 L40 75 M25 35 L10 50 M25 35 L40 50" stroke="#FFE01A" strokeWidth="6" strokeLinecap="round" />
                  </g>
                  <g transform="translate(40, 20) scale(0.8)">
                    <circle cx="25" cy="15" r="8" fill="#FFE01A" />
                    <path d="M25 25 L25 50 L15 75 M25 50 L35 75 M25 35 L15 55 M25 35 L35 55" stroke="#FFE01A" strokeWidth="6" strokeLinecap="round" />
                    <rect x="15" y="25" width="10" height="15" rx="2" fill="#FFE01A" />
                  </g>
                  <g transform="translate(65, 25) scale(0.7)">
                    <circle cx="25" cy="15" r="8" fill="#FFE01A" />
                    <path d="M25 25 L25 50 L10 75 M25 50 L40 75 M25 35 L10 50 M25 35 L40 50" stroke="#FFE01A" strokeWidth="6" strokeLinecap="round" />
                    <path d="M45 30 L45 75" stroke="#FFE01A" strokeWidth="3" strokeLinecap="round" />
                  </g>
                </svg>
              </div>
              <h2 className="font-bebas text-2xl tracking-[4px] text-hud-yellow uppercase">Urban Hikers</h2>
            </motion.div>

            <div className="space-y-2">
              <div className="text-hud-yellow font-black tracking-[0.2em] text-xs uppercase">
                The sector is silent.
              </div>
              <div className="text-white/40 font-bold tracking-[0.1em] text-[10px] uppercase leading-relaxed max-w-[240px] mx-auto">
                Go wander. Discover new places.
                The pulse of the city awaits.
              </div>
            </div>
            
            <div className="mt-12 w-16 h-[2px] bg-hud-yellow/20 mx-auto" />
          </div>
        ) : (
          <>
            {renderSection('Flash Deals', flashDeals)}
            {renderSection('Civic Events', civicEvents)}
            {renderSection('Murals', murals)}
            {renderSection('Live Events', liveEvents)}
            {renderSection('Conference Feed', conferenceFeed)}
          </>
        )}
      </div>
    )}
  </div>

      {/* Footer Stats — System Health */}
      <div className="bg-hud-bg px-5 py-5 flex justify-between items-center border-t border-white/10 shrink-0">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[18px] font-black text-hud-yellow leading-none font-mono">{activeNodesCount}</span>
            <span className="text-[8px] text-white/30 font-black tracking-[0.2em] uppercase mt-1 font-mono">NODES</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-black text-hud-yellow leading-none font-mono">{uptime}%</span>
            <span className="text-[8px] text-white/30 font-black tracking-[0.2em] uppercase mt-1 font-mono">UPTIME</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[18px] font-black text-hud-yellow leading-none font-mono">{radiusInMiles} MI</span>
            <span className="text-[8px] text-white/30 font-black tracking-[0.2em] uppercase mt-1 font-mono">RADIUS</span>
          </div>
        </div>
        <div className="text-[8px] text-white/20 font-black tracking-[0.2em] uppercase text-right font-mono">
          FLUX_PROTOCOL_OS V1.0
        </div>
      </div>

      {/* Bottom Navigation — Utility Rail */}
      <div className="bg-hud-dark px-2 py-2 flex justify-between items-center border-t border-white/10 shrink-0">
        {[
          { id: 'home', icon: Home, label: 'Home', href: '/' },
          { id: 'feed', icon: Clock, label: 'Feed' },
          { id: 'explore', icon: Navigation, label: 'Explore' },
          { id: 'wallet', icon: Ticket, label: 'Wallet', badge: savedHubs.length > 0 },
          { id: 'profile', icon: Users, label: 'Profile', href: '/dashboard' }
        ].map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          const content = (
            <div className="flex flex-col items-center gap-1 group relative">
              <Icon size={18} className={`${isActive ? 'text-hud-yellow' : 'text-white/20 group-hover:text-white/50'} transition-colors`} />
              {item.badge && (
                <div className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-hud-magenta rounded-full shadow-[0_0_8px_var(--color-urgent)]" />
              )}
              <span className={`text-[7px] font-black tracking-[0.15em] uppercase font-mono ${isActive ? 'text-hud-yellow' : 'text-white/20 group-hover:text-white/50'} transition-colors`}>
                {item.label.toUpperCase()}
              </span>
            </div>
          );

          if (item.href) {
            return (
              <a key={item.id} href={item.href} className="px-2 py-1.5">
                {content}
              </a>
            );
          }

          return (
            <button 
              key={item.id}
              onClick={() => onTabChange?.(item.id as any)}
              className="px-2 py-1.5"
            >
              {content}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {tapConfirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-hud-bg/95 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-[300px] bg-hud-bg border-2 border-hud-yellow/20 p-6 rounded-sm shadow-[0_0_60px_rgba(0,0,0,0.8)] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-hud-yellow" />
              <div className="w-12 h-12 rounded-sm bg-hud-yellow/10 flex items-center justify-center mx-auto mb-4 border border-hud-yellow/20">
                <AlertCircle className="text-hud-yellow" size={24} />
              </div>
              <h3 className="text-[14px] font-bold tracking-wider mb-3 font-sans text-white">System Confirmation Required</h3>
              <p className="text-[10px] text-white/50 leading-relaxed mb-8 font-sans">
                {tapConfirmAction === 'in' 
                  ? 'Initiate anonymous session in current sector?' 
                  : 'Terminate active session and disconnect from node?'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={tapConfirmAction === 'in' ? handleTapIn : handleTapOut}
                  className={`w-full py-4 rounded-sm text-[12px] font-black tracking-[0.2em] uppercase transition-all font-mono ${
                    tapConfirmAction === 'in' 
                      ? 'bg-hud-teal text-hud-dark shadow-[0_0_20px_rgba(0,245,255,0.3)]' 
                      : 'bg-hud-magenta text-white shadow-[0_0_20px_rgba(255,77,77,0.3)]'
                  }`}
                >
                  {tapConfirmAction === 'in' ? 'Execute Tap In' : 'Execute Tap Out'}
                </button>
                <button
                  onClick={() => setTapConfirmAction(null)}
                  className="w-full py-3 text-[10px] font-black text-white/30 uppercase tracking-[0.2em] hover:text-white transition-colors font-mono"
                >
                  Abort Action
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
