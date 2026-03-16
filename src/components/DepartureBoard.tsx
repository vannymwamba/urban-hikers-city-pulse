import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile, Partner } from '../types';
import { MapView } from './MapView';
import { BroadcastCard } from './BroadcastCard';
import { Clock, ShieldCheck, MapPin, Home, LayoutGrid, Share2, Ticket, Map as MapIcon, ArrowRight, AlertCircle, Lock } from 'lucide-react';
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
  activeTab?: 'feed' | 'wallet' | 'map';
  onTabChange?: (tab: 'feed' | 'wallet' | 'map') => void;
  savedHubs?: Node[];
  partnersMap?: Record<string, Partner>;
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
  partnersMap = {}
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
  
  const maxRadiusMeters = broadcasts.length > 0 && currentNode
    ? Math.max(...broadcasts.map(b => getDistance(currentNode.latitude, currentNode.longitude, b.latitude, b.longitude)))
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
  const conferenceFeed = broadcasts.filter(b => b.type === 'conference_panel');

  const renderSection = (title: string, items: Broadcast[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-black tracking-[0.2em] text-[#888780] uppercase whitespace-nowrap">{title}</span>
          <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
        </div>
        
        {items.map((item, idx) => (
          <BroadcastCard 
            key={item.id}
            item={item}
            idx={idx}
            currentNode={currentNode}
            onSelect={onSelect}
            onShareEvent={onShareEvent}
            handleDirections={handleDirections}
            partner={partnersMap[item.partner_id || ''] || null}
          />
        ))}
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
          {['ANONYMOUS', 'NO GPS', 'ENCRYPTED'].map(tag => (
            <span key={tag} className="border border-hud-dark/25 text-hud-dark/60 text-[9px] font-bold px-2 py-1 rounded-full tracking-wider whitespace-nowrap font-mono">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* SectorHub — Node Header */}
      <div className="p-4 bg-navy-mid border-b border-white/5 shrink-0">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-hud-green animate-pulse shadow-[0_0_8px_var(--color-live)]" />
            <div className="flex items-baseline gap-2">
              <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase font-mono">SECTOR_HUB:</span>
              <h1 className="text-[20px] font-black tracking-tighter text-hud-yellow uppercase leading-none font-mono">
                {nodeName}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[14px] font-bold text-white/60 tracking-widest tabular-nums leading-none font-mono">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-[10px] text-white/40 font-medium truncate max-w-[60%] font-sans">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{currentNode?.address || 'LOCATION_PENDING'}</span>
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

      {/* Tap & Login Section */}
      <div className="p-4 bg-hud-bg shrink-0 border-b border-white/5">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <div className="text-[9px] font-bold text-hud-green/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <div className="w-1 h-1 rounded-full bg-hud-green" />
            Tap in · anonymous · here now
          </div>
          <div className="text-[9px] font-bold text-[#5BB8F5]/60 uppercase tracking-widest flex items-center gap-1.5 font-mono">
            <div className="w-1 h-1 rounded-full bg-[#5BB8F5]" />
            Login · persistent · everywhere
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setTapConfirmAction('in')}
            className={`flex-1 py-3 rounded-xl text-[12px] font-bold tracking-widest uppercase transition-all font-mono ${
              isTappedIn 
                ? 'bg-hud-green text-hud-dark shadow-[0_4px_15px_rgba(29,158,117,0.3)]' 
                : 'bg-hud-green/15 text-hud-green/50'
            }`}
          >
            TAP IN {isTappedIn && '✓'}
          </button>
          <button
            onClick={() => setTapConfirmAction('out')}
            className={`flex-1 py-3 rounded-xl text-[12px] font-bold tracking-widest uppercase border transition-all font-mono ${
              !isTappedIn 
                ? 'bg-hud-magenta text-white border-hud-magenta shadow-[0_4px_15px_rgba(226,75,74,0.3)]' 
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            TAP OUT
          </button>
        </div>

        <div className="mt-2">
          {!user ? (
            <div className="text-[10px] font-medium text-white/40 flex items-center justify-between font-sans">
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={12} className="text-hud-green" />
                Anonymous by default.
              </div>
              <button 
                onClick={() => setShowLogin(!showLogin)}
                className="text-[#5BB8F5] font-bold hover:underline flex items-center gap-1"
              >
                Want history & wallet? Log in <ArrowRight size={10} />
              </button>
            </div>
          ) : (
            <div className="text-[10px] font-medium text-hud-green flex items-center gap-1.5 font-sans">
              <ShieldCheck size={12} />
              Identity verified. Wallet & History active.
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
      <div className="bg-hud-green/10 px-4 py-2.5 flex items-center gap-2.5 border-y border-hud-green/20 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-hud-green animate-pulse" />
        <div className="text-[10px] text-hud-green font-bold tracking-[0.12em] font-mono uppercase">
          OPEN FEED — ALL LIVE EVENTS VISIBLE. NO ACCOUNT REQUIRED.
        </div>
      </div>

      {/* Feed Area */}
      <div className={`flex-1 ${activeTab === 'map' ? 'overflow-hidden' : 'overflow-y-auto'} bg-feed-bg transition-all duration-500 ${!isTappedIn && activeTab === 'feed' ? 'opacity-60 grayscale' : ''}`}>
        {activeTab === 'wallet' ? (
          <div className="p-4 flex flex-col gap-6 py-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-[10px] font-black tracking-[0.2em] text-[#888780] uppercase whitespace-nowrap">MY_SECURED_HUBS</span>
              <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
            </div>
            
            {savedHubs.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center justify-center">
                <div className="text-[#888780] italic mb-4 tracking-[0.2em] text-[10px] uppercase leading-relaxed max-w-[280px]">
                  WALLET_EMPTY.
                </div>
                <div className="text-hud-bg font-black tracking-[0.1em] text-sm uppercase leading-relaxed max-w-[280px]">
                  SAVE_HUBS_TO_ACCESS_THEM_QUICKLY_LATER.
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
                    GO_TO_HUB
                  </a>
                </motion.div>
              ))
            )}
          </div>
        ) : activeTab === 'map' ? (
          <MapView 
            currentNode={currentNode} 
            broadcasts={broadcasts} 
            onSelect={onSelect} 
            partnersMap={partnersMap}
          />
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
              <div className="text-xs font-black tracking-[0.2em] mb-1">SESSION_TERMINATED</div>
              <div className="text-[10px] font-bold opacity-80 uppercase">ZERO_DATA_STORED // ANONYMITY_PRESERVED</div>
            </motion.div>
          )}
        </AnimatePresence>

        {broadcasts.length === 0 ? (
          <div className="py-12 text-center flex flex-col items-center justify-center h-full">
            <div className="text-[#888780] italic mb-4 tracking-[0.2em] text-[10px] uppercase leading-relaxed max-w-[280px]">
              THE_SECTOR_IS_SILENT.
            </div>
            <div className="text-hud-bg font-black tracking-[0.1em] text-sm uppercase leading-relaxed max-w-[280px]">
              GO_WANDER. DISCOVER_NEW_PLACES.
              <br/>
              THE_PULSE_OF_THE_CITY_AWAITS.
            </div>
            <div className="mt-8 w-12 h-[1px] bg-[#D3D1C7]" />
          </div>
        ) : (
          <>
            {renderSection('FLASH DEALS', flashDeals)}
            {renderSection('LIVE EVENTS', liveEvents)}
            {renderSection('CONFERENCE FEED', conferenceFeed)}
          </>
        )}
      </div>
    )}
  </div>

      {/* Footer Stats — System Health */}
      <div className="bg-hud-bg px-5 py-4 flex justify-between items-center border-t border-white/5 shrink-0">
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-[16px] font-black text-hud-yellow leading-none font-mono">{activeNodesCount}</div>
            <div className="text-[9px] text-white/35 font-bold tracking-[0.15em] uppercase mt-1 font-mono">NODES ACTIVE</div>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-black text-hud-yellow leading-none font-mono">{uptime}%</div>
            <div className="text-[9px] text-white/35 font-bold tracking-[0.15em] uppercase mt-1 font-mono">UPTIME</div>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-black text-hud-yellow leading-none font-mono">{radiusInMiles} MI</div>
            <div className="text-[9px] text-white/35 font-bold tracking-[0.15em] uppercase mt-1 font-mono">RADIUS</div>
          </div>
        </div>
        <div className="text-[9px] text-white/20 font-bold tracking-widest uppercase text-right font-mono">
          FLUX_PROTOCOL_OS v1.0
        </div>
      </div>

      {/* Bottom Navigation — Utility Rail */}
      <div className="bg-hud-dark px-4 py-2.5 flex justify-between items-center border-t border-white/5 shrink-0">
        <a 
          href="/"
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <Home size={20} className="text-white/30 group-hover:text-white/60" />
          <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase group-hover:text-white/60 font-mono">HOME</span>
        </a>
        <button 
          onClick={() => onTabChange?.('feed')}
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <Clock size={20} className={activeTab === 'feed' ? 'text-hud-yellow' : 'text-white/30 group-hover:text-white/60'} />
          <span className={`text-[9px] font-bold tracking-widest uppercase font-mono ${activeTab === 'feed' ? 'text-hud-yellow' : 'text-white/30 group-hover:text-white/60'}`}>FEED</span>
        </button>
        <button 
          onClick={() => onTabChange?.('map')}
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <MapIcon size={20} className={activeTab === 'map' ? 'text-hud-yellow' : 'text-white/30 group-hover:text-white/60'} />
          <span className={`text-[9px] font-bold tracking-widest uppercase font-mono ${activeTab === 'map' ? 'text-hud-yellow' : 'text-white/30 group-hover:text-white/60'}`}>MAP</span>
        </button>
        <button 
          onClick={() => onTabChange?.('wallet')}
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group relative"
        >
          <Ticket size={20} className={activeTab === 'wallet' ? 'text-hud-yellow' : 'text-white/30 group-hover:text-white/60'} />
          {savedHubs.length > 0 && (
            <div className="absolute top-1 right-3 w-1.5 h-1.5 bg-hud-magenta rounded-full shadow-[0_0_5px_#ff2d78]" />
          )}
          <span className={`text-[9px] font-bold tracking-widest uppercase font-mono ${activeTab === 'wallet' ? 'text-hud-yellow' : 'text-white/30 group-hover:text-white/60'}`}>WALLET</span>
        </button>
        <a 
          href="/dashboard"
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <Lock size={20} className="text-white/30 group-hover:text-white/60" />
          <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase group-hover:text-white/60 font-mono">PARTNER</span>
        </a>
        <a 
          href="/dashboard"
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <ShieldCheck size={20} className="text-white/30 group-hover:text-white/60" />
          <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase group-hover:text-white/60 font-mono">CONTROL</span>
        </a>
      </div>

      <AnimatePresence>
        {tapConfirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-hud-bg/90 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-[280px] bg-hud-bg border border-hud-green/30 p-6 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] text-center"
            >
              <div className="w-12 h-12 rounded-full bg-hud-yellow/10 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="text-hud-yellow" size={24} />
              </div>
              <h3 className="text-sm font-black tracking-widest uppercase mb-2">Confirm Action</h3>
              <p className="text-[11px] text-white/60 leading-relaxed mb-6 uppercase tracking-wider">
                {tapConfirmAction === 'in' 
                  ? 'Are you sure you want to tap in to this sector?' 
                  : 'Are you sure you want to tap out? Your active session will be terminated.'}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={tapConfirmAction === 'in' ? handleTapIn : handleTapOut}
                  className={`w-full py-3 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase transition-all ${
                    tapConfirmAction === 'in' ? 'bg-hud-green text-hud-bg' : 'bg-hud-magenta text-white'
                  }`}
                >
                  Confirm {tapConfirmAction}
                </button>
                <button
                  onClick={() => setTapConfirmAction(null)}
                  className="w-full py-3 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase text-white/40 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
