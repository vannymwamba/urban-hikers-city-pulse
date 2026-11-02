import React, { useState, useEffect } from 'react';
import { Broadcast, Node, UserProfile, Partner, Route, Guide, Sponsor, LocalHub } from '../types';
import { MapView } from './MapView';
import { BroadcastCard } from './BroadcastCard';
import { FlashDealCard } from './FlashDealCard';
import { Feed } from './Feed';
import { RouteCard } from './RouteCard';
import { Clock, ShieldCheck, MapPin, Home, LayoutGrid, Share2, Ticket, Map as MapIcon, ArrowRight, AlertCircle, Lock, Navigation, Users, User, Plus, Award, Heart, LogOut, Sparkles, CheckCircle2, Calendar, BookOpen, Star, Wifi, Key, ChevronRight, X, Radio, Coffee, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getDistance } from '../utils/geo';
import { WalletCard } from './WalletCard';
import { getEventStatus } from '../utils/broadcastHelpers';
import { BroadcastControlForm } from './BroadcastControlForm';
import { BroadcastType, DisplaySponsor } from '../types';
import { PulseDropStrip } from './PulseDropStrip';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { QuickReportSheet } from './QuickReportSheet';
import { SponsorSlot } from './SponsorSlot';
import { LinkEmailModal } from './LinkEmailModal';
import { ProfileTab } from './ProfileTab';

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
  onOpenConsent?: () => void;
  onProfileUpdate?: (profile: UserProfile) => void;
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
  onOpenConsent,
  onProfileUpdate,
}) => {
  const navItems: Array<{ id: string; icon: any; label: string; href?: string }> = [
    { id: 'home', icon: Home, label: 'Here' },
    { id: 'feed', icon: Clock, label: 'Pulse' },
    { id: 'explore', icon: Navigation, label: 'Next stop' },
    { id: 'wallet', icon: Ticket, label: 'Passport' },
    { id: 'profile', icon: User, label: 'Profile' }
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
  const [showLogin, setShowLogin] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showBroadcastForm, setShowBroadcastForm] = useState(false);

  // Dynamic Hooks: only show rotating quotes if node has its own custom hooks (no default quotes)
  const hooks: Array<{ id: string; text: string }> = (currentNode as any)?.hooks || [];

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


  const [openReportsCount, setOpenReportsCount] = useState<number>(0);
  const [isQuickReportOpen, setIsQuickReportOpen] = useState<boolean>(false);
  const [showStorySheet, setShowStorySheet] = useState<boolean>(false);
  const [isLinkEmailModalOpen, setIsLinkEmailModalOpen] = useState<boolean>(false);
  const [visitorEmail, setVisitorEmail] = useState<string | null>(null);
  const [hubsTappedCount, setHubsTappedCount] = useState<number>(() => {
    return Number(localStorage.getItem('uh_passport_nodes_count') || '1');
  });

  // Query visitor_profiles for logged-in user, otherwise fallback to uh_passport_nodes_count
  useEffect(() => {
    if (user?.uid) {
      getDoc(doc(db, 'visitor_profiles', user.uid))
        .then((snap) => {
          if (snap.exists()) {
            const data = snap.data();
            const count = data.locations_visited_ids?.length || data.journey_stops?.length || 0;
            if (count > 0) {
              setHubsTappedCount(count);
            }
            if (data.email) {
              setVisitorEmail(data.email);
            }
          }
        })
        .catch(() => {});
    } else {
      setHubsTappedCount(Number(localStorage.getItem('uh_passport_nodes_count') || '1'));
    }
  }, [user?.uid]);

  // Query open lost & found reports for this node
  useEffect(() => {
    if (!currentNode?.id) return;
    getDocs(query(collection(db, 'lost_found'), where('node_id', '==', currentNode.id), where('status', '==', 'open')))
      .then((snap) => setOpenReportsCount(snap.size))
      .catch(() => setOpenReportsCount(0));
  }, [currentNode?.id]);

  // Helper for parsing any timestamp
  const parseSafeDate = (val: any): Date | null => {
    if (!val) return null;
    if (typeof val.toDate === 'function') return val.toDate();
    if (val instanceof Date) return val;
    if (typeof val === 'number') return new Date(val);
    if (typeof val === 'string') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  };

  interface LiveItem {
    id: string;
    title: string;
    venueOrAddress: string;
    startsAt: Date;
    expiresAt: Date;
    isStarted: boolean;
    timeLabel: string;
    typeChip: 'WALK' | 'DEAL' | 'LIBRARY' | 'FOOD' | 'EVENT';
    isFree: boolean;
    distanceMeters: number;
    walkMinutes: number;
    originalBroadcast: Broadcast;
  }

  // HAPPENING NOW: live events derived purely from loaded broadcasts (no Firestore 'events' queries)
  const { liveItems, liveSectionTitle } = React.useMemo(() => {
    if (!currentNode || typeof currentNode.latitude !== 'number' || typeof currentNode.longitude !== 'number') {
      return { liveItems: [] as LiveItem[], liveSectionTitle: 'Happening now' };
    }

    const now = new Date();
    const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const allowedTypes = new Set([
      'walking_event',
      'flash_deal',
      'live_event',
      'pop_up',
      'civic_event',
      'civic_free',
      'event',
      'live_performance',
      'conference_panel',
      'food_truck'
    ]);

    const candidates: Array<{ item: LiveItem; dist: number }> = [];

    (broadcasts || []).forEach((b) => {
      const rawType = (b.type || '').toString().toLowerCase();
      const isSponsored = b.is_sponsored === true;

      // 1. Allowed type or is_sponsored === true
      if (!allowedTypes.has(rawType) && !isSponsored) {
        return;
      }

      // 2. Type is NOT mural, civic_mural or street_art, and NO artist_id / artist_slug
      if (rawType === 'mural' || rawType === 'civic_mural' || rawType === 'street_art') {
        return;
      }
      const hasArtist = Boolean(
        (b as any).artist_id ||
        (b as any).artistId ||
        (b as any).artist_slug ||
        (b as any).artistSlug
      );
      if (hasArtist) {
        return;
      }

      // 3. Live: starts_at <= now + 2 hours AND expires_at > now
      const startsAt = parseSafeDate(b.starts_at || (b as any).startsAt || (b as any).startTime);
      if (!startsAt) return;
      const expiresAt = parseSafeDate(b.expires_at || (b as any).expiresAt) || new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
      if (!expiresAt) return;

      if (startsAt.getTime() > twoHoursFromNow.getTime() || expiresAt.getTime() <= now.getTime()) {
        return;
      }

      // 4. Distance within coordinates
      const lat = b.latitude ?? b.coords?.lat;
      const lng = b.longitude ?? b.coords?.lng;
      if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
        return;
      }

      const dist = getDistance(currentNode.latitude, currentNode.longitude, lat, lng);
      const isStarted = startsAt.getTime() <= now.getTime();
      const walkMinutes = Math.max(1, Math.round((dist * 1.3) / 80));

      // Library check: treat source 'cincinnati_library', 'chpl' or 'library' as LIBRARY
      const src = ((b.source || (b as any).signal_location_source || '') as string).toLowerCase();
      const isLibrary = src === 'cincinnati_library' || src === 'chpl' || src === 'library';

      let typeChip: 'WALK' | 'DEAL' | 'LIBRARY' | 'FOOD' | 'EVENT' = 'EVENT';
      if (isLibrary) {
        typeChip = 'LIBRARY';
      } else if (rawType === 'walking_event') {
        typeChip = 'WALK';
      } else if (rawType === 'flash_deal' || isSponsored) {
        typeChip = 'DEAL';
      } else if (rawType === 'food_truck') {
        typeChip = 'FOOD';
      } else {
        typeChip = 'EVENT';
      }

      const timeLabel = isStarted
        ? 'NOW'
        : startsAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

      const venueOrAddress = b.venue || b.address || b.partner_name || 'Nearby';
      const isFree = b.payment_type === 'free';

      candidates.push({
        item: {
          id: b.id,
          title: b.title,
          venueOrAddress,
          startsAt,
          expiresAt,
          isStarted,
          timeLabel,
          typeChip,
          isFree,
          distanceMeters: dist,
          walkMinutes,
          originalBroadcast: b
        },
        dist
      });
    });

    // Distance threshold: within 805 m of node. If leaves 0 items, use 1609 m and "Within a 20-min walk".
    const within805 = candidates.filter((c) => c.dist <= 805);
    let finalCandidates: Array<{ item: LiveItem; dist: number }>;
    let heading = 'Happening now';

    if (within805.length > 0) {
      finalCandidates = within805;
      heading = 'Happening now';
    } else {
      const within1609 = candidates.filter((c) => c.dist <= 1609);
      finalCandidates = within1609;
      heading = within1609.length > 0 ? 'Within a 20-min walk' : 'Happening now';
    }

    // Sort: started items first, then by distance
    finalCandidates.sort((a, b) => {
      if (a.item.isStarted !== b.item.isStarted) {
        return a.item.isStarted ? -1 : 1;
      }
      return a.dist - b.dist;
    });

    return {
      liveItems: finalCandidates.map((c) => c.item),
      liveSectionTitle: heading
    };
  }, [currentNode?.latitude, currentNode?.longitude, broadcasts]);
  
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

  const accentColor = currentNode?.partner_accent || '#FFE01A';

  interface CoffeeStop {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    imageUrl?: string;
    reward?: string;
    isOpen: boolean;
    statusKnown: boolean;
    distanceMeters: number;
    walkMinutes: number;
    distMi: string;
  }

  // YOUR NEXT STOP: nearest coffee shop within walking distance (50m - 1200m)
  const nearestCoffeeSpot = React.useMemo<CoffeeStop | null>(() => {
    if (!currentNode || typeof currentNode.latitude !== 'number' || typeof currentNode.longitude !== 'number') {
      return null;
    }

    // 1. Gather raw candidates from refuel nodes and localHubs
    const refuelNodes = (nodes || []).filter(
      (n) => n.id !== currentNode.id && n.partner_type === 'refuel'
    );

    type RawCandidate = {
      id: string;
      name: string;
      latitude?: number;
      longitude?: number;
      imageUrl?: string;
      reward?: string;
      is_open?: boolean;
      operating_hours?: any;
      rawType?: string;
    };

    const rawList: RawCandidate[] = [];

    refuelNodes.forEach((n) => {
      rawList.push({
        id: n.id,
        name: n.name.replace(/_HUB/g, '').replace(/_/g, ' '),
        latitude: n.latitude,
        longitude: n.longitude,
        imageUrl: n.cover_image_url || n.logo_url || n.imageUrl,
        reward: n.custom_reward,
        is_open: (n as any).is_open,
        operating_hours: (n as any).operating_hours,
        rawType: `${n.type || ''} ${n.partner_type || ''}`
      });
    });

    (localHubs || []).forEach((h) => {
      rawList.push({
        id: h.id,
        name: h.name,
        latitude: h.latitude,
        longitude: h.longitude,
        imageUrl: h.cover_url,
        reward: h.offer,
        is_open: h.is_open,
        operating_hours: h.operating_hours,
        rawType: (h as any).tier || ''
      });
    });

    // 2. Merge and de-duplicate by name
    const seenNames = new Set<string>();
    const filteredCandidates: CoffeeStop[] = [];

    for (const item of rawList) {
      if (!item.name) continue;
      const normName = item.name.trim().toLowerCase();
      if (seenNames.has(normName)) continue;
      seenNames.add(normName);

      // Must have valid latitude and longitude
      if (typeof item.latitude !== 'number' || typeof item.longitude !== 'number' || isNaN(item.latitude) || isNaN(item.longitude)) {
        continue;
      }

      // Exclude current node
      if (item.id === currentNode.id) continue;

      // Never show BLINK or event nodes (exclude names/types containing 'blink' or 'event')
      const textToCheck = `${item.name} ${item.rawType || ''}`.toLowerCase();
      if (textToCheck.includes('blink') || textToCheck.includes('event')) {
        continue;
      }

      // Distance > 50 m and <= 1200 m
      const dist = getDistance(currentNode.latitude, currentNode.longitude, item.latitude, item.longitude);
      if (dist <= 50 || dist > 1200) {
        continue;
      }

      // Open now & status evaluation
      let isOpen = false;
      let statusKnown = false;

      if (typeof item.is_open === 'boolean') {
        isOpen = item.is_open;
        statusKnown = true;
      } else if (item.operating_hours && typeof item.operating_hours === 'object') {
        const now = new Date();
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const shortDays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayIdx = now.getDay();
        const todayHours = item.operating_hours[days[dayIdx]] || item.operating_hours[shortDays[dayIdx]];
        if (todayHours) {
          if (todayHours.open && todayHours.close) {
            const [openH, openM] = todayHours.open.split(':').map(Number);
            const [closeH, closeM] = todayHours.close.split(':').map(Number);
            const nowMins = now.getHours() * 60 + now.getMinutes();
            const openMins = openH * 60 + (openM || 0);
            const closeMins = closeH * 60 + (closeM || 0);
            isOpen = nowMins >= openMins && nowMins < closeMins;
            statusKnown = true;
          }
        }
      }

      const walkMinutes = Math.max(1, Math.round((dist * 1.3) / 80));
      const distMi = (dist / 1609.34).toFixed(1);

      filteredCandidates.push({
        id: item.id,
        name: item.name,
        latitude: item.latitude,
        longitude: item.longitude,
        imageUrl: item.imageUrl,
        reward: item.reward,
        isOpen,
        statusKnown,
        distanceMeters: dist,
        walkMinutes,
        distMi
      });
    }

    if (filteredCandidates.length === 0) {
      return null;
    }

    // Prefer places open now (is_open true or operating hours for today), then sort by distance
    filteredCandidates.sort((a, b) => {
      const aOpenWeight = a.isOpen ? 1 : 0;
      const bOpenWeight = b.isOpen ? 1 : 0;
      if (aOpenWeight !== bOpenWeight) {
        return bOpenWeight - aOpenWeight;
      }
      return a.distanceMeters - b.distanceMeters;
    });

    return filteredCandidates[0];
  }, [currentNode, nodes, localHubs]);

  // Node sponsor
  const nodeSponsor: DisplaySponsor = React.useMemo(() => {
    if ((currentNode as any)?.nodeSponsor) return (currentNode as any).nodeSponsor;
    if (currentNode?.sponsor_name || currentNode?.sponsor_logo_url) {
      return {
        name: currentNode.sponsor_name || currentNode.partner_name || 'Sponsor',
        logoUrl: currentNode.sponsor_logo_url || '',
        link: (currentNode as any)?.booking_url || (currentNode as any)?.cta_url || '#'
      };
    }
    return null;
  }, [currentNode]);

  return (
    <div className={`flex flex-col h-full ${activeTab === 'home' || activeTab === 'feed' || activeTab === 'profile' ? 'bg-[#0B0B0D]' : 'bg-[#f0f0f0]'} text-uh-black font-sans relative overflow-hidden`}>
      {/* Collapsible Header Container — New Co-branded Structure */}
      {activeTab !== 'home' && activeTab !== 'feed' && activeTab !== 'profile' && (
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
        className={`flex-1 overflow-y-auto relative z-10 ${activeTab === 'home' || activeTab === 'feed' || activeTab === 'profile' ? 'pt-0 pb-20' : 'pt-[200px] pb-32'} scroll-smooth`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-col gap-0">
          <div className="flex flex-col">
            {/* Home Node-Specific Landing Page */}
            {activeTab === 'home' ? (
              <div id="home_tab_landing" className="flex flex-col bg-[#0B0B0D] text-white">
                {/* 1. HERO (about 320px) */}
                <div 
                  id="home_hero"
                  className="relative w-full min-h-[320px] flex flex-col justify-between p-6 overflow-hidden bg-[#0B0B0D]"
                >
                  {/* Cover Image with dark bottom gradient fade */}
                  {currentNode?.cover_image_url ? (
                    <>
                      <img 
                        src={currentNode.cover_image_url} 
                        alt={currentNode.name}
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/55 to-black/40 pointer-events-none" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#161618] to-black pointer-events-none" />
                  )}

                  {/* Top Bar: Live dot + LOCAL PULSE on left, share button on right */}
                  <div className="relative z-10 flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
                      <span className="text-xs font-black tracking-widest text-white uppercase">
                        LOCAL PULSE
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={onShareNode}
                      aria-label="Share hub"
                      className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 border border-white/10 flex items-center justify-center text-white min-h-[44px] min-w-[44px] transition-all cursor-pointer"
                    >
                      <Share2 size={18} />
                    </button>
                  </div>

                  {/* Bottom Text in Hero */}
                  <div className="relative z-10 flex flex-col pb-4">
                    <span 
                      className="text-[11px] font-black tracking-wider uppercase mb-1"
                      style={{ color: accentColor }}
                    >
                      {currentNode?.neighborhood 
                        ? `URBAN HIKERS HUB · ${currentNode.neighborhood.toUpperCase()}` 
                        : 'URBAN HIKERS HUB'}
                    </span>
                    <h1 className="text-[42px] font-bold text-white leading-[1.05] tracking-tight">
                      {currentNode?.name 
                        ? currentNode.name.replace(/_HUB/g, '').replace(/_/g, ' ') 
                        : nodeName.replace(/_HUB/g, '').replace(/_/g, ' ')}
                    </h1>
                    {currentNode?.address && (
                      <p className="text-sm text-[#A3A3AA] mt-1.5 font-medium">
                        {currentNode.address}
                      </p>
                    )}

                    {/* Rotating quote only if node has its own hooks */}
                    {hooks.length > 0 && (
                      <div className="mt-3 min-h-[28px] flex items-center">
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={activeHook}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="italic border-l-2 pl-3 text-xs font-semibold text-white/90"
                            style={{ borderColor: accentColor }}
                          >
                            "{hooks[activeHook]?.text}"
                          </motion.p>
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. REWARD CARD, overlapping the bottom of the hero, filled with accent color, black text */}
                <div className="px-4 -mt-4 relative z-20">
                  <div 
                    style={{ backgroundColor: accentColor }}
                    className="rounded-[20px] p-5 shadow-xl text-black flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-black flex items-center justify-center shrink-0 shadow-md">
                          <Star size={22} className="fill-current" style={{ color: accentColor }} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-bold text-black leading-tight">
                            {tapCount <= 1 ? 'First tap here' : 'Welcome back'}
                          </h3>
                          <p className="text-xs font-semibold text-black/80 mt-0.5 truncate">
                            {tapCount <= 1
                              ? `${(currentNode?.name || nodeName).replace(/_HUB/g, '').replace(/_/g, ' ')} badge unlocked`
                              : `Tap #${tapCount} here`}
                          </p>
                        </div>
                      </div>

                      {tapCount <= 1 && (
                        <div className="text-right shrink-0">
                          <span className="text-3xl font-extrabold font-mono text-black leading-none block">
                            +25
                          </span>
                          <span className="text-[9px] font-bold tracking-widest text-black/70 uppercase block mt-0.5">
                            PULSE
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Thin progress bar underneath */}
                    <div className="mt-4 pt-3 border-t border-black/10">
                      <div className="flex justify-between items-center text-xs font-bold text-black mb-1.5">
                        <span className="truncate">{currentNode?.neighborhood || 'OTR Explorer'}</span>
                        <span>{hubsTappedCount} hubs tapped</span>
                      </div>
                      <div className="h-2 w-full bg-black/20 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-black rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(8, (hubsTappedCount / (nodes.length || 12)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. HAPPENING NOW, with green LIVE dot */}
                <div className="px-4 mt-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[20px] font-bold text-white">
                        {liveSectionTitle}
                      </h3>
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#4ADE80] uppercase tracking-wider">
                        <span className="w-2 h-2 rounded-full bg-[#4ADE80] animate-pulse" />
                        LIVE
                      </span>
                    </div>
                    {liveItems.length > 0 && (
                      <button 
                        type="button"
                        onClick={() => onTabChange?.('feed')}
                        className="text-xs font-bold hover:underline cursor-pointer min-h-[44px] flex items-center"
                        style={{ color: accentColor }}
                      >
                        See all {liveItems.length}
                      </button>
                    )}
                  </div>

                  {liveItems.length === 0 ? (
                    <div className="bg-[#161618] border border-[#26262A] rounded-[20px] p-6 text-center">
                      <p className="text-sm font-medium text-[#A3A3AA] mb-2">
                        Nothing live nearby right now
                      </p>
                      <button
                        type="button"
                        onClick={() => onTabChange?.('feed')}
                        className="text-xs font-bold hover:underline cursor-pointer min-h-[44px] inline-flex items-center gap-1"
                        style={{ color: accentColor }}
                      >
                        <span>See what's on later</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {liveItems.slice(0, 3).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelect(item.originalBroadcast)}
                          className="w-full bg-[#161618] hover:bg-[#1f1f22] border border-[#26262A] rounded-[20px] p-4 flex items-center justify-between text-left transition-all min-h-[64px] cursor-pointer group"
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            {/* Time chip: NOW if started, otherwise start time */}
                            <div className="bg-[#0B0B0D] border border-[#26262A] rounded-xl px-2.5 py-2 flex flex-col items-center justify-center min-w-[58px] shrink-0">
                              <span className="text-[11px] font-bold text-[#FFE01A] font-mono leading-none tracking-tight">
                                {item.timeLabel}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                {/* Small type chip: WALK, DEAL, LIBRARY, FOOD, or EVENT */}
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-white/10 text-white tracking-wide uppercase">
                                  {item.typeChip}
                                </span>
                                {/* FREE label when payment_type === 'free' */}
                                {item.isFree && (
                                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-[#4ADE80]/20 text-[#4ADE80] tracking-wide uppercase">
                                    FREE
                                  </span>
                                )}
                              </div>
                              <h4 className="text-[14px] font-bold text-white truncate leading-snug group-hover:text-[#FFE01A] transition-colors">
                                {item.title}
                              </h4>
                              <p className="text-[11px] text-[#A3A3AA] truncate mt-0.5">
                                {item.venueOrAddress} · {item.walkMinutes} min walk
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-[#A3A3AA] shrink-0 ml-2 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 4. YOUR NEXT STOP CARD */}
                {nearestCoffeeSpot && (
                  <div className="px-4 mt-6">
                    <div className="bg-[#161618] border border-[#26262A] rounded-[20px] p-5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span 
                          className="text-[10px] font-black uppercase tracking-[0.2em]"
                          style={{ color: accentColor }}
                        >
                          YOUR NEXT STOP
                        </span>
                        {nearestCoffeeSpot.statusKnown && (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${nearestCoffeeSpot.isOpen ? 'text-[#4ADE80]' : 'text-[#A3A3AA]'}`}>
                            {nearestCoffeeSpot.isOpen && <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80]" />}
                            {nearestCoffeeSpot.isOpen ? 'Open now' : 'Closed'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-xl bg-[#0B0B0D] border border-[#26262A] flex items-center justify-center shrink-0 overflow-hidden">
                          {nearestCoffeeSpot.imageUrl ? (
                            <img 
                              src={nearestCoffeeSpot.imageUrl} 
                              alt={nearestCoffeeSpot.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Coffee size={24} style={{ color: accentColor }} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-lg font-bold text-white truncate">
                            {nearestCoffeeSpot.name}
                          </h3>
                          <p className="text-xs text-[#A3A3AA] mt-0.5 truncate">
                            {nearestCoffeeSpot.walkMinutes} min walk · {nearestCoffeeSpot.distMi} mi
                          </p>
                        </div>
                      </div>

                      {nearestCoffeeSpot.reward && (
                        <p className="text-xs text-[#FFE01A] font-medium leading-relaxed bg-[#FFE01A]/10 border border-[#FFE01A]/20 rounded-xl px-3 py-2">
                          {nearestCoffeeSpot.reward}
                        </p>
                      )}

                      <div className="space-y-2 pt-1">
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&destination=${nearestCoffeeSpot.latitude},${nearestCoffeeSpot.longitude}&travelmode=walking`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ backgroundColor: accentColor }}
                          className="w-full min-h-[48px] rounded-xl text-black font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-all shadow-md cursor-pointer"
                        >
                          <span>Start walking</span>
                          <ArrowRight size={16} />
                        </a>

                        <div className="text-center pt-1">
                          <button
                            type="button"
                            onClick={() => onTabChange?.('feed')}
                            className="text-xs font-bold text-[#A3A3AA] hover:text-white transition-colors cursor-pointer min-h-[44px] inline-flex items-center gap-1"
                          >
                            <span>More coffee nearby</span>
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. EXPLORE FROM HERE (2x2 grid) */}
                <div className="px-4 mt-6">
                  <h3 className="text-[20px] font-bold text-white mb-3">
                    Explore from here
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Tile 1: History */}
                    <button
                      type="button"
                      onClick={() => setShowStorySheet(true)}
                      className="bg-[#161618] hover:bg-[#1f1f22] border border-[#26262A] rounded-[20px] p-4 text-left flex flex-col justify-between min-h-[110px] transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:border-[#FFE01A]/40 transition-colors">
                        <BookOpen size={20} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-white leading-tight">History</h4>
                        <p className="text-xs text-[#A3A3AA] mt-1 leading-snug truncate">
                          {currentNode?.neighborhood ? `${currentNode.neighborhood} stories` : 'Local stories'}
                        </p>
                      </div>
                    </button>

                    {/* Tile 2: City map */}
                    <button
                      type="button"
                      onClick={() => onTabChange?.('explore')}
                      className="bg-[#161618] hover:bg-[#1f1f22] border border-[#26262A] rounded-[20px] p-4 text-left flex flex-col justify-between min-h-[110px] transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:border-[#FFE01A]/40 transition-colors">
                        <MapIcon size={20} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-white leading-tight">City map</h4>
                        <p className="text-xs text-[#A3A3AA] mt-1 leading-snug">Hubs nearby</p>
                      </div>
                    </button>

                    {/* Tile 3: Walk together */}
                    <button
                      type="button"
                      onClick={() => onTabChange?.('wallet')}
                      className="bg-[#161618] hover:bg-[#1f1f22] border border-[#26262A] rounded-[20px] p-4 text-left flex flex-col justify-between min-h-[110px] transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:border-[#FFE01A]/40 transition-colors">
                        <Users size={20} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-white leading-tight">Walk together</h4>
                        <p className="text-xs text-[#A3A3AA] mt-1 leading-snug">Join a group walk</p>
                      </div>
                    </button>

                    {/* Tile 4: Lost & found */}
                    <button
                      type="button"
                      onClick={() => setIsQuickReportOpen(true)}
                      className="bg-[#161618] hover:bg-[#1f1f22] border border-[#26262A] rounded-[20px] p-4 text-left flex flex-col justify-between min-h-[110px] transition-all cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:border-[#FFE01A]/40 transition-colors">
                        <Key size={20} />
                      </div>
                      <div>
                        <h4 className="text-[15px] font-bold text-white leading-tight">Lost & found</h4>
                        <p className="text-xs text-[#A3A3AA] mt-1 leading-snug truncate">
                          {openReportsCount > 0 ? `${openReportsCount} open report${openReportsCount > 1 ? 's' : ''}` : 'Report or claim'}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* 6. SPONSOR */}
                {nodeSponsor && (
                  <div className="px-4 mt-6">
                    <div className="bg-[#161618] border border-[#26262A] rounded-[20px] p-4 space-y-1">
                      <div className="text-[9px] font-black uppercase tracking-widest text-[#A3A3AA]">
                        SPONSORED
                      </div>
                      <SponsorSlot variant="node" sponsor={nodeSponsor} />
                    </div>
                  </div>
                )}

                {/* 7. FOOTER */}
                <div className="px-4 pt-8 pb-12 flex flex-col items-center text-center space-y-3">
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[#A3A3AA]">
                    <ShieldCheck size={16} className="text-[#4ADE80] shrink-0 inline" />
                    <span>No app. No account. Your tap is logged anonymously.</span>
                    <button
                      type="button"
                      onClick={onOpenConsent}
                      className="underline text-white hover:text-[#FFE01A] font-medium cursor-pointer min-h-[44px] inline-flex items-center"
                    >
                      How tap data is used
                    </button>
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#A3A3AA]/60">
                    LOCAL PULSE × URBAN HIKERS
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
              <ProfileTab
                user={user}
                userProfile={userProfile}
                accentColor={accentColor}
                onLogin={onLogin}
                onContinueAsGuest={() => onTabChange?.('feed')}
                onProfileUpdate={onProfileUpdate}
                nodesVisitedCount={nodesVisitedCount}
                hubsTappedCount={hubsTappedCount}
              />
            ) : null}
            {/* ... other tabs would go here, omitting for brevity of change but keeping key structure */}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 inset-x-0 z-[110] flex flex-col pointer-events-none">
        <div className="bg-[#0B0B0D] px-2 py-1.5 flex justify-around items-center border-t border-[#26262A] pointer-events-auto shadow-[0_-10px_30px_rgba(0,0,0,0.8)]">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            
            return (
              <button 
                key={item.id}
                type="button"
                onClick={() => onTabChange?.(item.id as any)}
                className="flex-1 flex flex-col items-center justify-center min-h-[48px] py-1 px-1 transition-all outline-none cursor-pointer group"
              >
                <Icon 
                  size={20} 
                  strokeWidth={isActive ? 2.5 : 1.75} 
                  style={{ color: isActive ? accentColor : '#A3A3AA' }}
                  className="transition-colors"
                />
                <span 
                  className="text-[10px] font-bold mt-1 tracking-tight transition-colors"
                  style={{ color: isActive ? accentColor : '#A3A3AA' }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Story Fields Modal for History Tile */}
      {showStorySheet && (
        <div className="fixed inset-0 z-[250] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#161618] border border-[#26262A] rounded-t-3xl sm:rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto p-6 space-y-4 text-white">
            <div className="flex items-center justify-between border-b border-[#26262A] pb-3">
              <div>
                <span 
                  className="text-[10px] font-black uppercase tracking-widest block"
                  style={{ color: accentColor }}
                >
                  {currentNode?.neighborhood ? `${currentNode.neighborhood.toUpperCase()} STORIES` : 'LOCAL STORIES'}
                </span>
                <h3 className="text-xl font-bold">
                  {currentNode?.name ? currentNode.name.replace(/_HUB/g, '').replace(/_/g, ' ') : nodeName.replace(/_HUB/g, '').replace(/_/g, ' ')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowStorySheet(false)}
                className="p-2 rounded-full hover:bg-white/10 text-[#A3A3AA] hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 text-sm text-[#A3A3AA]">
              {currentNode?.why_it_matters && (
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Why this place matters</h4>
                  <p className="leading-relaxed">{currentNode.why_it_matters}</p>
                </div>
              )}
              {currentNode?.founder_story && (
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Founder story</h4>
                  <p className="leading-relaxed">{currentNode.founder_story}</p>
                </div>
              )}
              {currentNode?.business_history && (
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Location heritage</h4>
                  <p className="leading-relaxed">{currentNode.business_history}</p>
                </div>
              )}
              {currentNode?.community_impact && (
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Community impact</h4>
                  <p className="leading-relaxed">{currentNode.community_impact}</p>
                </div>
              )}
              {currentNode?.recommended_experience && (
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Recommended experience</h4>
                  <p className="leading-relaxed">{currentNode.recommended_experience}</p>
                </div>
              )}
              {!currentNode?.why_it_matters && !currentNode?.founder_story && !currentNode?.business_history && !currentNode?.community_impact && !currentNode?.recommended_experience && (
                <p className="italic py-4 text-center">
                  {currentNode?.hub_tagline || 'More local stories and neighborhood history coming soon.'}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Report Sheet for Lost & Found */}
      {currentNode?.id && (
        <QuickReportSheet
          isOpen={isQuickReportOpen}
          onClose={() => setIsQuickReportOpen(false)}
          nodeId={currentNode.id}
        />
      )}


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

      <LinkEmailModal
        isOpen={isLinkEmailModalOpen}
        onClose={() => setIsLinkEmailModalOpen(false)}
        currentEmail={user?.email || userProfile?.email || visitorEmail || null}
        onLinked={(newEmail, newProfile) => {
          setVisitorEmail(newEmail);
          if (newProfile && onProfileUpdate) {
            onProfileUpdate(newProfile);
          }
        }}
      />
    </div>
  );
};
