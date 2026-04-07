import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile, Partner, Route, Guide, Sponsor } from '../types';
import { MapView } from './MapView';
import { BroadcastCard } from './BroadcastCard';
import { FlashDealCard } from './FlashDealCard';
import { Feed } from './Feed';
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
  onManage?: (broadcast: Broadcast) => void;
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
  onManage,
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
  const [headerTheme, setHeaderTheme] = useState<'yellow' | 'dark' | 'photo' | 'white'>(() => {
    return (localStorage.getItem('uh_header_theme') as any) || 'yellow';
  });
  const [recentNodes, setRecentNodes] = useState<Node[]>(() => {
    try {
      const saved = localStorage.getItem('uh_node_memory');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [pausedSession, setPausedSession] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('uh_session');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tapConfirmAction, setTapConfirmAction] = useState<'in' | 'out' | null>(null);
  const [uptime, setUptime] = useState(99.9);
  const [showLogin, setShowLogin] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    localStorage.setItem('uh_header_theme', headerTheme);
  }, [headerTheme]);

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

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    // We want to collapse fully over 240px of scroll (320 expanded - 80 collapsed)
    const progress = Math.min(1, scrollTop / 240);
    setScrollProgress(progress);
  };

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

  const handleDirections = (loc: { address: string; latitude: number; longitude: number }) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`;
    window.open(url, '_blank');
  };

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

  const themeColors = {
    yellow: { bg: '#FFE01A', text: '#1A1A1A', card: '#1A1A1A', cardText: '#FFE01A' },
    dark: { bg: '#1A1A1A', text: '#FFFFFF', card: '#262626', cardText: '#FFE01A' },
    photo: { bg: '#000000', text: '#FFFFFF', card: 'rgba(26, 26, 26, 0.8)', cardText: '#FFE01A' },
    white: { bg: '#FFFFFF', text: '#1A1A1A', card: '#1A1A1A', cardText: '#FFE01A' }
  };

  const currentTheme = themeColors[headerTheme];

  return (
    <div className="flex flex-col h-full bg-[#F5F5F3] text-[#1A1A1A] relative overflow-hidden">
      {/* Collapsible Header Container */}
      <motion.div 
        style={{ 
          height: 320 - (scrollProgress * 240),
          backgroundColor: scrollProgress > 0.8 ? '#1A1A1A' : currentTheme.bg
        }}
        className="fixed top-0 inset-x-0 z-[100] flex flex-col overflow-hidden transition-colors duration-300"
      >
        {headerTheme === 'photo' && scrollProgress <= 0.8 && (
          <img 
            src={`https://picsum.photos/seed/${currentNode?.id || 'node'}/800/600`}
            className="absolute inset-0 w-full h-full object-cover opacity-40"
            alt="Header Background"
            referrerPolicy="no-referrer"
          />
        )}
        
        {/* Expanded Header Content */}
        <motion.div 
          style={{ opacity: 1 - (scrollProgress * 2) }}
          className="px-6 pt-8 pb-12 flex flex-col gap-6 shrink-0 relative h-full"
        >
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="text-[14px] font-black tracking-tight uppercase font-mono" style={{ color: currentTheme.text }}>URBAN HIKERS</div>
              <div className="text-[9px] font-bold uppercase tracking-widest font-mono opacity-40" style={{ color: currentTheme.text }}>FLUX_PROTOCOL_OS</div>
            </div>
            
            {/* Theme Switcher */}
            <div className="flex gap-2 bg-black/10 backdrop-blur-md p-1.5 rounded-full border border-white/10">
              {(['yellow', 'dark', 'photo', 'white'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setHeaderTheme(t)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    headerTheme === t ? 'scale-110 border-white shadow-lg' : 'border-transparent opacity-60'
                  }`}
                  style={{ 
                    backgroundColor: t === 'photo' ? '#000' : themeColors[t].bg,
                    backgroundImage: t === 'photo' ? 'linear-gradient(45deg, #000, #444)' : 'none'
                  }}
                />
              ))}
            </div>
          </div>

          {/* Hub Card */}
          <div 
            className="rounded-[20px] overflow-hidden shadow-2xl relative z-10 flex flex-col"
            style={{ backgroundColor: currentTheme.card }}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col">
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase font-mono mb-1 opacity-50" style={{ color: currentTheme.cardText }}>SECTOR_HUB</span>
                  <h1 className="text-[28px] font-black tracking-tighter uppercase leading-none font-mono" style={{ color: currentTheme.cardText }}>
                    {nodeName.replace('_HUB', '')}
                  </h1>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-[9px] font-black tracking-[0.2em] uppercase font-mono mb-1 opacity-50" style={{ color: currentTheme.cardText }}>SYSTEM_TIME</span>
                  <div className="text-[20px] font-black tracking-widest leading-none font-mono font-variant-numeric-tabular-nums" style={{ color: '#FFFFFF' }}>
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <div className="flex flex-col gap-1.5 max-w-[70%]">
                  <div className="flex items-center gap-2 text-[11px] font-medium truncate font-sans" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <MapPin size={14} className="shrink-0" style={{ color: currentTheme.cardText }} />
                    <span className="truncate">{currentNode?.address || 'LOCATION_PENDING'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={onShareNode}
                    className="p-2 text-white/40 hover:text-uh-yellow transition-colors bg-white/5 rounded-full"
                  >
                    <Share2 size={18} />
                  </button>
                  {currentNode && (
                    <button 
                      onClick={() => handleDirections({ address: currentNode.address, latitude: currentNode.latitude, longitude: currentNode.longitude } as any)}
                      className="bg-uh-yellow text-uh-black px-4 py-2 rounded-[24px] text-[10px] font-black uppercase tracking-widest font-mono shadow-lg shadow-uh-yellow/20"
                    >
                      GO
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Session Row (Integrated into Hub Card) */}
            <div className="bg-black/40 backdrop-blur-md px-6 py-4 flex items-center justify-between border-t border-white/5">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${isTappedIn ? 'bg-[#22C55E] shadow-[0_0_8px_#22C55E]' : 'bg-uh-gray-600'}`} />
                <div className="flex flex-col">
                  <span className="text-[11px] font-black text-white uppercase tracking-wider font-mono">
                    {isTappedIn ? "ACTIVE_SESSION" : "STANDBY_MODE"}
                  </span>
                  <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">
                    {isTappedIn ? `NODE_${currentNode?.id || '00'} · 14M` : "TAP_TO_INITIALIZE"}
                  </span>
                </div>
              </div>
              
              <button 
                onClick={() => setTapConfirmAction(isTappedIn ? 'out' : 'in')}
                className={`text-[9px] font-black uppercase tracking-widest font-mono px-4 py-2 rounded-[24px] transition-all border ${
                  isTappedIn 
                    ? 'border-[#EF4444]/20 text-[#EF4444] bg-[#EF4444]/10' 
                    : 'border-white/10 text-white bg-white/5'
                }`}
              >
                {isTappedIn ? 'TERMINATE' : 'INITIALIZE'}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Collapsed Header Content (Sticky Bar) */}
        <motion.div 
          style={{ opacity: scrollProgress > 0.8 ? (scrollProgress - 0.8) * 5 : 0 }}
          className="absolute bottom-0 inset-x-0 h-20 bg-[#1A1A1A] flex items-center justify-between px-6 border-b border-white/10"
        >
          <div className="flex flex-col">
            <span className="text-[8px] font-black tracking-[0.2em] text-[#FFE01A]/50 uppercase font-mono">SECTOR_HUB</span>
            <h2 className="text-lg font-black text-[#FFE01A] uppercase tracking-tight font-mono leading-none">
              {nodeName.replace('_HUB', '')}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[8px] font-black tracking-[0.2em] text-[#FFE01A]/50 uppercase font-mono">TIME</span>
              <div className="text-sm font-black text-white tracking-widest font-mono leading-none font-variant-numeric-tabular-nums">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>
            <div className={`w-2 h-2 rounded-full ${isTappedIn ? 'bg-[#FFE01A] shadow-[0_0_8px_#FFE01A]' : 'bg-uh-gray-600'}`} />
          </div>
        </motion.div>
      </motion.div>

      {/* Main Scrollable Area */}
      <div 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative z-10 no-scrollbar pt-[320px]"
      >
        <div className="flex flex-col gap-0 pb-12">
          {/* Identity Bar (Always Dark) */}
          <div className="bg-[#1A1A1A] px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ShieldCheck size={14} className="text-[#FFE01A]" />
              <span className="text-[10px] font-black text-[#FFE01A] uppercase tracking-widest font-mono">
                {user ? 'IDENTITY_VERIFIED' : 'ANONYMOUS_PROTOCOL'}
              </span>
            </div>
            {!user && (
              <button 
                onClick={onLogin}
                className="text-white/40 text-[9px] font-black uppercase tracking-widest font-mono hover:text-[#FFE01A]"
              >
                UPGRADE_ID
              </button>
            )}
          </div>

          <div className="flex flex-col gap-6 pt-6">
            {/* Feed Content */}
            {activeTab === 'feed' ? (
              <Feed 
                broadcasts={broadcasts}
                currentNode={currentNode}
                onSelect={onSelect}
                onShareEvent={onShareEvent}
                partnersMap={partnersMap}
                sponsorsMap={sponsorsMap}
              />
            ) : activeTab === 'explore' ? (
            <div className="h-full flex flex-col">
              <div className="h-[400px]">
                <MapView 
                  currentNode={currentNode} 
                  broadcasts={broadcasts} 
                  onSelect={onSelect} 
                  partnersMap={partnersMap}
                />
              </div>
              <div className="p-6 flex flex-col gap-4 border-t border-uh-gray-100">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] font-bold tracking-wider text-uh-gray-400 font-sans whitespace-nowrap uppercase">Mission Board</span>
                  <div className="flex-1 h-[1px] bg-uh-gray-100" />
                </div>
                
                {routes.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center justify-center">
                    <div className="text-uh-gray-400 italic mb-4 tracking-wider text-[10px] font-sans leading-relaxed max-w-[280px]">
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
            <div className="p-6 flex flex-col gap-6 py-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold tracking-wider text-uh-gray-400 font-sans whitespace-nowrap uppercase">Wallet</span>
                <div className="flex-1 h-[1px] bg-uh-gray-100" />
              </div>
              
              {savedHubs.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center">
                  <div className="text-uh-gray-400 italic mb-4 tracking-wider text-[10px] font-sans leading-relaxed max-w-[280px]">
                    Wallet empty.
                  </div>
                  <div className="text-uh-black font-bold tracking-tight text-sm font-sans leading-relaxed max-w-[280px]">
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
                      className="absolute top-4 right-4 p-2 bg-uh-magenta text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from Wallet"
                    >
                      <Lock size={14} />
                    </button>
                    <a 
                      href={`/tap/${hub.id}`}
                      className="absolute bottom-4 right-16 p-2 bg-uh-black text-uh-yellow rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[10px] font-black"
                    >
                      Go to hub
                    </a>
                  </motion.div>
                ))
              )}
            </div>
          ) : activeTab === 'profile' ? (
            <div className="p-6 flex flex-col gap-6 py-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[10px] font-bold tracking-wider text-uh-gray-400 font-sans whitespace-nowrap uppercase">User Profile</span>
                <div className="flex-1 h-[1px] bg-uh-gray-100" />
              </div>
              
              <div className="bg-white p-6 rounded-[20px] border border-uh-gray-100 shadow-sm">
                {user ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-uh-yellow flex items-center justify-center border border-uh-yellow/20 shadow-inner">
                        <Users className="text-uh-black" size={28} />
                      </div>
                      <div>
                        <div className="text-uh-black font-black text-lg tracking-tight">{user.email}</div>
                        <div className="text-[9px] text-uh-gray-400 font-mono uppercase tracking-widest">UID: {user.uid.slice(0, 12)}...</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-uh-gray-50 rounded-[20px] border border-uh-gray-100">
                        <div className="text-[8px] text-uh-gray-400 uppercase tracking-widest font-mono mb-1">Access Level</div>
                        <div className="text-uh-black font-black uppercase tracking-tight font-mono text-xs">Verified_Hiker</div>
                      </div>
                      <div className="p-4 bg-uh-gray-50 rounded-[20px] border border-uh-gray-100">
                        <div className="text-[8px] text-uh-gray-400 uppercase tracking-widest font-mono mb-1">Trust Score</div>
                        <div className="text-uh-black font-black uppercase tracking-tight font-mono text-xs">98.4%</div>
                      </div>
                    </div>

                    {/* Web-to-Wallet UI */}
                    <div className="pt-6 border-t border-uh-gray-100 flex flex-col gap-3">
                      <h4 className="text-[10px] font-black text-uh-black uppercase tracking-[0.2em] font-mono mb-1">Pass_Management</h4>
                      <button className="w-full bg-black text-white py-3.5 rounded-[24px] flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-lg">
                        <Ticket size={18} className="text-uh-yellow" />
                        <span className="text-[11px] font-black uppercase tracking-widest font-mono">Add to Apple Wallet</span>
                      </button>
                      <button className="w-full bg-uh-black text-white py-3.5 rounded-[24px] flex items-center justify-center gap-3 hover:scale-[1.02] transition-transform shadow-lg">
                        <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                          <div className="w-3 h-3 bg-blue-600 rounded-full" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-widest font-mono">Add to Google Wallet</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-uh-gray-400 text-[10px] mb-6 uppercase tracking-[0.2em] font-mono">Identity_Not_Verified</div>
                    <button 
                      onClick={onLogin}
                      className="bg-uh-yellow text-uh-black px-8 py-3 rounded-full text-[12px] font-black uppercase tracking-widest shadow-lg shadow-uh-yellow/20"
                    >
                      Login to Pulse
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'home' ? (
            <div className="p-6 flex flex-col gap-8">
              {/* Node Memory List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black tracking-[0.2em] text-uh-gray-400 uppercase font-mono whitespace-nowrap">NODE_MEMORY</span>
                  <div className="flex-1 h-[1px] bg-uh-gray-100" />
                </div>
                
                {recentNodes.length === 0 ? (
                  <div className="bg-white p-6 rounded-[20px] border border-uh-gray-100 text-center">
                    <div className="text-uh-gray-400 text-[10px] uppercase tracking-widest font-mono">No_Recent_Nodes</div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {recentNodes.map((node) => (
                      <a 
                        key={node.id}
                        href={`/tap/${node.id}`}
                        className="bg-white p-4 rounded-[20px] border border-uh-gray-100 flex items-center justify-between group hover:border-uh-yellow transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-uh-gray-50 flex items-center justify-center border border-uh-gray-100 group-hover:bg-uh-yellow/10 transition-colors">
                            <MapPin size={18} className="text-uh-black" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-uh-black uppercase tracking-tight">{node.name}</span>
                            <span className="text-[9px] text-uh-gray-400 font-mono uppercase tracking-widest">Sector_{node.id}</span>
                          </div>
                        </div>
                        <ArrowRight size={16} className="text-uh-gray-200 group-hover:text-uh-black transition-colors" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Highlights */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black tracking-[0.2em] text-uh-gray-400 uppercase font-mono whitespace-nowrap">SECTOR_HIGHLIGHTS</span>
                  <div className="flex-1 h-[1px] bg-uh-gray-100" />
                </div>
                
                {broadcasts.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {broadcasts.slice(0, 3).map((item, idx) => (
                      <BroadcastCard 
                        key={item.id}
                        item={item}
                        idx={idx}
                        currentNode={currentNode}
                        onSelect={onSelect}
                        onShareEvent={onShareEvent}
                        onManage={onManage}
                        partner={partnersMap[item.partnerId || item.partner_id || ''] || null}
                        variant="peek"
                        canManage={userProfile?.role === 'admin' || (userProfile?.role === 'partner' && userProfile?.partner_id === item.partner_id)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-uh-gray-400 text-[10px] uppercase tracking-widest font-mono">
                    No highlights available.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6">
              <AnimatePresence>
                {showConfirmation && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="mx-6 mb-6 p-4 rounded-2xl border border-uh-magenta bg-uh-magenta/5 text-uh-magenta text-center"
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
                    <div className="w-32 h-32 bg-uh-yellow/5 rounded-full flex items-center justify-center shadow-xl mx-auto mb-6 border border-uh-yellow/20">
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
                    <h2 className="font-bebas text-2xl tracking-[4px] text-uh-black uppercase">Urban Hikers</h2>
                  </motion.div>

                  <div className="space-y-2">
                    <div className="text-uh-black font-black tracking-[0.2em] text-xs uppercase">
                      The sector is silent.
                    </div>
                    <div className="text-uh-gray-400 font-bold tracking-[0.1em] text-[10px] uppercase leading-relaxed max-w-[240px] mx-auto">
                      Go wander. Discover new places.
                      The pulse of the city awaits.
                    </div>
                  </div>
                  
                  <div className="mt-12 w-16 h-[2px] bg-uh-yellow mx-auto" />
                </div>
              ) : (
                <Feed 
                  broadcasts={broadcasts}
                  currentNode={currentNode}
                  onSelect={onSelect}
                  onShareEvent={onShareEvent}
                  onManage={onManage}
                  partnersMap={partnersMap}
                  sponsorsMap={sponsorsMap}
                  userProfile={userProfile}
                />
              )}
            </div>
          )}
        </div>
        {/* Stats Bar */}
          <div className="px-6 py-6 border-t border-uh-gray-100 bg-white">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-uh-gray-400 uppercase tracking-widest font-mono">NODES_ACTIVE</span>
                <span className="text-lg font-black text-uh-black font-mono">0{activeNodesCount}</span>
              </div>
              <div className="flex flex-col text-center">
                <span className="text-[8px] font-black text-uh-gray-400 uppercase tracking-widest font-mono">SECTOR_RADIUS</span>
                <span className="text-lg font-black text-uh-black font-mono">{radiusInMiles}MI</span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[8px] font-black text-uh-gray-400 uppercase tracking-widest font-mono">OS_UPTIME</span>
                <span className="text-lg font-black text-uh-black font-mono">{uptime}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    {/* Bottom Navigation — Airy & Minimal */}
    <div className="fixed bottom-0 inset-x-0 z-[110] flex flex-col pointer-events-none">
      {/* Session Grace Window Banner */}
      <AnimatePresence>
        {pausedSession && !isTappedIn && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="mx-4 mb-4 p-4 bg-[#1A1A1A] rounded-[20px] shadow-2xl flex items-center justify-between border border-white/10 pointer-events-auto"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FFE01A]/10 flex items-center justify-center border border-[#FFE01A]/20">
                <Clock className="text-[#FFE01A]" size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-black text-white uppercase tracking-wider font-mono">SESSION_PAUSED</span>
                <span className="text-[9px] text-white/40 font-mono uppercase tracking-widest">Node_{pausedSession.nodeId || '00'} · Grace window active</span>
              </div>
            </div>
            <button 
              onClick={() => {
                onTapToggle(true);
                setPausedSession(null);
                localStorage.removeItem('uh_session');
              }}
              className="bg-[#FFE01A] text-[#1A1A1A] px-5 py-2 rounded-[24px] text-[10px] font-black uppercase tracking-widest font-mono shadow-lg shadow-[#FFE01A]/20"
            >
              RESUME
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white px-4 py-4 flex justify-between items-center border-t border-uh-gray-100 shrink-0 pointer-events-auto">
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
            <div className="flex flex-col items-center gap-1.5 group relative">
              <Icon size={20} className={`${isActive ? 'text-uh-black' : 'text-uh-gray-400 group-hover:text-uh-black'} transition-colors`} />
              {isActive && (
                <motion.div 
                  layoutId="activeDot"
                  className="w-1 h-1 bg-uh-yellow rounded-full"
                />
              )}
              {item.badge && !isActive && (
                <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-uh-magenta rounded-full" />
              )}
            </div>
          );

          if (item.href) {
            return (
              <a key={item.id} href={item.href} className="px-4 py-1">
                {content}
              </a>
            );
          }

          return (
            <button 
              key={item.id}
              onClick={() => onTabChange?.(item.id as any)}
              className="px-4 py-1"
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
            className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-uh-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-[300px] bg-white p-8 rounded-[32px] shadow-2xl text-center relative overflow-hidden border border-uh-gray-100"
            >
              <div className="w-16 h-16 rounded-full bg-uh-yellow/10 flex items-center justify-center mx-auto mb-6 border border-uh-yellow/20">
                <AlertCircle className="text-uh-black" size={32} />
              </div>
              <h3 className="text-[16px] font-black tracking-tight mb-3 font-sans text-uh-black uppercase">Confirmation</h3>
              <p className="text-[12px] text-uh-gray-400 leading-relaxed mb-8 font-sans font-medium">
                {tapConfirmAction === 'in' 
                  ? 'Initiate anonymous session in current sector?' 
                  : 'Terminate active session and disconnect from node?'}
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={tapConfirmAction === 'in' ? handleTapIn : handleTapOut}
                  className={`w-full py-4 rounded-full text-[12px] font-black tracking-widest uppercase transition-all font-mono shadow-lg ${
                    tapConfirmAction === 'in' 
                      ? 'bg-uh-yellow text-uh-black shadow-uh-yellow/20' 
                      : 'bg-uh-magenta text-white shadow-uh-magenta/20'
                  }`}
                >
                  {tapConfirmAction === 'in' ? 'Execute Tap In' : 'Execute Tap Out'}
                </button>
                <button
                  onClick={() => setTapConfirmAction(null)}
                  className="w-full py-3 text-[10px] font-black text-uh-gray-400 uppercase tracking-widest hover:text-uh-black transition-colors font-mono"
                >
                  Abort Action
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
);
};
