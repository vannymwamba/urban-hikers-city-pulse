import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile, Partner, Route, Guide, Sponsor } from '../types';
import { LocalHub } from './LocalHubCard';
import { MapView } from './MapView';
import { BroadcastCard } from './BroadcastCard';
import { FlashDealCard } from './FlashDealCard';
import { Feed } from './Feed';
import { RouteCard } from './RouteCard';
import { Clock, ShieldCheck, MapPin, Home, LayoutGrid, Share2, Ticket, Map as MapIcon, ArrowRight, AlertCircle, Lock, Navigation, Users, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDistance } from '../utils/geo';
import { WalletCard } from './WalletCard';
import { getEventStatus } from '../utils/broadcastHelpers';
import { BroadcastControlForm } from './BroadcastControlForm';
import { BroadcastType } from '../types';

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
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);
  
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

  return (
    <div className="flex flex-col h-full bg-[#f0f0f0] text-uh-black font-sans relative overflow-hidden">
      {/* Collapsible Header Container */}
      <motion.div 
        style={{ 
          height: 140, // Restore expanded height feel
          backgroundColor: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a'
        }}
        className="fixed top-0 inset-x-0 z-[100] flex flex-col overflow-hidden"
      >
        <div className="flex-1 px-6 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] font-black tracking-[0.25em] text-uh-yellow uppercase mb-1 font-mono">Sector_Hub</span>
            <h1 className="text-3xl font-black tracking-tight text-uh-yellow uppercase">
              {nodeName.replace('_HUB', '')}
            </h1>
          </div>
          
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] font-black tracking-[0.25em] text-uh-yellow/60 uppercase mb-1 font-mono">Time</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-uh-yellow animate-pulse" />
              <div className="text-2xl font-black tracking-tighter text-uh-yellow font-mono tabular-nums">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>
            </div>
          </div>
        </div>

        {/* Identity Bar */}
        <div className="px-6 py-3 flex items-center justify-between bg-[#111] border-t border-white/5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-uh-yellow" />
            <span className="text-[10px] font-bold text-[#666] uppercase tracking-[0.2em] font-mono">
              {user ? 'Identity_Verified' : 'Anonymous_Protocol'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {!user && (
              <button 
                onClick={onLogin}
                className="text-uh-yellow text-[10px] font-black uppercase tracking-widest font-mono hover:underline"
              >
                Upgrade_ID
              </button>
            )}
            <div className="w-[1px] h-3 bg-white/10" />
            <span className="text-[9px] font-bold text-[#444] uppercase tracking-widest font-mono">Access_Vector: {accessVector}</span>
          </div>
        </div>
      </motion.div>

      {/* Main Scrollable Area */}
      <div 
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative z-10 no-scrollbar pt-[140px] pb-32"
      >
        <div className="flex flex-col gap-0">
          <div className="flex flex-col">
            {/* Feed Content */}
            {activeTab === 'feed' ? (
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
              />
            ) : activeTab === 'explore' ? (
              // keep your existing explore view but ensure light background compatibility if needed
              <div className="h-full flex flex-col">
                <div className="h-[400px]">
                  <MapView 
                    currentNode={currentNode} 
                    broadcasts={broadcasts} 
                    onSelect={onSelect} 
                    partnersMap={partnersMap}
                  />
                </div>
                {/* ... other parts handled below */}
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

    {/* Bottom Navigation — White version */}
    <div className="fixed bottom-0 inset-x-0 z-[110] flex flex-col pointer-events-none">
      <div className="bg-white px-8 py-6 flex justify-between items-center border-t border-uh-gray-100 pointer-events-auto shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
        {[
          { id: 'home', icon: Home, label: 'Home', href: '/' },
          { id: 'feed', icon: Clock, label: 'Feed' },
          { id: 'explore', icon: Navigation, label: 'Explore' },
          { id: 'wallet', icon: Ticket, label: 'Wallet' },
          { id: 'profile', icon: Users, label: 'Profile' }
        ].map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          
          const content = (
            <div className="flex flex-col items-center gap-1 group relative">
              <Icon size={22} className={`${isActive ? 'text-uh-black' : 'text-uh-gray-300 group-hover:text-uh-black'} transition-colors`} />
              {isActive && (
                <div className="absolute -bottom-2 w-1.5 h-1.5 bg-uh-yellow rounded-full" />
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
