import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile } from '../types';
import { Zap, Music, Palette, Calendar, Clock, ShieldCheck, MapPin, Home, Lock, LayoutGrid, ExternalLink, Share2, ArrowRight, Mic, Users, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDistance } from '../utils/geo';
import { MiniVibeTrend } from './MiniVibeTrend';

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
  onShareEvent
}) => {
  const [time, setTime] = useState(new Date());
  const [showConfirmation, setShowConfirmation] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleTapOut = () => {
    onTapToggle(false);
    setShowConfirmation(true);
    setTimeout(() => setShowConfirmation(false), 5000);
  };

  const handleDirections = (item: Broadcast) => {
    const destination = item.address || `${item.latitude},${item.longitude}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    window.open(url, '_blank');
  };

  const flashDeals = broadcasts.filter(b => b.type === 'flash_deal');
  const liveEvents = broadcasts.filter(b => b.type === 'event');
  const conferenceFeed = broadcasts.filter(b => b.type === 'conference_panel');

  const getIcon = (item: Broadcast) => {
    if (item.type === 'flash_deal') return <Zap size={18} className="text-[#BA7517]" />;
    if (item.type === 'conference_panel') return <Mic size={18} className="text-[#1A2B4A]" />;
    if (item.title.toLowerCase().includes('music') || item.title.toLowerCase().includes('jazz')) return <Music size={18} className="text-[#3B6D11]" />;
    if (item.title.toLowerCase().includes('art') || item.title.toLowerCase().includes('expo')) return <Palette size={18} className="text-[#534AB7]" />;
    if (item.type === 'event') return <Ticket size={18} className="text-[#185FA5]" />;
    return <Calendar size={18} className="text-[#185FA5]" />;
  };

  const getIconBg = (item: Broadcast) => {
    if (item.type === 'flash_deal') return 'bg-[#FFF3CC]';
    if (item.type === 'conference_panel') return 'bg-[#E6F1FB]';
    if (item.title.toLowerCase().includes('music') || item.title.toLowerCase().includes('jazz')) return 'bg-[#EAF3DE]';
    if (item.title.toLowerCase().includes('art') || item.title.toLowerCase().includes('expo')) return 'bg-[#EEEDFE]';
    if (item.type === 'event') return 'bg-[#E6F1FB]';
    return 'bg-[#F0EEE8]';
  };

  const getEventStatus = (item: Broadcast) => {
    const now = new Date();
    const start = new Date(item.starts_at);
    const end = new Date(item.expires_at);

    if (now < start) {
      const diff = start.getTime() - now.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) return { isLive: false, label: 'UPCOMING', time: `STARTS IN ${hrs}H ${mins % 60}M` };
      return { isLive: false, label: 'UPCOMING', time: `STARTS IN ${mins}M` };
    }
    
    const diff = end.getTime() - now.getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return { isLive: true, label: 'LIVE', time: `${hrs}H ${mins % 60}M REMAINING` };
    return { isLive: true, label: 'LIVE', time: `${mins}M REMAINING` };
  };

  const getBadgeStyle = (item: Broadcast) => {
    const { isLive } = getEventStatus(item);
    const vibe = item.current_vibe;
    const title = item.title;

    if (!isLive) return 'bg-[#F0EEE8] text-[#888780]';
    if (title.includes('BTW26') || title.includes('LIVE')) return 'bg-[#FCEBEB] text-[#A32D2D]';
    if (vibe === 'packed') return 'bg-[#EEEDFE] text-[#3C3489]';
    if (vibe === 'buzzing') return 'bg-[#FFF3CC] text-[#854F0B]';
    return 'bg-[#EAF3DE] text-[#3B6D11]';
  };

  const renderSection = (title: string, items: Broadcast[]) => {
    if (items.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-[10px] font-black tracking-[0.2em] text-[#888780] uppercase whitespace-nowrap">{title}</span>
          <div className="flex-1 h-[1px] bg-[#D3D1C7]" />
        </div>
        
        {items.map((item, idx) => {
          const distance = currentNode ? getDistance(
            currentNode.latitude,
            currentNode.longitude,
            item.latitude,
            item.longitude
          ) : 0;
          const walkTime = Math.ceil(distance / 80);

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-white rounded-2xl mb-3 border border-black/5 shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden ${!getEventStatus(item).isLive ? 'opacity-70' : ''}`}
            >
              <div className="p-4" onClick={() => onSelect(item)}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(item)}`}>
                      {getIcon(item)}
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-[#1A1A1A] leading-tight mb-0.5">{item.title}</div>
                      <div className="text-[11px] text-[#888780] font-medium uppercase tracking-wide">
                        {item.partner_id === 'admin' ? 'SYSTEM_ADMIN' : (item.partner_id || 'LOCAL_PARTNER')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`badge text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getBadgeStyle(item)}`}>
                      {getEventStatus(item).isLive ? (item.title.includes('BTW26') ? 'LIVE' : item.current_vibe) : 'UPCOMING'}
                    </span>
                    {getEventStatus(item).isLive && <MiniVibeTrend broadcastId={item.id} />}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 bg-[#F8F7F4] border-t border-[#F0EEE8]">
                <div className="flex flex-col gap-1">
                  {item.address && (
                    <div className="flex items-center gap-1.5 text-[11px] text-[#2C2C2A] font-semibold">
                      <MapPin size={12} className="text-[#888780]" />
                      {item.address.split(',')[0]}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 bg-[#1A2B4A] px-2 py-0.5 rounded-full">
                      <span className="text-[9px] font-black text-hud-yellow uppercase tracking-tighter">{walkTime} MIN WALK</span>
                    </div>
                    <div className="text-[10px] text-[#B4B2A9] font-medium uppercase">
                      {getEventStatus(item).time}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onShareEvent(item);
                    }}
                    className="flex items-center gap-1.5 bg-white border border-[#D3D1C7] text-[#888780] px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#F0EEE8] transition-colors"
                  >
                    <Share2 size={12} />
                    SHARE
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDirections(item);
                    }}
                    className="flex items-center gap-1.5 bg-[#1A2B4A] text-hud-yellow px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
                  >
                    DIRECTIONS
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-hud-bg text-white relative overflow-hidden">
      {/* Top Bar */}
      <div className="bg-hud-yellow px-4 py-2.5 flex justify-between items-center shrink-0">
        <div className="flex flex-col">
          <div className="text-[10px] font-black tracking-[0.2em] text-hud-bg uppercase">URBAN HIKERS</div>
          <div className="text-[9px] font-bold text-hud-bg/60 uppercase tracking-widest">LOCAL PULSE</div>
        </div>
        <div className="flex gap-1.5">
          {['NO LOGIN', 'NO GPS', 'NO TRACKING'].map(tag => (
            <span key={tag} className="bg-hud-bg/10 text-hud-bg text-[9px] font-bold px-2 py-1 rounded-full tracking-wider whitespace-nowrap">
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Hero Section */}
      <div className="p-5 pb-4 shrink-0">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-hud-green animate-pulse shadow-[0_0_10px_rgba(76,217,138,0.5)]" />
            <div className="text-[10px] font-bold tracking-[0.2em] text-white/50 uppercase">SECTOR HUB</div>
            {accessVector !== 'direct' && (
              <div className={`px-2 py-0.5 rounded text-[8px] font-black tracking-widest uppercase ${
                accessVector === 'nfc' ? 'bg-hud-yellow text-hud-bg' : 'bg-hud-magenta text-white'
              }`}>
                {accessVector}_LINK
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[26px] font-bold text-white tracking-widest tabular-nums leading-none">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </div>
            <div className="text-[9px] text-white/30 font-bold tracking-[0.2em] uppercase mt-1">SYSTEM TIME</div>
          </div>
        </div>

        <div className="flex justify-between items-end mb-4">
          <div className="flex-1">
            <h1 className="text-[28px] font-black tracking-tighter text-hud-yellow leading-tight uppercase">
              {nodeName}
            </h1>
            {currentNode?.address && (
              <div className="flex items-center gap-1.5 text-[11px] text-white/40 mt-1 font-medium">
                <MapPin size={12} />
                {currentNode.address}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 items-end">
            <button 
              onClick={onShareNode}
              className="p-2 text-hud-yellow/40 hover:text-hud-yellow transition-colors"
              title="Share Sector"
            >
              <Share2 size={20} />
            </button>
            {currentNode && (
              <button 
                onClick={() => handleDirections({ address: currentNode.address, latitude: currentNode.latitude, longitude: currentNode.longitude } as any)}
                className="flex items-center gap-1 bg-hud-yellow text-hud-bg px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest"
              >
                DIRECTIONS
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => onTapToggle(true)}
            className={`flex-1 py-3 rounded-xl text-[12px] font-bold tracking-widest uppercase transition-all ${
              isTappedIn 
                ? 'bg-hud-green text-hud-bg shadow-[0_4px_15px_rgba(76,217,138,0.3)]' 
                : 'bg-hud-green/15 text-hud-green/50'
            }`}
          >
            TAP IN {isTappedIn && '✓'}
          </button>
          <button
            onClick={handleTapOut}
            className={`flex-1 py-3 rounded-xl text-[12px] font-bold tracking-widest uppercase border transition-all ${
              !isTappedIn 
                ? 'bg-hud-magenta text-white border-hud-magenta shadow-[0_4px_15px_rgba(226,75,74,0.3)]' 
                : 'bg-white/5 text-white/40 border-white/10'
            }`}
          >
            {isTappedIn ? 'TAP OUT' : 'TAPPED OUT'}
          </button>
        </div>
      </div>

      {/* Privacy Strip */}
      <div className="bg-hud-dark px-4 py-3 flex items-center gap-3 border-t border-white/5 shrink-0">
        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
          <ShieldCheck size={16} className="text-hud-green" />
        </div>
        <div className="text-[11px] text-white/45 leading-relaxed">
          <strong className="text-hud-green font-bold">ANONYMOUS BY DEFAULT.</strong> Your tap is never tied to an identity. Tap Out anytime to end your session.
        </div>
      </div>

      {/* Open Bar */}
      <div className="bg-[#0E2A1A] px-4 py-2.5 flex items-center gap-2.5 border-y border-hud-green/15 shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-hud-green" />
        <div className="text-[11px] text-hud-green font-bold tracking-wide">
          OPEN FEED — ALL LIVE EVENTS VISIBLE. NO ACCOUNT REQUIRED.
        </div>
      </div>

      {/* Feed Area */}
      <div className={`flex-1 overflow-y-auto bg-feed-bg p-4 transition-all duration-500 ${!isTappedIn ? 'opacity-60 grayscale' : ''}`}>
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

      {/* Footer Stats */}
      <div className="bg-hud-bg px-5 py-4 flex justify-between items-center border-t border-white/5 shrink-0">
        <div className="flex gap-6">
          <div className="text-center">
            <div className="text-[16px] font-black text-hud-yellow leading-none">12</div>
            <div className="text-[9px] text-white/35 font-bold tracking-[0.15em] uppercase mt-1">NODES ACTIVE</div>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-black text-hud-yellow leading-none">99.9%</div>
            <div className="text-[9px] text-white/35 font-bold tracking-[0.15em] uppercase mt-1">UPTIME</div>
          </div>
          <div className="text-center">
            <div className="text-[16px] font-black text-hud-yellow leading-none">3 MI</div>
            <div className="text-[9px] text-white/35 font-bold tracking-[0.15em] uppercase mt-1">RADIUS</div>
          </div>
        </div>
        <div className="text-[9px] text-white/20 font-bold tracking-widest uppercase text-right">
          LOCAL_PULSE_OS v1.0
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-hud-dark px-4 py-2.5 flex justify-between items-center border-t border-white/5 shrink-0">
        <a 
          href="/"
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <Home size={20} className="text-white/30 group-hover:text-white/60" />
          <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase group-hover:text-white/60">HOME</span>
        </a>
        <button 
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors"
        >
          <LayoutGrid size={20} className="text-hud-yellow" />
          <span className="text-[9px] font-bold tracking-widest text-hud-yellow uppercase">FEED</span>
        </button>
        <a 
          href="/dashboard"
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <Lock size={20} className="text-white/30 group-hover:text-white/60" />
          <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase group-hover:text-white/60">PARTNER</span>
        </a>
        <a 
          href="/dashboard"
          className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors group"
        >
          <ShieldCheck size={20} className="text-white/30 group-hover:text-white/60" />
          <span className="text-[9px] font-bold tracking-widest text-white/30 uppercase group-hover:text-white/60">CONTROL</span>
        </a>
      </div>
    </div>
  );
};
