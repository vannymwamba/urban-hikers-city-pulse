import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile, Partner, Route, Guide, Sponsor, LocalHub } from '../types';
import { MapView } from './MapView';
import { BroadcastCard } from './BroadcastCard';
import { FlashDealCard } from './FlashDealCard';
import { Feed } from './Feed';
import { RouteCard } from './RouteCard';
import { Clock, ShieldCheck, MapPin, Home, LayoutGrid, Share2, Ticket, Map as MapIcon, ArrowRight, AlertCircle, Lock, Navigation, Users, Plus, Award, Heart, LogOut, Sparkles, CheckCircle2, Calendar, BookOpen, Star, Wifi } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDistance } from '../utils/geo';
import { WalletCard } from './WalletCard';
import { getEventStatus } from '../utils/broadcastHelpers';
import { BroadcastControlForm } from './BroadcastControlForm';
import { BroadcastType } from '../types';
import { PulseDropStrip } from './PulseDropStrip';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { TapJourneyGraphic } from './TapJourneyGraphic';

interface DepartureBoardProps {
  nodeName: string;
  currentNode: Node | null;
  nodes: Node[];
  broadcasts: Broadcast[];
  onSelect: (broadcast: Broadcast) => void;
  onConfirm?: (id: string) => void;
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
  localHubs?: LocalHub[];
  loading?: boolean;
  xp?: number;
  nodesVisitedCount?: number;
  badges?: string[];
  connectionsCount?: number;
  onSimulateNfc?: () => void;
}

export const DepartureBoard: React.FC<DepartureBoardProps> = ({ 
  nodeName, 
  currentNode, 
  nodes = [],
  broadcasts, 
  onSelect, 
  onConfirm,
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
  nfcStatus = 'idle',
  localHubs = [],
  loading = false,
  xp = 250,
  nodesVisitedCount = 14,
  badges = ["Downtown Explorer", "Coffee Hunter"],
  connectionsCount = 3,
  onSimulateNfc = () => {},
}) => {
  const navItems: Array<{ id: string; icon: any; label: string; href?: string }> = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'feed', icon: Clock, label: 'Feed' },
    { id: 'explore', icon: Navigation, label: 'Explore' },
    { id: 'wallet', icon: Ticket, label: 'Wallet' },
    { id: 'profile', icon: Users, label: 'Profile' }
  ];

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
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);

  // --- Dynamic Hooks and tap history and live events count from Firestore ---
  const hooks = (currentNode as any)?.hooks || [
    { id: 'h1', text: "Fresh artisanal coffee aromas drifting onto Vine Street." },
    { id: 'h2', text: "Where historic OTR brickwork frames modern local experiences." },
    { id: 'h3', text: "Uncovering Cincinnati's secret narratives, one city block at a time." },
    { id: 'h4', text: "Connect, discover, and share the active rhythm of our streets." }
  ];

  const [activeHook, setActiveHook] = useState(0);

  useEffect(() => {
    if (!hooks || hooks.length <= 1) return;

    const interval = setInterval(() => {
      setActiveHook((prev) => (prev + 1) % hooks.length);
    }, 8000);

    return () => clearInterval(interval);
  }, [hooks.length]);

  const [tapCount, setTapCount] = useState<number>(() => {
    if (!currentNode?.id) return 1;
    const count = localStorage.getItem(`uh_tap_count_${currentNode.id}`);
    return count ? Number(count) : 1; 
  });

  useEffect(() => {
    if (currentNode?.id) {
      const key = `uh_tap_count_${currentNode.id}`;
      const count = localStorage.getItem(key);
      if (!count) {
        localStorage.setItem(key, '1');
        setTapCount(1);
      } else {
        setTapCount(Number(count));
      }
    }
  }, [currentNode]);

  useEffect(() => {
    const handleTapEvent = (e: any) => {
      if (e.detail?.nodeId === currentNode?.id) {
        setTapCount(e.detail.count);
      }
    };
    window.addEventListener('uh-node-tapped', handleTapEvent as any);
    return () => window.removeEventListener('uh-node-tapped', handleTapEvent as any);
  }, [currentNode]);

  const [isPulseDropExpanded, setIsPulseDropExpanded] = useState(false);

  // Expanded on second tap or tap history > 1
  useEffect(() => {
    if (tapCount > 1) {
      setIsPulseDropExpanded(true);
    } else {
      setIsPulseDropExpanded(false);
    }
  }, [tapCount, currentNode]);

  const [liveEventsCount, setLiveEventsCount] = useState<number>(3); // start with a nice fallback

  useEffect(() => {
    if (!currentNode?.latitude || !currentNode?.longitude) return;

    const now = new Date();
    // Use Firestore collection `events` filtered by timestamp >= now and location within 500m
    const q = query(
      collection(db, 'events'),
      where('timestamp', '>=', now)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }) as any);

      const nearbyDocs = docs.filter(event => {
        const evLat = event.latitude ?? event.lat ?? (event.coords?.latitude || event.coords?.lat);
        const evLng = event.longitude ?? event.lng ?? (event.coords?.longitude || event.coords?.lng);
        
        if (evLat === undefined || evLng === undefined) return false;
        
        const dist = getDistance(
          currentNode.latitude,
          currentNode.longitude,
          evLat,
          evLng
        );
        return dist <= 500;
      });

      setLiveEventsCount(nearbyDocs.length);
    }, (err) => {
      console.warn("Firestore 'events' real-time query failed (maybe missing index), using fallback:", err);
      try {
        const fallbackQ = collection(db, 'events');
        onSnapshot(fallbackQ, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }) as any);

          const nearbyDocs = docs.filter(event => {
            const evLat = event.latitude ?? event.lat ?? (event.coords?.latitude || event.coords?.lat);
            const evLng = event.longitude ?? event.lng ?? (event.coords?.longitude || event.coords?.lng);
            if (evLat === undefined || evLng === undefined) return false;

            const evTimeStr = event.timestamp;
            let evDate: Date;
            if (evTimeStr && typeof evTimeStr.toDate === 'function') {
              evDate = evTimeStr.toDate();
            } else if (evTimeStr) {
              evDate = new Date(evTimeStr);
            } else {
              evDate = new Date();
            }

            if (evDate < now) return false;

            const dist = getDistance(
              currentNode.latitude,
              currentNode.longitude,
              evLat,
              evLng
            );
            return dist <= 500;
          });
          setLiveEventsCount(nearbyDocs.length);
        });
      } catch (fallbackErr) {
        console.error("Fallback query also failed", fallbackErr);
      }
    });

    return () => unsubscribe();
  }, [currentNode]);
  
  const [formState, setFormState] = useState({ 
    title: '', 
    type: BroadcastType.LIVE_EVENT, 
    node_id: currentNode?.id || '',
    node_ids: [] as string[],
    custom_address: currentNode?.address || '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '12:00',
    end_time: '14:00',
    partner_id: userProfile?.partnerId || userProfile?.partner_id || '',
    cover_url: '',
    artist: '',
    booking_url: '',
    sponsor_logo_url: '',
    is_sponsored: false,
    partner_name: '',
    sponsor_name: '',
    latitude: currentNode?.latitude || null,
    longitude: currentNode?.longitude || null
  });

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

  // Calculate nearby things (within 0.5 miles / 805 meters)
  const nearbyThingsCount = broadcasts.filter(b => {
    if (!currentNode || typeof currentNode.latitude !== 'number' || typeof currentNode.longitude !== 'number') return false;
    if (typeof b.latitude !== 'number' || typeof b.longitude !== 'number') return false;
    const dist = getDistance(currentNode.latitude, currentNode.longitude, b.latitude, b.longitude);
    return dist <= 805;
  }).length;

  return (
    <div className="flex flex-col h-full bg-[#f0f0f0] text-uh-black font-sans relative overflow-hidden">
      {/* Collapsible Header Container — New Co-branded Structure */}
      {activeTab !== 'home' && (
        <motion.div 
          style={{ 
            height: 200, 
            backgroundColor: '#0a0a0a',
            borderBottom: `1px solid ${currentNode?.partner_accent || '#1a1a1a'}33` 
          }}
          className="fixed top-0 inset-x-0 z-[100] flex flex-col overflow-hidden"
        >
        {/* Partner Bar */}
        <div className="px-6 py-3 flex items-center justify-between bg-[#050505] border-b border-white/5">
           <div className="flex items-center gap-3">
             {currentNode?.logo_url ? (
               <div 
                 className={`w-8 h-8 bg-black flex items-center justify-center p-0.5 border ${
                   currentNode.logo_style === 'rounded' ? 'rounded-lg' : currentNode.logo_style === 'square' ? 'rounded-md' : 'rounded-full'
                 }`}
                 style={{ borderColor: currentNode.partner_accent || '#FFE01A' }}
               >
                 <img src={currentNode.logo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" style={{ borderRadius: 'inherit' }} />
               </div>
             ) : currentNode?.partner_initials ? (
               <div 
                 className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black tracking-tighter shrink-0" 
                 style={{ backgroundColor: currentNode.partner_accent || '#FFE01A', color: '#000' }}
               >
                 {currentNode.partner_initials}
               </div>
             ) : null}
             <div className="flex flex-col">
               <div className="flex items-center gap-2">
                 <span className="text-[10px] font-black text-white/80 uppercase tracking-widest leading-none">
                   {currentNode?.partner_name || 'Urban Hikers'}
                 </span>
                 <span className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-none">
                   // {currentNode?.partner_type || 'STREET'} PARTNER
                 </span>
               </div>
             </div>
           </div>
           
           <div className="flex items-center gap-2">
             <div className="px-2 py-1 rounded-full bg-white/5 flex items-center gap-1.5 border border-white/5">
                <div className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: currentNode?.partner_accent || '#FFE01A' }} />
                <span className="text-[8px] font-black uppercase tracking-widest text-[#666]">{currentNode?.partner_type === 'civic' ? 'Civic' : 'Verified'}</span>
             </div>
           </div>
        </div>

        {/* Hub Header Section */}
        <div className="flex-1 px-6 pt-6 pb-4 flex flex-col justify-end relative overflow-hidden">
          {/* Subtle gradient tint from accent or Cover photo */}
          {currentNode?.cover_image_url ? (
            <>
              <img 
                src={currentNode.cover_image_url} 
                className="absolute inset-0 w-full h-full object-cover" 
                referrerPolicy="no-referrer" 
                alt="Hub Cover Collapsed" 
              />
              <div 
                className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/50 to-[#0a0a0a]/80"
              />
            </>
          ) : (
            <div className="absolute inset-0 pointer-events-none opacity-10" 
              style={{ 
                background: `linear-gradient(to bottom, ${currentNode?.partner_accent || '#FFE01A'}, transparent)` 
              }} 
            />
          )}
          
          <div className="relative z-10 flex flex-col">
            <div className="flex items-center gap-3 mb-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-widest font-mono">
                {currentNode?.partner_type?.replace('_', ' ') || 'Sector'} Hub • {currentNode?.address || '636 Race St'}
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-[#FFE01A] uppercase italic leading-[0.8] mb-4">
              {nodeName.replace('_HUB', '').replace(/_/g, ' ')}
            </h1>
            
            {/* Hub Tagline / Live Meta */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-white/60 uppercase tracking-[0.2em] italic">
                  {nearbyThingsCount} things happening within 0.5 miles right now
                </span>
              </div>
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-uh-yellow animate-pulse" />
                <span className="text-[9px] font-black text-white/30 uppercase font-mono tracking-widest">
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-2.5 flex items-center justify-between bg-[#0a0a0a] border-t border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentNode?.partner_accent || '#FFE01A' }} />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] font-mono text-uh-yellow">
              {user ? 'Identity_Verified' : 'Anonymous_Protocol'}
            </span>
            <span className="text-[9px] font-bold text-white/10 mx-1">·</span>
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] font-mono text-white/30">
              {radiusInMiles} mile radius active
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onSimulateNfc}
              className="px-2 py-0.5 rounded bg-[#FFE01A]/10 border border-[#FFE01A]/30 text-[#FFE01A] hover:bg-[#FFE01A]/30 text-[8.5px] font-black uppercase tracking-widest flex items-center gap-1 transition-all pointer-events-auto cursor-pointer"
            >
              <span>⚡ Simulated_Tap</span>
            </button>
            <span className="text-[9px] font-black text-white/10 uppercase tracking-widest font-mono">Sync_active</span>
          </div>
        </div>
      </motion.div>
      )}

      {/* Main Scrollable Area */}
      <div 
        onScroll={handleScroll}
        className={`flex-1 overflow-y-auto relative z-10 ${activeTab === 'home' ? 'pt-0 pb-20' : 'pt-[200px] pb-32'} scroll-smooth`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-col gap-0">
          <div className="flex flex-col">
            {/* Home Node-Specific Landing Page */}
            {activeTab === 'home' ? (
              <div id="home_tab_landing" className="flex flex-col bg-[#0c0c0c] text-white">
                {/* Yellow Header Cover (Height reduced by ~30% with tighter padding) */}
                <div 
                  id="landing_header_yellow"
                  className={`px-8 pt-10 pb-7 flex flex-col justify-end relative overflow-hidden ${currentNode?.cover_image_url ? 'text-white' : 'text-black'}`}
                  style={{ backgroundColor: currentNode?.partner_accent || '#FFE01A' }}
                >
                  {currentNode?.cover_image_url && (
                    <>
                      <img 
                        src={currentNode.cover_image_url} 
                        className="absolute inset-0 w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        alt="Hub Cover" 
                      />
                      <div 
                        className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60"
                      />
                    </>
                  )}

                  <div className="relative z-10 flex justify-between items-start gap-4">
                    <div className="flex flex-col">
                      <span className={`text-[10px] font-black tracking-[0.25em] uppercase ${currentNode?.cover_image_url ? 'text-[#FFE01A]/90' : 'opacity-75'}`}>
                        URBAN HIKERS HUB · TAP DETECTED
                      </span>
                      <h1 className="text-3xl font-extrabold tracking-tight mt-1 mb-1 uppercase font-sans leading-tight">
                        {nodeName.replace('_HUB', '').replace(/_/g, ' ')}
                      </h1>
                      <span className={`text-xs font-mono font-bold uppercase tracking-wider ${currentNode?.cover_image_url ? 'text-white/70' : 'opacity-95'}`}>
                        {currentNode?.address || 'OTR · Cincinnati, OH'}
                      </span>
                    </div>

                    {currentNode?.logo_url && (
                      <div 
                        className={`w-14 h-14 bg-black flex items-center justify-center p-1 font-black text-xs border-2 shrink-0 ${
                          currentNode.logo_style === 'rounded' ? 'rounded-xl' : currentNode.logo_style === 'square' ? 'rounded-md' : 'rounded-full'
                        }`}
                        style={{ borderColor: currentNode.partner_accent || '#FFE01A', color: currentNode.partner_accent || '#FFE01A' }}
                      >
                        <img src={currentNode.logo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" style={{ borderRadius: 'inherit' }} />
                      </div>
                    )}
                  </div>
                  
                  {/* Hook rotation text -italic, left-border-accented */}
                  {hooks.length > 0 && (
                    <div className="mt-3 min-h-[32px] flex items-center relative z-10">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={activeHook}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`italic border-l-2 pl-3 text-[11px] font-bold font-sans ${
                            currentNode?.cover_image_url ? 'border-[#FFE01A] text-white/90' : 'border-black text-black/85'
                          }`}
                        >
                          “{hooks[activeHook]?.text}”
                        </motion.p>
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* 3. PULSE DROP Pill Section (Collapsed/Expanded below Hero - Hidden on first tap) */}
                {tapCount > 1 && (
                  <div className="px-6 pt-5 pb-1">
                    {!isPulseDropExpanded ? (
                      <button 
                        onClick={() => setIsPulseDropExpanded(true)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-[#111111]/90 border border-[#FFE01A]/25 hover:border-[#FFE01A]/40 rounded-2xl text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 h-5 rounded-md bg-[#FFE01A] flex items-center justify-center text-black shadow-md">
                            <Sparkles size={11} className="fill-black" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-white">Pulse Drops Available</span>
                            <span className="text-[8px] font-mono text-[#FFE01A] uppercase tracking-widest block leading-none mt-0.5 animate-pulse">TAP_HISTORY_DETECTED</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 bg-[#FFE01A]/10 px-2.5 py-1 rounded-lg text-[9px] text-[#FFE01A] font-bold font-mono">
                          <span>EXPAND</span>
                          <ArrowRight size={8} />
                        </div>
                      </button>
                    ) : (
                      <div className="bg-[#0f0f0f] border border-white/10 rounded-2xl overflow-hidden relative shadow-2xl">
                        <button 
                          onClick={() => setIsPulseDropExpanded(false)}
                          className="absolute right-4 top-3.5 z-50 text-[9px] font-black text-white/40 hover:text-white font-mono uppercase tracking-widest pointer-events-auto bg-black/50 px-2 py-0.5 rounded cursor-pointer"
                        >
                          [Hide]
                        </button>
                        <PulseDropStrip
                          userId={user?.uid || null}
                          nodeId={currentNode?.id || null}
                          broadcasts={broadcasts}
                          onRevealSaved={(broadcast) => onSelect(broadcast)}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Dark Inner Body Section */}
                <div className="px-6 py-6 space-y-8 flex flex-col pointer-events-auto bg-[#0a0a0a]">
                  
                  {/* Discover Section */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 block mb-4">
                      Discover
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      
                      {/* Grid Item 1: Events (Primary) */}
                      <button 
                        id="btn_tab_feed"
                        onClick={() => onTabChange?.('feed')}
                        className="bg-[#141414] border border-[#FFE01A]/20 shadow-[0_0_15px_rgba(255,224,26,0.02)] hover:border-[#FFE01A]/45 rounded-2xl p-5 text-left flex flex-col justify-between h-34 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group hover:bg-[#1a1a1a]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#FFE01A]/10 border border-[#FFE01A]/30 flex items-center justify-center text-[#FFE01A]">
                          <Calendar size={20} className="animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-[14px] font-black uppercase tracking-tight text-white group-hover:text-[#FFE01A] transition-colors leading-none">Events</h3>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          </div>
                          <p className="text-[9px] font-mono font-bold text-[#FFE01A] uppercase tracking-wider mt-1.5">{liveEventsCount} happening now</p>
                        </div>
                      </button>

                      {/* Grid Item 2: Walkers (Primary) */}
                      <button 
                        id="btn_tab_profile"
                        onClick={() => onTabChange?.('profile')}
                        className="bg-[#141414] border border-[#FFE01A]/20 shadow-[0_0_15px_rgba(255,224,26,0.02)] hover:border-[#FFE01A]/45 rounded-2xl p-5 text-left flex flex-col justify-between h-34 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group hover:bg-[#1a1a1a]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#FFE01A]/10 border border-[#FFE01A]/30 flex items-center justify-center text-[#FFE01A]">
                          <Users size={20} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-black uppercase tracking-tight text-white group-hover:text-[#FFE01A] transition-colors leading-none">Walkers</h3>
                          <p className="text-[9px] font-mono font-bold text-[#FFE01A] uppercase tracking-wider mt-1.5">12 nearby</p>
                        </div>
                      </button>

                      {/* Grid Item 3: History (Secondary) */}
                      <button 
                        id="btn_tab_wallet"
                        onClick={() => onTabChange?.('wallet')}
                        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-5 text-left flex flex-col justify-between h-34 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group hover:bg-white/[0.08]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
                          <BookOpen size={20} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-black uppercase tracking-tight text-white group-hover:text-white transition-colors leading-none">History</h3>
                          <p className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-wider mt-1.5">OTR stories</p>
                        </div>
                      </button>

                      {/* Grid Item 4: City Map (Secondary) */}
                      <button 
                        id="btn_tab_explore"
                        onClick={() => onTabChange?.('explore')}
                        className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-5 text-left flex flex-col justify-between h-34 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer group hover:bg-white/[0.08]"
                      >
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/60">
                          <MapIcon size={20} />
                        </div>
                        <div>
                          <h3 className="text-[14px] font-black uppercase tracking-tight text-white group-hover:text-white transition-colors leading-none">City map</h3>
                          <p className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-wider mt-1.5">Explore nearby</p>
                        </div>
                      </button>

                    </div>
                  </div>

                  {/* Tap Journey & Vector Dynamics Graphic */}
                  <div>
                    <TapJourneyGraphic />
                  </div>

                  {/* Reward Section */}
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40 block mb-4">
                      Your Reward
                    </span>
                    <div id="reward_banner_card" className="bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between text-white relative overflow-hidden">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-black relative shadow-[0_0_20px_rgba(255,224,26,0.3)] bg-[#FFE01A]">
                          <Star size={22} className="fill-black text-black" />
                        </div>
                        <div>
                          <h4 className="text-[14px] font-black uppercase tracking-tight text-white">First tap here</h4>
                          <p className="text-[9px] font-mono font-bold text-white/40 uppercase tracking-wider mt-1 leading-none">{nodeName.replace('_HUB', '').replace(/_/g, ' ')} badge unlocked</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-mono font-black text-[#FFE01A]">+25</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer Ticker Branding */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-10 mt-6 pb-4">
                    <div className="flex items-center">
                      <span className="text-[10px] font-black text-[#FFE01A] uppercase tracking-widest leading-none">URBAN</span>
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none ml-1">HIKERS</span>
                    </div>
                    <span className="text-[8px] font-mono font-bold text-white/20 uppercase tracking-[0.25em]">TAP. WALK. INSPIRE.</span>
                  </div>

                </div>
              </div>
            ) : activeTab === 'feed' ? (
              <Feed 
                broadcasts={broadcasts}
                currentNode={currentNode}
                onSelect={onSelect}
                onConfirm={onConfirm}
                onShareEvent={onShareEvent}
                partnersMap={partnersMap}
                sponsorsMap={sponsorsMap}
                userProfile={userProfile}
                localHubs={localHubs}
                onRedeemHub={(hub) => hub.cta_url && window.open(hub.cta_url, '_blank')}
                loading={loading}
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
              </div>
            ) : activeTab === 'wallet' ? (
              <div className="px-6 py-8 space-y-6 flex flex-col pointer-events-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Ticket className="text-[#FFE01A]" size={20} />
                  <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#0a0a0a]">Explorer_Passport</h2>
                </div>

                {/* Tactical HUD XP progression chart */}
                <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl relative overflow-hidden shadow-xl text-white space-y-4">
                  <div className="absolute right-4 top-4 opacity-10">
                    <Award size={36} className="text-[#FFE01A]" />
                  </div>
                  <div className="flex justify-between items-baseline">
                    <div>
                      <span className="text-[8px] font-mono font-black tracking-widest text-[#FFE01A] uppercase block">LEVEL_04_STATUS</span>
                      <h3 className="text-lg font-black uppercase italic tracking-tight text-white">Expert Hiker</h3>
                    </div>
                  </div>

                  {/* Passport Stats Grid: XP & Tapped Counter */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-mono text-white/50 block uppercase">TOTAL_EXPERIENCE</span>
                        <span className="text-base font-mono font-black text-[#FFE01A]">{xp} XP</span>
                      </div>
                      <Award size={18} className="text-[#FFE01A]/60" />
                    </div>

                    {/* Tapped Count with subtle Framer Motion pulse animation */}
                    <div className="bg-white/5 border border-white/10 p-3 rounded-xl flex items-center justify-between relative overflow-hidden">
                      <div>
                        <span className="text-[8px] font-mono text-white/50 block uppercase tracking-wider">NODES_TAPPED</span>
                        <motion.div
                          key={`tapped-count-${nodesVisitedCount}`}
                          initial={{ scale: 1 }}
                          animate={{
                            scale: [1, 1.28, 0.95, 1.1, 1],
                            color: ['#10B981', '#FFE01A', '#34D399', '#10B981'],
                          }}
                          transition={{ duration: 0.65, ease: 'easeOut' }}
                          className="text-base font-mono font-black text-emerald-400 flex items-center gap-1"
                        >
                          <span>{nodesVisitedCount} Tapped</span>
                        </motion.div>
                      </div>

                      {/* Expanding pulse ripple effect on tap success */}
                      <motion.div
                        key={`tapped-pulse-ring-${nodesVisitedCount}`}
                        initial={{ scale: 0.5, opacity: 0.9 }}
                        animate={{ scale: [0.5, 2.2], opacity: [0.9, 0] }}
                        transition={{ duration: 0.85, ease: 'easeOut' }}
                        className="absolute right-2 top-2 w-8 h-8 rounded-full bg-emerald-400/30 border border-emerald-400/50 pointer-events-none"
                      />

                      <CheckCircle2 size={18} className="text-emerald-400/80 shrink-0 z-10" />
                    </div>
                  </div>

                  {/* Meter Progress */}
                  <div className="space-y-1.5">
                    <div className="h-2 bg-white/5 border border-white/10 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (xp / 500) * 100)}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-[#FFE01A] to-emerald-400"
                      />
                    </div>
                    <div className="flex justify-between text-[8px] font-mono text-white/40">
                      <span>{xp} XP CURRENT</span>
                      <span>500 XP TARGET</span>
                    </div>
                  </div>
                </div>

                {/* Stamps grid list */}
                <div className="space-y-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[#0a0a0a]">Physical Stamps</span>
                    <motion.span 
                      key={`stamps-tapped-${nodesVisitedCount}`}
                      initial={{ scale: 1 }}
                      animate={{ scale: [1, 1.2, 0.95, 1.08, 1] }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-sm inline-flex items-center gap-1.5"
                    >
                      <motion.span
                        key={`stamp-dot-${nodesVisitedCount}`}
                        animate={{ scale: [1, 1.8, 1] }}
                        transition={{ duration: 0.5 }}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                      />
                      <span>{nodesVisitedCount} Tapped & Collected</span>
                    </motion.span>
                  </div>
                  
                  <div className="bg-white border border-uh-gray-100 rounded-2xl p-5 grid grid-cols-4 gap-4 text-center">
                    {Array.from({ length: Math.min(8, nodesVisitedCount) }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <div className="w-11 h-11 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center text-emerald-600 relative">
                          <CheckCircle2 size={16} />
                          <div className="absolute inset-0 rounded-full bg-emerald-500/5 animate-ping opacity-30" />
                        </div>
                        <span className="text-[8px] font-mono text-uh-gray-500 uppercase leading-none truncate w-full">Stamp_{i+1}</span>
                      </div>
                    ))}
                    {nodesVisitedCount < 8 && Array.from({ length: 8 - nodesVisitedCount }).map((_, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5 opacity-30">
                        <div className="w-11 h-11 rounded-full border-2 border-dashed border-uh-gray-300 flex items-center justify-center text-uh-gray-400">
                          <Lock size={12} />
                        </div>
                        <span className="text-[8px] font-mono text-uh-gray-400 uppercase leading-none">Locked</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badges presentation section */}
                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#0a0a0a]">Special Achievements</span>
                  <div className="grid grid-cols-2 gap-3">
                    {badges.map((b) => (
                      <div key={b} className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl flex items-center gap-3 text-white">
                        <div className="w-9 h-9 rounded-lg bg-[#FFE01A]/10 border border-[#FFE01A]/25 flex items-center justify-center text-[#FFE01A]">
                          <Award size={18} />
                        </div>
                        <div className="truncate">
                          <span className="text-[7px] font-mono text-white/30 uppercase block">UNLOCKED</span>
                          <span className="text-[11px] font-black uppercase tracking-tight">{b}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sponsor Active Refuel Coupons */}
                <div className="space-y-3">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#0a0a0a]">Active Partner Coupons</span>
                  <div className="bg-[#ff2d78]/5 border border-[#ff2d78]/25 p-5 rounded-2xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="bg-[#ff2d78] text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded tracking-widest block w-fit mb-1">STATION_VOUCHER</span>
                        <h4 className="text-[13px] font-bold uppercase tracking-tight text-uh-black">10% Off Deeper Roots Coffee</h4>
                      </div>
                      <span className="text-[12px] font-black text-[#ff2d78]">⚡ ACTIVE</span>
                    </div>
                    <div className="flex justify-between items-center bg-white border border-[#ff2d78]/10 p-3 rounded-lg">
                      <div className="text-left font-mono">
                        <span className="text-[7.5px] text-uh-gray-400 uppercase block">Voucher Code</span>
                        <span className="text-[11px] font-black text-uh-black">UH-DR-REFUEL-99</span>
                      </div>
                      <button 
                        onClick={() => alert("Show Code 'UH-DR-REFUEL-99' at check-out for 10% Discount!")}
                        className="px-3 py-1.5 bg-[#ff2d78] text-white text-[8px] font-black uppercase tracking-widest rounded-lg hover:bg-[#ff2d78]/90 transition-all cursor-pointer"
                      >
                        Redeem
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : activeTab === 'profile' ? (
              <div className="px-6 py-8 space-y-6 flex flex-col pointer-events-auto">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="text-[#FFE01A]" size={20} />
                  <h2 className="text-[14px] font-black uppercase tracking-[0.2em] text-[#0a0a0a]">User_Protocol</h2>
                </div>

                {/* Identity Verification Check */}
                <div className="bg-white border border-uh-gray-100 rounded-3xl p-6 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#FFE01A]/10 border-2 border-[#FFE01A] flex items-center justify-center text-[#FFE01A] mx-auto shadow-[0_0_20px_rgba(255,224,26,0.15)] relative">
                    <ShieldCheck size={32} />
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center text-white">
                      <CheckCircle2 size={12} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[15px] font-black uppercase italic tracking-tight text-uh-black">{user?.displayName || userProfile?.name || 'Urban Explorer'}</h3>
                    <p className="text-[9px] font-mono text-uh-gray-400 mt-1 uppercase tracking-wider">{user?.email || 'anonymous@localpulses.com'}</p>
                  </div>

                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-600 font-mono text-[8px] font-bold uppercase tracking-widest">
                    <span>STATUS: SECURE IDENTITY</span>
                  </div>
                </div>

                {/* Social connections sync counter (Reductions of Isolation!) */}
                <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl relative overflow-hidden shadow-xl text-white">
                  <div className="absolute right-4 top-4 opacity-10">
                    <Heart size={36} className="text-[#ff2d78]" />
                  </div>
                  <span className="text-[8px] font-mono font-black tracking-[0.2em] text-[#ff2d78] uppercase block mb-1">INTERPERSONAL_NETWORKING</span>
                  <div className="flex justify-between items-center text-left">
                    <div>
                      <h3 className="text-[13px] font-bold uppercase tracking-tight text-white mb-1">Connections Tracked</h3>
                      <p className="text-white/40 text-[9px] font-mono uppercase leading-tight max-w-[200px]">
                        Proven physical encounters at Urban Hikers nodes
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-3xl font-black text-[#ff2d78]">{connectionsCount}</span>
                      <span className="text-[8px] font-mono text-white/30 block">SYNCS</span>
                    </div>
                  </div>
                </div>

                {/* Technical diagnostics meta-data details */}
                <div className="bg-white border border-uh-gray-100 rounded-2xl p-5 space-y-3.5 text-left font-mono text-[9px] text-uh-gray-500">
                  <h4 className="text-[10px] font-black uppercase text-[#0a0a0a] font-sans tracking-widest mb-2 border-b border-uh-gray-50 pb-2">Diagnostic Protocol Metadata</h4>
                  <div className="flex justify-between">
                    <span>CLIENT_VERSION:</span>
                    <span className="font-bold text-[#0a0a0a]">0.9.1 // URBAN_HIKER_OS</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SECURITY_TOKEN:</span>
                    <span className="font-bold text-[#0a0a0a]">SEC_TLS_ACTIVE</span>
                  </div>
                  <div className="flex justify-between">
                    <span>ACTIVE_VECTOR:</span>
                    <span className="font-bold text-[#0a0a0a] uppercase">{accessVector}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PRIMARY_REGIONAL_HUB:</span>
                    <span className="font-bold text-[#0a0a0a]">{nodeName || 'CIN_OTR'}</span>
                  </div>
                </div>

                {/* Sign-Out button */}
                <button 
                  onClick={onLogin} 
                  className="w-full py-4 bg-uh-gray-50 border border-uh-gray-200 hover:bg-uh-gray-100 text-uh-black rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={14} />
                  Close Identity Session
                </button>
              </div>
            ) : null}
            {/* ... other tabs would go here, omitting for brevity of change but keeping key structure */}
          </div>

          {/* Stats Bar (Technical & Minimal) */}
          <div className="px-6 py-10 border-t border-uh-gray-100 bg-white/50 backdrop-blur-sm">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-1">Nodes</span>
                <span className="text-xl font-black text-uh-black tracking-tight">{activeNodesCount}</span>
              </div>
              <div className="flex flex-col text-center">
                <span className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-1">Radius</span>
                <span className="text-xl font-black text-uh-black tracking-tight">{radiusInMiles}mi</span>
              </div>
              <div className="flex flex-col text-center">
                <span className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-1">Stations</span>
                <span className="text-xl font-black" style={{ color: '#FFE01A' }}>
                  {localHubs.filter(h => h.tier !== 'free').length.toString().padStart(2, '0')}
                </span>
              </div>
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest font-mono mb-1">Uptime</span>
                <span className="text-xl font-black text-uh-teal tracking-tight">{uptime}%</span>
              </div>
            </div>
            <div className="mt-8 text-center">
              <span className="text-[9px] font-bold text-uh-gray-300 uppercase tracking-[0.3em] font-mono">&copy; Urban Hikers // Protocol_0.9.1</span>
            </div>
          </div>
        </div>
      </div>

    {/* Bottom Navigation — Dark version */}
    <div className="fixed bottom-0 inset-x-0 z-[110] flex flex-col pointer-events-none">
      <div className="bg-[#0a0a0a] px-8 py-6 flex justify-between items-center border-t border-white/5 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          const content = (
            <div className="flex flex-col items-center gap-1 group relative">
              <Icon size={24} strokeWidth={isActive ? 3 : 2} className={`${isActive ? 'text-uh-yellow shadow-[0_0_15px_rgba(255,224,26,0.3)]' : 'text-white/30 group-hover:text-white'} transition-all duration-150 ease-out`} />
              {isActive && (
                <motion.div 
                  layoutId="nav-dot"
                  className="absolute -bottom-3 w-1.5 h-1.5 bg-uh-yellow rounded-full shadow-[0_0_8px_rgba(255,224,26,0.8)]"
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                />
              )}
            </div>
          );

          if (item.href) {
            return (
              <a key={item.id} href={item.href} className="px-4">
                {content}
              </a>
            );
          }

          return (
            <button 
              key={item.id}
              onClick={() => onTabChange?.(item.id as any)}
              className="px-4 outline-none"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>


      <AnimatePresence>
        {showBroadcastForm && (
          <div className="fixed inset-0 z-[300] bg-white overflow-y-auto no-scrollbar">
            <div className="sticky top-0 z-50 bg-white border-b border-uh-gray-100 p-4 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] font-mono">Channel_Override</span>
              <button 
                onClick={() => setShowBroadcastForm(false)}
                className="p-2 rounded-full hover:bg-uh-gray-50"
              >
                <Plus size={20} className="rotate-45 text-uh-black" />
              </button>
            </div>
            <div className="pb-20">
              <BroadcastControlForm 
                formData={formState}
                setFormData={setFormState as any}
                userProfile={userProfile}
                nodes={nodes}
                isAdmin={userProfile?.role === 'admin' || userProfile?.role === 'super_admin'}
                setError={(err) => console.error(err)}
                setSubmitting={() => {}}
                setSuccess={(suc) => {
                  if (suc) setShowBroadcastForm(false);
                }}
              />
            </div>
          </div>
        )}

        {(userProfile?.role === 'admin' || userProfile?.role === 'partner' || userProfile?.role === 'hiker') && !showBroadcastForm && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBroadcastForm(true)}
            className="fixed bottom-24 right-6 w-14 h-14 bg-uh-yellow text-uh-black rounded-full flex items-center justify-center shadow-2xl z-50 border-4 border-white pointer-events-auto"
          >
            <Plus size={24} strokeWidth={3} />
          </motion.button>
        )}

        {tapConfirmAction && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-10 bg-black/80 backdrop-blur-md pointer-events-auto"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-[320px] bg-[#0a0a0a] border border-white/10 p-10 text-center"
            >
              <div className="text-[10px] font-bold tracking-[0.2em] mb-4 text-[#444] uppercase">Action_Required</div>
              <h3 className="text-[14px] font-bold tracking-tight mb-4 text-white uppercase italic">
                {tapConfirmAction === 'in' ? 'Initialize session?' : 'Terminate session?'}
              </h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={tapConfirmAction === 'in' ? handleTapIn : handleTapOut}
                  className={`w-full py-4 text-[10px] font-bold tracking-widest uppercase transition-all ${
                    tapConfirmAction === 'in' ? 'bg-uh-yellow text-uh-black' : 'bg-uh-magenta text-white'
                  }`}
                >
                  {tapConfirmAction === 'in' ? 'Execute_In' : 'Execute_Out'}
                </button>
                <button
                  onClick={() => setTapConfirmAction(null)}
                  className="w-full py-3 text-[9px] font-bold text-[#444] uppercase tracking-widest hover:text-white transition-colors"
                >
                  Abort_Protocol
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
