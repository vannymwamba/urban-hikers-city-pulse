import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, query, where, doc, deleteDoc, addDoc, setDoc, Timestamp, getDocFromServer, orderBy, limit, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../firebase';
import { Broadcast, Node, Partner, UserProfile, BroadcastType, Tap, VibeReport, TabView, Interaction, LocalHub } from '../types';
import { BroadcastControlForm } from './BroadcastControlForm';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { RefreshCw, Trash2, Plus, Layout, Users, Activity, LogOut, Shield, Database, BarChart2, Radio, MapPin, Zap, Loader2, Upload, Calendar, BookOpen, Wifi, Star, Map, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { OverviewPanel } from './OverviewPanel';
import { SystemHealthPanel } from './SystemHealthPanel';
import { LiveTicker } from './LiveTicker';
import { NfcNodeHeatmap } from './NfcNodeHeatmap';
import { BASE_URL } from '../constants';
import { parseAnyTimestamp } from '../utils/dateUtils';

interface DashboardProps {
  user?: any;
  userProfile: UserProfile | null;
  nodes?: Node[];
  onLogout?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, userProfile, nodes, onLogout }) => {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [vibeReports, setVibeReports] = useState<VibeReport[]>([]);
  const [tabViews, setTabViews] = useState<TabView[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [localHubs, setLocalHubs] = useState<LocalHub[]>([]);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [listenerHealth, setListenerHealth] = useState<Record<string, { count: number; lastUpdate: Date }>>({});
  const [systemHealth, setSystemHealth] = useState<{ firebase: 'ok' | 'degraded'; swActive: boolean }>({ firebase: 'ok', swActive: false });

  const [activeTab, setActiveTab] = useState<'overview' | 'broadcasts' | 'partners' | 'hubs' | 'analytics' | 'system'>('overview');
  const [loading, setLoading] = useState(true);
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [showAddLocalHub, setShowAddLocalHub] = useState(false);
  const [showAddSectorNode, setShowAddSectorNode] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const [newSectorNode, setNewSectorNode] = useState({
    name: '',
    address: '',
    latitude: 39.1092,
    longitude: -84.5125,
    radius_limit: 4828,
    type: 'street' as any,
    partner_name: '',
    partner_type: 'walk_hq' as 'walk_hq' | 'refuel' | 'civic' | 'anchor' | 'discovery' | 'creator' | 'wellness' | 'street',
    partner_initials: '',
    partner_accent: '#FFE01A',
    hub_tagline: '',
    
    // Customizable design/media fields
    cover_image_url: '',
    logo_url: '',
    gallery_urls: [] as string[],
    founder_photo_url: '',
    theme_mode: 'light' as 'light' | 'dark' | 'adaptive',
    logo_style: 'circle' as 'circle' | 'rounded' | 'square',
    
    // Narratives & stories
    why_it_matters: '',
    founder_story: '',
    business_history: '',
    community_impact: '',
    recommended_experience: '',
    
    // Custom rewards system
    custom_reward: '☕ Free Coffee on Check-in',
    
    // Community metrics fields
    metric_walkers: 1422,
    metric_visits: 4210,
    metric_events: 127,
    metric_miles: 8442,
    metric_conversations: 340,
    metric_stories: 85,
    
    // Partner recognition logo URLs
    partner_logo_url: '',
    sponsor_logo_url: '',
    community_logo_url: ''
  });

  const [newLocalHub, setNewLocalHub] = useState({
    name: '',
    address: '',
    latitude: 39.1092,
    longitude: -84.5125,
    offer: '',
    tier: 'free' as 'free' | 'paid' | 'premium',
    cta_url: '',
    cover_url: '',
    is_active: true,
    operating_hours: {
      monday: { open: '09:00', close: '21:00' },
      tuesday: { open: '09:00', close: '21:00' },
      wednesday: { open: '09:00', close: '21:00' },
      thursday: { open: '09:00', close: '21:00' },
      friday: { open: '09:00', close: '18:00' },
      saturday: { open: '09:00', close: '18:00' },
      sunday: { open: '13:00', close: '17:00' }
    }
  });
  
  const [newBroadcast, setNewBroadcast] = useState({ 
    title: '', 
    type: BroadcastType.LIVE_EVENT, 
    description: '',
    node_id: '',
    node_ids: [] as string[],
    custom_address: '',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '12:00',
    end_time: '14:00',
    partner_id: userProfile?.partner_id || userProfile?.partnerId || '',
    cover_url: '',
    artist: '',
    artist_url: '',
    booking_url: '',
    organizer_logo_url: '',
    sponsor_logo_url: '',
    is_sponsored: false,
    partner_name: '',
    sponsor_name: '',
    latitude: null as number | null,
    longitude: null as number | null,
    deal_description: '',
    year_created: null as number | null,
    price: 0,
    spots_remaining: null as number | null,
    departure_time: '',
    meeting_point: '',
    guide_name: '',
    discount_value: '',
  });

  const [newPartner, setNewPartner] = useState({
    name: '',
    owner_email: '',
    tier: 'standard' as 'standard' | 'premium' | 'anchor',
    logo_url: '',
    active: true
  });

  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(null);
  const [previewNodeId, setPreviewNodeId] = useState<string | null>(null);
  
  const [resolvingCoordinates, setResolvingCoordinates] = useState(false);
  
  const [hubCoverPreview, setHubCoverPreview] = useState<string | null>(null);
  const [uploadingHubCover, setUploadingHubCover] = useState(false);
  const [hubCoverMode, setHubCoverMode] = useState<'url' | 'upload'>('upload');
  const hubCoverInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isPartner = userProfile?.role === 'partner';

  useEffect(() => {
    let q = query(collection(db, 'broadcasts'));
    if (isPartner && !isAdmin) {
      q = query(collection(db, 'broadcasts'), where('partner_id', '==', userProfile?.partner_id || userProfile?.partnerId || ''));
    }

    const unsub = onSnapshot(q, (snap) => {
      setBroadcasts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Broadcast));
      setListenerHealth(prev => ({ ...prev, broadcasts: { count: snap.size, lastUpdate: new Date() } }));
      setLoading(false);
    });

    return () => unsub();
  }, [userProfile, isAdmin, isPartner]);

  useEffect(() => {
    if (!isAdmin) return;
    
    const unsubs = [
      onSnapshot(collection(db, 'partners'), (snap) => {
        setPartners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Partner));
        setListenerHealth(prev => ({ ...prev, partners: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(query(collection(db, 'taps'), orderBy('timestamp', 'desc'), limit(1000)), (snap) => {
        setTaps(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Tap));
        setListenerHealth(prev => ({ ...prev, taps: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(query(collection(db, 'vibe_reports'), orderBy('reported_at', 'desc'), limit(500)), (snap) => {
        setVibeReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as VibeReport));
        setListenerHealth(prev => ({ ...prev, vibe_reports: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(query(collection(db, 'tab_views'), orderBy('timestamp', 'desc'), limit(1000)), (snap) => {
        setTabViews(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as TabView));
        setListenerHealth(prev => ({ ...prev, tab_views: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(query(collection(db, 'interactions'), orderBy('timestamp', 'desc'), limit(500)), (snap) => {
        setInteractions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Interaction));
        setListenerHealth(prev => ({ ...prev, interactions: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(query(collection(db, 'sync_logs'), orderBy('timestamp', 'desc'), limit(10)), (snap) => {
        setSyncLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setListenerHealth(prev => ({ ...prev, sync_logs: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(collection(db, 'local_hubs'), (snap) => {
        setLocalHubs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as LocalHub));
        setListenerHealth(prev => ({ ...prev, local_hubs: { count: snap.size, lastUpdate: new Date() } }));
      }),
      onSnapshot(collection(db, 'nodes'), (snap) => {
        setListenerHealth(prev => ({ ...prev, nodes: { count: snap.size, lastUpdate: new Date() } }));
      })
    ];

    // Health Check
    const checkHealth = async () => {
      try {
        await getDocFromServer(doc(db, 'nodes', 'connection-test'));
        setSystemHealth(prev => ({ ...prev, firebase: 'ok' }));
      } catch (e) {
        setSystemHealth(prev => ({ ...prev, firebase: 'degraded' }));
      }
      
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        setSystemHealth(prev => ({ ...prev, swActive: !!registration?.active }));
      }
    };
    checkHealth();

    return () => unsubs.forEach(unsub => unsub());
  }, [isAdmin]);

  const handleDeleteBroadcast = async (id: string, title: string) => {
    if (!window.confirm(`TERMINATE SIGNAL: ${title}?`)) return;
    try {
      await deleteDoc(doc(db, 'broadcasts', id));
      setHudMessage({ text: 'SIGNAL_TERMINATED', type: 'info' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `broadcasts/${id}`);
    }
  };

  const handleBulkDeleteBroadcasts = async () => {
    if (!window.confirm("CRITICAL: WIPE ALL ACTIVE SIGNALS? This cannot be undone.")) return;
    try {
      const promises = broadcasts.map(b => deleteDoc(doc(db, 'broadcasts', b.id)));
      await Promise.all(promises);
      setHudMessage({ text: 'TOTAL_WIPE_COMPLETE', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'WIPE_FAILED', type: 'error' });
    }
  };

  const [isSolvingAddress, setIsSolvingAddress] = useState(false);
  const geocodingLib = useMapsLibrary('geocoding');

  const solveAddress = async () => {
    if (!geocodingLib || !newSectorNode.address) return;
    
    setIsSolvingAddress(true);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const result = await geocoder.geocode({ address: newSectorNode.address });
      
      if (result.results && result.results[0]) {
        const { lat, lng } = result.results[0].geometry.location;
        setNewSectorNode({
          ...newSectorNode,
          latitude: lat(),
          longitude: lng()
        });
        setHudMessage({ text: 'ADDRESS_SOLVED: COORDINATES_UPDATED', type: 'info' });
      } else {
        setHudMessage({ text: 'GEOCONDING_FAILED: NO_RESULTS', type: 'error' });
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: 'GEOCONDING_ERROR: CHECK_API_KEY', type: 'error' });
    } finally {
      setIsSolvingAddress(false);
    }
  };

  const handleAddPartner = async () => {
    if (!newPartner.name || !newPartner.owner_email) return;
    try {
      await addDoc(collection(db, 'partners'), {
        ...newPartner,
        created_at: Timestamp.now()
      });
      setShowAddPartner(false);
      setNewPartner({ name: '', owner_email: '', tier: 'standard', logo_url: '', active: true });
      setHudMessage({ text: 'PARTNER_REGISTERED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'REGISTRATION_FAILED', type: 'error' });
    }
  };

  const handleDeletePartner = async (id: string, name: string) => {
    if (!window.confirm(`ERASE PARTNER: ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'partners', id));
      setHudMessage({ text: 'PARTNER_ERASED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'ERASE_FAILED', type: 'error' });
    }
  };

  const handleChangePartnerTier = async (id: string, tier: string) => {
    try {
      await updateDoc(doc(db, 'partners', id), { tier });
      setHudMessage({ text: `TIER_UPDATED: ${tier.toUpperCase()}`, type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'UPDATE_FAILED', type: 'error' });
    }
  };

  const handleAddLocalHub = async () => {
    if (!newLocalHub.name || !newLocalHub.address) return;
    try {
      await addDoc(collection(db, 'local_hubs'), {
        ...newLocalHub,
        created_at: Timestamp.now()
      });
      setShowAddLocalHub(false);
      setNewLocalHub({ 
        name: '', 
        address: '', 
        latitude: 39.1092, 
        longitude: -84.5125, 
        offer: '', 
        tier: 'free', 
        cta_url: '', 
        cover_url: '', 
        is_active: true,
        operating_hours: {
          monday: { open: '09:00', close: '21:00' },
          tuesday: { open: '09:00', close: '21:00' },
          wednesday: { open: '09:00', close: '21:00' },
          thursday: { open: '09:00', close: '21:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '09:00', close: '18:00' },
          sunday: { open: '13:00', close: '17:00' }
        }
      });
      setHubCoverPreview(null);
      setHubCoverMode('upload');
      setHudMessage({ text: 'LOCAL_HUB_IGNITED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'IGNITION_FAILED', type: 'error' });
    }
  };

  const handleDeleteLocalHub = async (id: string, name: string) => {
    if (!window.confirm(`ERASE HUB: ${name}?`)) return;
    try {
      await deleteDoc(doc(db, 'local_hubs', id));
      setHudMessage({ text: 'HUB_ERASED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'ERASE_FAILED', type: 'error' });
    }
  };

  const handleLocalHubCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Instant local preview
    const reader = new FileReader();
    reader.onloadend = () => setHubCoverPreview(reader.result as string);
    reader.readAsDataURL(file);

    setUploadingHubCover(true);
    try {
      const storageRef = ref(storage, `local_hubs/covers/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytesResumable(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setNewLocalHub(prev => ({ ...prev, cover_url: url }));
      setHudMessage({ text: 'COVER_UPLOADED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'UPLOAD_FAILED', type: 'error' });
    } finally {
      setUploadingHubCover(false);
    }
  };

  const [uploadingStatus, setUploadingStatus] = useState<Record<string, boolean>>({});

  const handleSectorNodeFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: 'cover_image_url' | 'logo_url' | 'founder_photo_url' | 'gallery_urls' | 'partner_logo_url' | 'sponsor_logo_url' | 'community_logo_url'
  ) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingStatus(prev => ({ ...prev, [fieldName]: true }));
    try {
      if (fieldName === 'gallery_urls') {
        const uploadedUrls: string[] = [...(newSectorNode.gallery_urls || [])];
        const capacity = 8 - uploadedUrls.length;
        const uploadCount = Math.min(files.length, capacity);
        
        for (let i = 0; i < uploadCount; i++) {
          const file = files[i];
          const storageRef = ref(storage, `nodes/gallery/${Date.now()}_hf_${file.name}`);
          const snapshot = await uploadBytesResumable(storageRef, file);
          const url = await getDownloadURL(snapshot.ref);
          uploadedUrls.push(url);
        }
        
        setNewSectorNode(prev => ({ ...prev, gallery_urls: uploadedUrls }));
        setHudMessage({ text: 'GALLERY_IMAGES_UPLOADED', type: 'info' });
      } else {
        const file = files[0];
        const storageRef = ref(storage, `nodes/${fieldName}/${Date.now()}_hf_${file.name}`);
        const snapshot = await uploadBytesResumable(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        setNewSectorNode(prev => ({ ...prev, [fieldName]: url }));
        setHudMessage({ text: `${fieldName.toUpperCase().replace(/_/g, ' ')} UPLOADED`, type: 'info' });
      }
    } catch (err) {
      console.error("Upload error:", err);
      setHudMessage({ text: 'UPLOAD_FAILED', type: 'error' });
    } finally {
      setUploadingStatus(prev => ({ ...prev, [fieldName]: false }));
    }
  };

  const handleAddSectorNode = async () => {
    if (!newSectorNode.name) return;
    try {
      const targetId = editingNodeId || (newSectorNode.name.replace(/\s+/g, '_').toUpperCase() + '_' + Math.floor(Math.random()*1000));
      await setDoc(doc(db, 'nodes', targetId), {
        ...newSectorNode,
        id: targetId,
        created_at: Timestamp.now()
      });
      setShowAddSectorNode(false);
      setEditingNodeId(null);
      setNewSectorNode({ 
        name: '', address: '', latitude: 39.1092, longitude: -84.5125, radius_limit: 4828, type: 'street' as any,
        partner_name: '', partner_type: 'walk_hq' as any, partner_initials: '', partner_accent: '#FFE01A', hub_tagline: '',
        cover_image_url: '', logo_url: '', gallery_urls: [], founder_photo_url: '',
        theme_mode: 'light', logo_style: 'circle', why_it_matters: '', founder_story: '',
        business_history: '', community_impact: '', recommended_experience: '',
        custom_reward: '☕ Free Coffee on Check-in',
        metric_walkers: 1422, metric_visits: 4210, metric_events: 127, metric_miles: 8442,
        metric_conversations: 340, metric_stories: 85, partner_logo_url: '', sponsor_logo_url: '', community_logo_url: ''
      });
      setHudMessage({ text: editingNodeId ? 'SECTOR_NODE_UPDATED' : 'SECTOR_NODE_REGISTERED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'NODE_REGISTRATION_FAILED', type: 'error' });
    }
  };

  const handleDeleteSectorNode = async (id: string, name: string) => {
    if (!window.confirm(`ERASE SECTOR NODE: ${name}? This will silence all signals attached to it.`)) return;
    try {
      await deleteDoc(doc(db, 'nodes', id));
      setHudMessage({ text: 'NODE_ERASED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'ERASE_FAILED', type: 'error' });
    }
  };

  const handleRepublish = async (b: Broadcast) => {
    const starts = new Date();
    const expires = new Date(starts.getTime() + 4 * 60 * 60 * 1000);
    try {
      const data = { ...b, starts_at: Timestamp.fromDate(starts), expires_at: Timestamp.fromDate(expires), status: 'active', created_at: Timestamp.now() };
      delete (data as any).id;
      await addDoc(collection(db, 'broadcasts'), data);
      setHudMessage({ text: 'SIGNAL_REKINDLED', type: 'info' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'broadcasts');
    }
  };

  const handlePatchLibraryHours = async () => {
    try {
      const libraryHub = localHubs.find(h => h.name.toLowerCase().includes('library'));
      if (!libraryHub) {
        setHudMessage({ text: 'LIBRARY_HUB_NOT_FOUND_IN_REGISTRY', type: 'error' });
        return;
      }

      const hours = {
        monday: { open: '09:00', close: '21:00' },
        tuesday: { open: '09:00', close: '21:00' },
        wednesday: { open: '09:00', close: '21:00' },
        thursday: { open: '09:00', close: '21:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '09:00', close: '18:00' },
        sunday: { open: '13:00', close: '17:00' }
      };

      await updateDoc(doc(db, 'local_hubs', libraryHub.id), { 
        operating_hours: hours,
        is_open: true // Setting true here but logic in card will handle it dynamically
      });

      setHudMessage({ text: 'LIBRARY_HOURS_SYNCHRONIZED', type: 'info' });
    } catch (err) {
      setHudMessage({ text: 'SYNC_FAILED', type: 'error' });
    }
  };

  const handleResolveCoordinates = async () => {
    if (!geocodingLib || !newLocalHub.address) {
      setHudMessage({ text: 'ADDRESS_REQUIRED_FOR_RESOLUTION', type: 'error' });
      return;
    }

    setResolvingCoordinates(true);
    try {
      const geocoder = new geocodingLib.Geocoder();
      const result = await geocoder.geocode({ address: newLocalHub.address });

      if (result.results && result.results[0]) {
        const { lat, lng } = result.results[0].geometry.location;
        setNewLocalHub(prev => ({
          ...prev,
          latitude: lat(),
          longitude: lng()
        }));
        setHudMessage({ text: 'COORDINATES_RESOLVED', type: 'info' });
      } else {
        setHudMessage({ text: 'COULD_NOT_RESOLVE_ADDRESS', type: 'error' });
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: 'GEOCONDING_ERROR: CHECK_API_KEY', type: 'error' });
    } finally {
      setResolvingCoordinates(false);
    }
  };

  const parseDate = (val: any) => val instanceof Timestamp ? val.toDate() : new Date(val);

  if (loading) return (
    <div className="h-screen bg-black flex items-center justify-center font-mono">
      <div className="text-[#FFE01A] animate-pulse tracking-[0.2em]">INITIALIZING_TACTICAL_DASHBOARD...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f5f5f3] font-mono text-[#1a1a1a]">
      {/* HUD Message */}
      <AnimatePresence>
        {hudMessage && (
          <motion.div 
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            exit={{ y: -100 }}
            className={`fixed top-0 left-0 right-0 z-[100] p-4 text-center text-[10px] font-bold tracking-widest uppercase ${hudMessage.type === 'error' ? 'bg-[#E24B4A] text-white' : 'bg-[#FFE01A] text-black'}`}
          >
            {hudMessage.text}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex justify-between items-end mb-12 border-b border-[#e0e0e0] pb-6">
          <div>
            <h1 className="text-3xl font-black tracking-tighter mb-2">SYSTEM_OPERATIONS</h1>
            <p className="text-[10px] text-[#999] tracking-widest uppercase">Operator: {user?.email} [{userProfile?.role}]</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button 
              onClick={() => setActiveTab('overview')}
              className={`px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 ${activeTab === 'overview' ? 'bg-black text-[#FFE01A]' : 'text-uh-gray-400 bg-white border border-uh-gray-100 hover:border-uh-yellow hover:text-uh-black'}`}
            >
              <Layout size={12} /> Overview
            </button>
            <button 
              onClick={() => setActiveTab('broadcasts')}
              className={`px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 ${activeTab === 'broadcasts' ? 'bg-black text-[#FFE01A]' : 'text-uh-gray-400 bg-white border border-uh-gray-100 hover:border-uh-yellow hover:text-uh-black'}`}
            >
              <Radio size={12} /> Broadcasts
            </button>
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('partners')}
                className={`px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 ${activeTab === 'partners' ? 'bg-black text-[#FFE01A]' : 'text-uh-gray-400 bg-white border border-uh-gray-100 hover:border-uh-yellow hover:text-uh-black'}`}
              >
                <Users size={12} /> Partners
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('hubs')}
                className={`px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 ${activeTab === 'hubs' ? 'bg-black text-[#FFE01A]' : 'text-uh-gray-400 bg-white border border-uh-gray-100 hover:border-uh-yellow hover:text-uh-black'}`}
              >
                <MapPin size={12} /> Nodes
              </button>
            )}
            {isAdmin && (
              <button 
                onClick={() => setActiveTab('analytics')}
                className={`px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 ${activeTab === 'analytics' ? 'bg-black text-[#FFE01A]' : 'text-uh-gray-400 bg-white border border-uh-gray-100 hover:border-uh-yellow hover:text-uh-black'}`}
              >
                <BarChart2 size={12} /> Analytics
              </button>
            )}
            {isSuperAdmin && (
              <button 
                onClick={() => setActiveTab('system')}
                className={`px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 ${activeTab === 'system' ? 'bg-black text-[#FFE01A]' : 'text-uh-gray-400 bg-white border border-uh-gray-100 hover:border-uh-yellow hover:text-uh-black'}`}
              >
                <Shield size={12} /> System
              </button>
            )}
            <button 
              onClick={onLogout}
              className="px-5 py-2 text-[10px] font-bold tracking-widest uppercase rounded-full transition-all flex items-center gap-2 text-rose-500 bg-white border border-rose-100 hover:bg-rose-500 hover:text-white"
            >
              <LogOut size={12} /> Terminate
            </button>
          </div>
        </div>

        {activeTab === 'overview' && (
          <OverviewPanel 
            broadcasts={broadcasts}
            taps={taps}
            partners={partners}
            vibeReports={vibeReports}
            interactions={interactions}
            nodes={nodes}
            systemStatus={systemHealth.firebase}
          />
        )}

        {activeTab === 'system' && isSuperAdmin && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <SystemHealthPanel 
              userProfile={userProfile}
              listenerHealth={listenerHealth}
              systemHealth={systemHealth}
            />
            
            <div className="bg-white border border-uh-gray-200 rounded-2xl p-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 border-b border-uh-gray-100 pb-4">Data_Repair_Ops</h3>
              <div className="flex flex-wrap gap-4">
                <button 
                  onClick={handlePatchLibraryHours}
                  className="px-6 py-3 bg-teal-500 text-white text-[9px] font-black tracking-widest uppercase rounded-xl hover:scale-105 transition-all flex items-center gap-2"
                >
                  <RefreshCw size={14} />
                  Sync Library Hours
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'broadcasts' && (
          <div className="grid grid-cols-1 gap-12">
            <div className="bg-white border border-[#e0e0e0] rounded-2xl p-8 shadow-sm">
              <BroadcastControlForm 
                formData={newBroadcast}
                setFormData={setNewBroadcast as any}
                userProfile={userProfile}
                nodes={nodes}
                isAdmin={isAdmin}
                setError={(err) => setHudMessage({ text: err || 'PHASE_ERROR', type: 'error' })}
                setSubmitting={setSubmitting}
                setSuccess={(suc) => {
                  if (suc) {
                    setHudMessage({ text: 'SIGNAL_TRANSMITTED', type: 'info' });
                    setEditingBroadcastId(null);
                    setNewBroadcast({ 
                      title: '', type: BroadcastType.LIVE_EVENT, description: '', node_id: '', node_ids: [], custom_address: '', 
                      event_date: new Date().toISOString().split('T')[0], start_time: '12:00', end_time: '14:00',
                      partner_id: userProfile?.partner_id || userProfile?.partnerId || '', cover_url: '', 
                      artist: '', artist_url: '', booking_url: '', organizer_logo_url: '', sponsor_logo_url: '', is_sponsored: false, 
                      partner_name: '', sponsor_name: '', latitude: null, longitude: null,
                      deal_description: '', year_created: null, price: 0, spots_remaining: null,
                      departure_time: '', meeting_point: '', guide_name: '', discount_value: ''
                    });
                  }
                }}
              />
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[12px] font-bold tracking-widest uppercase text-[#999]">ACTIVE_TRANSMISSIONS</h3>
                {isSuperAdmin && broadcasts.length > 0 && (
                  <button 
                    onClick={handleBulkDeleteBroadcasts}
                    className="flex items-center gap-2 px-4 py-2 bg-[#E24B4A] text-white text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all"
                  >
                    <Trash2 size={12} />
                    Wipe All Signals
                  </button>
                )}
              </div>
              {broadcasts.length === 0 ? (
                <div className="py-20 text-center border-2 border-dashed border-[#e0e0e0] rounded-2xl">
                  <span className="text-[10px] text-[#cccccc] tracking-widest uppercase font-bold">NO_SIGNALS_DETECTED</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {broadcasts.sort((a,b) => parseDate(b.created_at || 0).getTime() - parseDate(a.created_at || 0).getTime()).map(b => (
                    <div key={b.id} className="bg-white border border-[#e0e0e0] rounded-xl p-6 flex justify-between items-center group hover:border-[#FFE01A] transition-all">
                      <div className="flex gap-6 items-center">
                        <div className="w-12 h-12 rounded-lg bg-[#f8f8f8] overflow-hidden border border-[#e0e0e0]">
                          {b.cover_url && <img src={b.cover_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
                        </div>
                        <div>
                          <div className="text-[12px] font-bold uppercase mb-1 flex items-center gap-2">
                            {b.title}
                            {(() => {
                              const exp = parseDate(b.expires_at || b.expiresAt).getTime();
                              const diff = exp - Date.now();
                              let color = 'bg-teal-500';
                              if (diff < 1800000) color = 'bg-rose-500'; // < 30min
                              else if (diff < 7200000) color = 'bg-amber-500'; // < 2h
                              return <div className={`w-2 h-2 rounded-full ${color}`} title="Signal_Health" />;
                            })()}
                          </div>
                          <div className="flex gap-3 items-center">
                            <span className="text-[8px] bg-black text-[#FFE01A] px-2 py-0.5 rounded font-bold uppercase tracking-widest">{b.type}</span>
                            <span className="text-[8px] text-[#999] uppercase tracking-widest font-bold">Expires: {parseDate(b.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="text-[8px] text-blue-500 font-black flex items-center gap-1 uppercase">
                              <Zap size={8} /> {taps.filter(t => t.node_id === (b.node_id || b.nodeId)).length} Taps
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            const starts = parseDate(b.starts_at);
                            const expires = parseDate(b.expires_at);
                            setEditingBroadcastId(b.id);
                            setNewBroadcast({
                              title: b.title,
                              type: b.type,
                              description: b.description || '',
                              node_id: b.node_id || b.nodeId || '',
                              node_ids: b.node_ids || [],
                              custom_address: b.address || b.venue || '',
                              event_date: starts.toISOString().split('T')[0],
                              start_time: starts.getHours().toString().padStart(2, '0') + ':' + starts.getMinutes().toString().padStart(2, '0'),
                              end_time: expires.getHours().toString().padStart(2, '0') + ':' + expires.getMinutes().toString().padStart(2, '0'),
                              partner_id: b.partner_id || b.partnerId || '',
                              cover_url: b.cover_url || b.imageUrl || '',
                              artist: b.artist || '',
                              artist_url: b.artist_url || '',
                              booking_url: b.booking_url || '',
                              organizer_logo_url: b.organizer_logo_url || '',
                              sponsor_logo_url: b.sponsor_logo_url || '',
                              is_sponsored: b.is_sponsored || false,
                              partner_name: b.partner_name || '',
                              sponsor_name: b.sponsor_name || '',
                              latitude: b.latitude || null,
                              longitude: b.longitude || null,
                              deal_description: b.deal_description || '',
                              year_created: b.year_created || null,
                              price: b.price || 0,
                              spots_remaining: b.spots_remaining || null,
                              departure_time: b.departure_time || '',
                              meeting_point: b.meeting_point || '',
                              guide_name: b.guide_name || '',
                              discount_value: b.discount_value || ''
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-3 rounded-lg hover:bg-[#FFE01A] transition-colors"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeleteBroadcast(b.id, b.title)}
                          className="p-3 rounded-lg hover:bg-[#E24B4A] hover:text-white transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analytics' && isAdmin && (
          <div className="space-y-12 animate-in fade-in duration-700">
            {/* Header Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white border border-uh-gray-200 p-6 rounded-xl">
                 <div className="text-[8px] font-black uppercase tracking-widest text-uh-gray-400 mb-2">Total_Taps</div>
                 <div className="text-2xl font-black text-uh-yellow">{taps.length}</div>
              </div>
              <div className="bg-white border border-uh-gray-200 p-6 rounded-xl">
                 <div className="text-[8px] font-black uppercase tracking-widest text-uh-gray-400 mb-2">Vibe_Reports</div>
                 <div className="text-2xl font-black text-teal-500">{vibeReports.length}</div>
              </div>
              <div className="bg-white border border-uh-gray-200 p-6 rounded-xl">
                 <div className="text-[8px] font-black uppercase tracking-widest text-uh-gray-400 mb-2">Tab_Views</div>
                 <div className="text-2xl font-black text-blue-500">{tabViews.length}</div>
              </div>
              <div className="bg-white border border-uh-gray-200 p-6 rounded-xl">
                 <div className="text-[8px] font-black uppercase tracking-widest text-uh-gray-400 mb-2">Active_Signals</div>
                 <div className="text-2xl font-black text-rose-500">{broadcasts.length}</div>
              </div>
            </div>

            {/* D3-based NFC Node Tap Heatmap */}
            <NfcNodeHeatmap nodes={nodes || []} taps={taps || []} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Funnel */}
              <div className="bg-white border border-uh-gray-200 rounded-2xl p-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-8 border-b border-uh-gray-100 pb-4">Engagement_Funnel</h3>
                <div className="space-y-6">
                  {['feed', 'explore', 'wallet', 'profile'].map(tab => {
                    const views = tabViews.filter(v => v.tab === tab).length;
                    const max = Math.max(...['feed', 'explore', 'wallet', 'profile'].map(t => tabViews.filter(v => v.tab === t).length)) || 1;
                    const percent = (views / max) * 100;
                    return (
                      <div key={tab} className="space-y-2">
                        <div className="flex justify-between text-[10px] items-end">
                          <span className="font-bold uppercase tracking-widest">{tab}</span>
                          <span className="font-mono text-uh-gray-400">{views} views</span>
                        </div>
                        <div className="h-6 bg-uh-gray-50 rounded-lg overflow-hidden flex items-center px-4 relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className="absolute left-0 top-0 bottom-0 bg-uh-yellow/20"
                          />
                          <span className="relative z-10 text-[8px] font-black text-uh-gray-400">SESSION_RETENTION: {Math.round(percent)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-white border border-uh-gray-200 rounded-2xl p-8">
                <h3 className="text-[10px] font-black uppercase tracking-widest mb-8 border-b border-uh-gray-100 pb-4">Signal_Performance_Leaderboard</h3>
                <div className="space-y-4">
                  {broadcasts
                    .map(b => ({ ...b, tapCount: taps.filter(t => t.node_id === (b.node_id || b.nodeId)).length }))
                    .sort((a, b) => b.tapCount - a.tapCount)
                    .slice(0, 5)
                    .map((b, idx) => (
                    <div key={b.id} className="flex items-center justify-between p-3 bg-uh-gray-50 rounded-xl hover:bg-uh-gray-100 transition-colors">
                      <div className="flex items-center gap-4">
                        <span className="text-[9px] font-black text-uh-gray-300">0{idx + 1}</span>
                        <div>
                          <div className="text-[10px] font-black uppercase truncate max-w-[150px]">{b.title}</div>
                          <div className="text-[8px] text-uh-gray-400 uppercase tracking-widest">Node_{b.node_id?.slice(0,4)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[12px] font-black text-uh-yellow">{b.tapCount}</div>
                        <div className="text-[8px] text-uh-gray-400 uppercase">TAPS</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hourly Heatmap */}
            <div className="bg-white border border-uh-gray-200 rounded-2xl p-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest mb-8 border-b border-uh-gray-100 pb-4 text-center">Hourly_Tap_Velocity_Matrix</h3>
              <div className="flex items-end justify-between h-32 gap-1 px-4">
                {Array.from({ length: 24 }).map((_, hour) => {
                  const count = taps.filter(t => parseAnyTimestamp(t.timestamp, t.client_timestamp).getHours() === hour).length;
                  const max = Math.max(...Array.from({ length: 24 }).map((__, h) => taps.filter(t => parseAnyTimestamp(t.timestamp, t.client_timestamp).getHours() === h).length)) || 1;
                  const percent = (count / max) * 100;
                  return (
                    <div key={hour} className="flex-1 group relative">
                      <motion.div 
                        initial={{ height: 0 }}
                        animate={{ height: `${percent}%` }}
                        className={`w-full rounded-t-sm transition-colors ${percent > 70 ? 'bg-uh-yellow' : percent > 40 ? 'bg-teal-500' : 'bg-uh-gray-100 group-hover:bg-uh-gray-200'}`}
                      >
                         <div className="hidden group-hover:block absolute -top-8 left-1/2 -translate-x-1/2 bg-black text-white text-[8px] p-1 rounded whitespace-nowrap z-10 font-bold tracking-widest">
                           H{hour}: {count} TAPS
                         </div>
                      </motion.div>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-4 text-[7px] text-uh-gray-300 font-bold font-mono">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:59</span>
              </div>
            </div>

            {/* Partner ROI */}
            <div className="bg-white border border-uh-gray-200 rounded-2xl overflow-hidden">
               <div className="px-8 py-6 border-b border-uh-gray-100 flex justify-between items-center bg-uh-gray-50/50">
                 <h3 className="text-[10px] font-black uppercase tracking-widest">Partner_ROI_Efficiency_Index</h3>
                 <span className="text-[8px] bg-black text-uh-yellow px-2 py-0.5 rounded font-black tracking-widest">REAL_TIME</span>
               </div>
               <table className="w-full text-[10px] font-bold text-left">
                  <thead>
                    <tr className="border-b border-uh-gray-50 text-[8px] text-uh-gray-400 uppercase tracking-widest font-black">
                       <th className="px-8 py-4">Partner</th>
                       <th className="px-8 py-4 text-center">Attributed_Taps</th>
                       <th className="px-8 py-4 text-center">Active_Signals</th>
                       <th className="px-8 py-4 text-right">Efficiency_Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-uh-gray-50">
                    {partners.map(p => {
                      const pTaps = taps.filter(t => t.sponsor_id === p.id).length;
                      const pSignals = broadcasts.filter(b => b.partner_id === p.id).length;
                      const score = pSignals > 0 ? (pTaps / pSignals).toFixed(1) : '0.0';
                      return (
                        <tr key={p.id} className="hover:bg-uh-gray-50 transition-colors">
                           <td className="px-8 py-4 flex items-center gap-3">
                             <div className="w-6 h-6 rounded bg-uh-gray-50 border border-uh-gray-100 flex items-center justify-center text-[7px]">
                               {p.logo_url ? <img src={p.logo_url} className="w-full h-full object-cover rounded" /> : p.name.slice(0,2)}
                             </div>
                             {p.name}
                           </td>
                           <td className="px-8 py-4 text-center text-teal-500">{pTaps}</td>
                           <td className="px-8 py-4 text-center">{pSignals}</td>
                           <td className="px-8 py-4 text-right">
                              <span className="px-2 py-0.5 bg-uh-gray-900 text-[#FFE01A] rounded font-black">{score}</span>
                           </td>
                        </tr>
                      );
                    })}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'partners' && isAdmin && (
          <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-[12px] font-bold tracking-widest uppercase text-[#999]">PARTNER_REGISTRY</h3>
              {isSuperAdmin && (
                <button 
                  onClick={() => setShowAddPartner(!showAddPartner)}
                  className="flex items-center gap-2 px-4 py-2 bg-black text-[#FFE01A] text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all"
                >
                  <Plus size={12} />
                  {showAddPartner ? 'Cancel' : 'Register Partner'}
                </button>
              )}
            </div>

            {showAddPartner && (
              <div className="bg-white border border-[#e0e0e0] rounded-2xl p-8 mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Partner_Name</label>
                    <input 
                      type="text"
                      className="w-full bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl px-4 py-3 text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      value={newPartner.name}
                      onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Owner_Email</label>
                    <input 
                      type="email"
                      className="w-full bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl px-4 py-3 text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                      value={newPartner.owner_email}
                      onChange={e => setNewPartner({...newPartner, owner_email: e.target.value})}
                    />
                  </div>
                    <div>
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Tier_Level</label>
                      <select 
                        className="w-full bg-[#f8f8f8] border border-[#e0e0e0] rounded-xl px-4 py-3 text-[12px] font-bold focus:border-[#FFE01A] outline-none"
                        value={newPartner.tier}
                        onChange={e => setNewPartner({...newPartner, tier: e.target.value as any})}
                      >
                        <option value="standard">STANDARD</option>
                        <option value="premium">PREMIUM</option>
                        <option value="anchor">ANCHOR</option>
                      </select>
                    </div>
                </div>
                <button 
                  onClick={handleAddPartner}
                  className="mt-8 w-full py-4 bg-[#FFE01A] text-black text-[10px] font-black tracking-[0.3em] uppercase rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Confirm_Registration
                </button>
              </div>
            )}

            {partners.map(p => (
              <div key={p.id} className="bg-white border border-[#e0e0e0] rounded-xl p-6 flex justify-between items-center group hover:border-[#FFE01A] transition-all">
                <div className="flex gap-6 items-center">
                  <div className="w-12 h-12 rounded-lg bg-[#f8f8f8] overflow-hidden border border-[#e0e0e0] flex items-center justify-center">
                    {p.logo_url ? <img src={p.logo_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : <Users size={20} className="text-[#cccccc]" />}
                  </div>
                  <div>
                    <div className="text-[12px] font-bold uppercase mb-1">{p.name}</div>
                    <div className="flex gap-3 items-center">
                      <select 
                        disabled={!isSuperAdmin}
                        value={p.tier}
                        onChange={(e) => handleChangePartnerTier(p.id, e.target.value)}
                        className="text-[8px] bg-black text-[#FFE01A] px-2 py-0.5 rounded font-bold uppercase tracking-widest border-none outline-none cursor-pointer disabled:cursor-not-allowed"
                      >
                        <option value="standard">STANDARD</option>
                        <option value="premium">PREMIUM</option>
                        <option value="anchor">ANCHOR</option>
                      </select>
                      <span className="text-[8px] text-[#999] uppercase tracking-widest font-bold">{p.owner_email}</span>
                    </div>
                  </div>
                </div>
                {isSuperAdmin && (
                  <button 
                    onClick={() => handleDeletePartner(p.id, p.name)}
                    className="p-3 rounded-lg hover:bg-[#E24B4A] hover:text-white transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'hubs' && isAdmin && (
          <div className="flex flex-col gap-12">
            <div>
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[12px] font-bold tracking-widest uppercase text-uh-gray-400 flex items-center gap-2">
                  <MapPin size={14} className="text-uh-yellow" />
                  Sector_Hubs_Network
                </h3>
                {isSuperAdmin && (
                  <button 
                    onClick={() => setShowAddSectorNode(!showAddSectorNode)}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-[#FFE01A] text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all"
                  >
                    <Plus size={12} />
                    {showAddSectorNode ? 'Cancel' : 'Register Sector Hub'}
                  </button>
                )}
              </div>

              {showAddSectorNode && (
                <div id="sector-builder-container" className="bg-[#fcfcfc] border border-uh-gray-200 rounded-3xl p-6 lg:p-10 mb-10 overflow-hidden">
                  {/* Large Customizable Hero Header */}
                  <div className="mb-10 rounded-2xl overflow-hidden border border-uh-gray-200 shadow-xl bg-black relative max-w-5xl mx-auto">
                    {/* 16:9 Cover Image */}
                    <div className="aspect-[16/9] w-full max-h-[220px] md:max-h-[300px] overflow-hidden bg-uh-black relative">
                      {newSectorNode.cover_image_url ? (
                        <img src={newSectorNode.cover_image_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-tr from-black via-[#141414] to-[#222] flex items-center justify-center">
                          <span className="text-[10px] font-mono tracking-widest text-[#FFE01A]/30 uppercase">[ NO COVER UPLOADED · 16:9 HERO RATIO ]</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
                    </div>

                    {/* Overlapping Logo Transit Badge */}
                    <div className="absolute left-4 md:left-8 bottom-3 md:bottom-4 flex items-end gap-3 md:gap-6 z-10 w-full px-2 md:px-4">
                      <div 
                        className={`w-14 h-14 md:w-20 md:h-20 bg-uh-black flex items-center justify-center p-1 md:p-1.5 shadow-2xl relative border-2 md:border-4 translate-y-1 transform transition-all
                          ${newSectorNode.logo_style === 'rounded' ? 'rounded-2xl' : newSectorNode.logo_style === 'square' ? 'rounded-md' : 'rounded-full'}`}
                        style={{ borderColor: newSectorNode.partner_accent || '#FFE01A' }}
                      >
                        {newSectorNode.logo_url ? (
                          <img src={newSectorNode.logo_url} className={`w-full h-full object-cover ${newSectorNode.logo_style === 'rounded' ? 'rounded-xl' : newSectorNode.logo_style === 'square' ? 'rounded-[2px]' : 'rounded-full'}`} referrerPolicy="no-referrer" />
                        ) : (
                          <span className="text-sm md:text-xl font-black" style={{ color: newSectorNode.partner_accent || '#FFE01A' }}>
                            {newSectorNode.partner_initials || (newSectorNode.name ? newSectorNode.name.slice(0,2).toUpperCase() : 'UH')}
                          </span>
                        )}
                      </div>

                      <div className="pb-1 max-w-[calc(100%-100px)]">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[7px] md:text-[8px] font-black uppercase tracking-widest text-black" style={{ backgroundColor: newSectorNode.partner_accent || '#FFE01A' }}>
                            {newSectorNode.partner_type ? newSectorNode.partner_type.replace('_', ' ').toUpperCase() : 'WALK HQ'}
                          </span>
                        </div>
                        <h2 className="text-base md:text-2xl font-black text-white uppercase italic tracking-tighter leading-none mt-1 shadow-sm truncate">
                          {newSectorNode.name ? newSectorNode.name.replace(/_HUB/g, '').replace(/_/g, ' ') : 'ALPHA PLAZA'}
                        </h2>
                        <p className="text-[8px] md:text-[10px] font-mono text-white/50 tracking-wider truncate">
                          {newSectorNode.hub_tagline || 'Where historic brickwork meets modern local experiences.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Split grid for controls and real-time simulator preview */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Controls Column */}
                    <div className="lg:col-span-7 space-y-8">
                      <div className="border-b border-uh-gray-100 pb-4 mb-2 flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-widest text-black flex items-center gap-2">
                            <Activity size={14} className="text-uh-yellow" />
                            {editingNodeId ? 'Edit Hub Brand Configuration' : 'Branded Destination Builder'}
                          </h4>
                          <p className="text-[10px] text-uh-gray-400 font-mono mt-0.5 uppercase tracking-wide">
                            {editingNodeId ? `CONFIGURING PROTOCOL: /tap/${editingNodeId}` : 'Design a unique hub destination'}
                          </p>
                        </div>
                        {editingNodeId && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingNodeId(null);
                              setNewSectorNode({
                                name: '', address: '', latitude: 39.1092, longitude: -84.5125, radius_limit: 4828, type: 'street' as any,
                                partner_name: '', partner_type: 'walk_hq', partner_initials: '', partner_accent: '#FFE01A', hub_tagline: '',
                                cover_image_url: '', logo_url: '', gallery_urls: [], founder_photo_url: '',
                                theme_mode: 'light', logo_style: 'circle', why_it_matters: '', founder_story: '',
                                business_history: '', community_impact: '', recommended_experience: '',
                                custom_reward: '☕ Free Coffee on Check-in',
                                metric_walkers: 1422, metric_visits: 4210, metric_events: 127, metric_miles: 8442,
                                metric_conversations: 340, metric_stories: 85, partner_logo_url: '', sponsor_logo_url: '', community_logo_url: ''
                              });
                            }}
                            className="text-[8px] font-black text-rose-500 hover:text-rose-600 uppercase tracking-widest border border-rose-200 hover:border-rose-300 px-2 flex items-center justify-center h-8 rounded-lg transition-colors"
                          >
                            Reset Form
                          </button>
                        )}
                      </div>

                      {/* Section 1: Identity & Coordinates */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">01 · IDENTITY & COORDINATES</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Hub Name (Firebase ID)</label>
                            <input 
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.name}
                              placeholder="e.g. ALPHA_PLAZA"
                              onChange={e => setNewSectorNode({...newSectorNode, name: e.target.value.toUpperCase()})}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Partner / Venue</label>
                            <input 
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.partner_name}
                              placeholder="e.g. Alpha Plaza Building"
                              onChange={e => setNewSectorNode({...newSectorNode, partner_name: e.target.value})}
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Partner Initials</label>
                            <input 
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.partner_initials}
                              placeholder="e.g. AP"
                              maxLength={3}
                              onChange={e => setNewSectorNode({...newSectorNode, partner_initials: e.target.value.toUpperCase()})}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Hub Tagline</label>
                            <input 
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.hub_tagline}
                              placeholder="Where historic brickframes modern experiences"
                              onChange={e => setNewSectorNode({...newSectorNode, hub_tagline: e.target.value})}
                            />
                          </div>

                          <div className="md:col-span-2">
                            <div className="flex justify-between items-center mb-2">
                              <label className="text-[9px] text-[#999] tracking-widest uppercase block">Address</label>
                              <button 
                                type="button"
                                onClick={solveAddress}
                                disabled={isSolvingAddress || !newSectorNode.address}
                                className="flex items-center gap-1.5 px-3 py-1 bg-[#FFE01A] text-uh-black text-[8px] font-black tracking-widest uppercase rounded h-6 hover:scale-105 transition-all disabled:opacity-50 disabled:hover:scale-100"
                              >
                                {isSolvingAddress ? (
                                  <RefreshCw size={10} className="animate-spin" />
                                ) : (
                                  <Zap size={10} />
                                )}
                                Solve coordinates
                              </button>
                            </div>
                            <input 
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.address}
                              placeholder="e.g. 1201 Main St, Cincinnati, OH 45202"
                              onChange={e => setNewSectorNode({...newSectorNode, address: e.target.value})}
                            />
                          </div>

                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Latitude</label>
                            <input 
                              type="number"
                              step="0.0001"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.latitude}
                              onChange={e => setNewSectorNode({...newSectorNode, latitude: parseFloat(e.target.value)})}
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Longitude</label>
                            <input 
                              type="number"
                              step="0.0001"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.longitude}
                              onChange={e => setNewSectorNode({...newSectorNode, longitude: parseFloat(e.target.value)})}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 2: Media & Creative Customization */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-6">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">02 · MEDIA & BRAND CONTROLS</span>
                        
                        {/* Hub Classifications */}
                        <div>
                          <label className="text-[9px] text-[#999] tracking-widest uppercase mb-3 block font-bold text-black">Hub Classification (Hub Type)</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                              { id: 'walk_hq', label: 'WALK HQ', desc: 'HQ Hub', color: '#FFE01A' },
                              { id: 'refuel', label: 'REFUEL', desc: 'Coffee & Food', color: '#10B981' },
                              { id: 'civic', label: 'CIVIC', desc: 'Museum/Library', color: '#1D4ED8' },
                              { id: 'anchor', label: 'ANCHOR', desc: 'Neighborhood Landmark', color: '#EF4444' },
                              { id: 'discovery', label: 'DISCOVERY', desc: 'Historical Secret', color: '#F59E0B' },
                              { id: 'creator', label: 'CREATOR', desc: 'Art & Gallery', color: '#8B5CF6' },
                              { id: 'wellness', label: 'WELLNESS', desc: 'Fitness & Parks', color: '#EC4899' }
                            ].map(cat => (
                              <button
                                key={cat.id}
                                type="button"
                                onClick={() => setNewSectorNode({
                                  ...newSectorNode,
                                  partner_type: cat.id as any,
                                  partner_accent: cat.color
                                })}
                                className={`p-3 text-left rounded-xl border transition-all flex flex-col justify-between h-20 ${
                                  newSectorNode.partner_type === cat.id
                                    ? 'bg-black border-black text-[#FFE01A] shadow-md scale-[1.01]'
                                    : 'bg-[#fafafa] border-uh-gray-100 text-uh-gray-500 hover:border-uh-gray-300 hover:bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color }} />
                                  <span className="text-[9px] font-black uppercase tracking-wider">{cat.label}</span>
                                </div>
                                <span className="text-[7.5px] leading-tight opacity-70 block">{cat.desc}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Theme Selection */}
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block font-bold text-black font-sans">Theme Option</label>
                            <select
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.theme_mode}
                              onChange={e => setNewSectorNode({ ...newSectorNode, theme_mode: e.target.value as any })}
                            >
                              <option value="light font-sans">LIGHT CANVAS (HIGH CONTRAST)</option>
                              <option value="dark font-sans">DARK IMMERSIVE (CARBON NIGHT)</option>
                              <option value="adaptive font-sans">ADAPTIVE SYSTEM MODE</option>
                            </select>
                          </div>

                          {/* Logo Style Selection */}
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block font-bold text-black">Badge Profile Shape</label>
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { id: 'circle', label: 'Circle' },
                                { id: 'rounded', label: 'Rounded' },
                                { id: 'square', label: 'Square' }
                              ].map(style => (
                                <button
                                  key={style.id}
                                  type="button"
                                  onClick={() => setNewSectorNode({ ...newSectorNode, logo_style: style.id as any })}
                                  className={`px-3 py-3 rounded-lg border text-[10px] uppercase tracking-widest font-bold text-center ${
                                    newSectorNode.logo_style === style.id
                                      ? 'bg-black text-[#FFE01A] border-black'
                                      : 'bg-uh-gray-50 text-uh-gray-400 border-uh-gray-100 hover:border-uh-gray-300'
                                  }`}
                                >
                                  {style.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* 16:9 Cover URL / Upload */}
                          <div className="space-y-2">
                            <label className="text-[9px] text-[#999] tracking-widest uppercase block text-uh-gray-400">Cover Banner Image (16:9)</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Image URL..."
                                className="flex-grow bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                                value={newSectorNode.cover_image_url}
                                onChange={e => setNewSectorNode({ ...newSectorNode, cover_image_url: e.target.value })}
                              />
                              <label className="cursor-pointer px-3 bg-black hover:bg-black/85 text-[#FFE01A] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center min-w-[75px] h-10">
                                {uploadingStatus['cover_image_url'] ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <span>Upload</span>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleSectorNodeFileUpload(e, 'cover_image_url')}
                                />
                              </label>
                            </div>
                          </div>

                          {/* Logo URL / Upload */}
                          <div className="space-y-2">
                            <label className="text-[9px] text-[#999] tracking-widest uppercase block text-uh-gray-400">Hub Badge Logo Overlay</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Logo URL..."
                                className="flex-grow bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                                value={newSectorNode.logo_url}
                                onChange={e => setNewSectorNode({ ...newSectorNode, logo_url: e.target.value })}
                              />
                              <label className="cursor-pointer px-3 bg-black hover:bg-black/85 text-[#FFE01A] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center min-w-[75px] h-10">
                                {uploadingStatus['logo_url'] ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <span>Upload</span>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleSectorNodeFileUpload(e, 'logo_url')}
                                />
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Custom Color Accent Selection */}
                        <div>
                          <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block font-bold text-black">Branding Custom Color Override</label>
                          <div className="flex items-center gap-3 h-12">
                            {[
                              { hex: '#FFE01A', label: 'YELLOW' },
                              { hex: '#1D4ED8', label: 'BLUE' },
                              { hex: '#10B981', label: 'GREEN' },
                              { hex: '#8B5CF6', label: 'PURPLE' },
                              { hex: '#EF4444', label: 'RED' }
                            ].map(col => (
                              <button
                                key={col.hex}
                                type="button"
                                title={col.label}
                                onClick={() => setNewSectorNode({...newSectorNode, partner_accent: col.hex})}
                                className={`w-9 h-9 rounded-full border-2 transition-transform hover:scale-110 flex items-center justify-center ${newSectorNode.partner_accent === col.hex ? 'border-black scale-110 shadow-md' : 'border-transparent'}`}
                                style={{ backgroundColor: col.hex }}
                              >
                                {newSectorNode.partner_accent === col.hex && (
                                  <span className="w-2.5 h-2.5 bg-black rounded-full" />
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Section 3: Narrative Field "Why This Place Matters" */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">03 · NARRATIVE CAPABILITIES</span>
                        <div>
                          <div className="flex justify-between items-center mb-1.5">
                            <label className="text-[9px] text-[#999] tracking-widest uppercase block">Why this Place Matters (500 limit)</label>
                            <span className="text-[8px] font-mono text-uh-gray-400">{(newSectorNode.why_it_matters || '').length} / 500</span>
                          </div>
                          <textarea
                            rows={4}
                            maxLength={500}
                            className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none resize-none"
                            placeholder='e.g. "Where historic OTR brickwork frames modern local experiences, bringing the neighborhood together over outstanding coffee and conversations."'
                            value={newSectorNode.why_it_matters}
                            onChange={e => setNewSectorNode({...newSectorNode, why_it_matters: e.target.value})}
                          />
                        </div>
                      </div>

                      {/* Section 4: Station History & Partner Stories */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">04 · STATION HISTORY & PARTNER STORIES</span>
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[9px] text-[#999] tracking-widest uppercase block text-uh-gray-400">Founder / Partner Photo URL</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Founder photo URL..."
                                className="flex-grow bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                                value={newSectorNode.founder_photo_url}
                                onChange={e => setNewSectorNode({ ...newSectorNode, founder_photo_url: e.target.value })}
                              />
                              <label className="cursor-pointer px-3 bg-black hover:bg-black/85 text-[#FFE01A] rounded-xl text-[9px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center min-w-[75px] h-10">
                                {uploadingStatus['founder_photo_url'] ? (
                                  <RefreshCw size={12} className="animate-spin" />
                                ) : (
                                  <span>Upload</span>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => handleSectorNodeFileUpload(e, 'founder_photo_url')}
                                />
                              </label>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-1.5 block">Founder Story Narrative</label>
                              <textarea
                                rows={3}
                                className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none resize-none"
                                placeholder="..."
                                value={newSectorNode.founder_story}
                                onChange={e => setNewSectorNode({...newSectorNode, founder_story: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-1.5 block">Building & Location Legacy</label>
                              <textarea
                                rows={3}
                                className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none resize-none"
                                placeholder="..."
                                value={newSectorNode.business_history}
                                onChange={e => setNewSectorNode({...newSectorNode, business_history: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-1.5 block">Community / Local Impact</label>
                              <textarea
                                rows={3}
                                className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none resize-none"
                                placeholder="..."
                                value={newSectorNode.community_impact}
                                onChange={e => setNewSectorNode({...newSectorNode, community_impact: e.target.value})}
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-[#999] tracking-widest uppercase mb-1.5 block">Recommended Local Experience</label>
                              <textarea
                                rows={3}
                                className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none resize-none"
                                placeholder="..."
                                value={newSectorNode.recommended_experience}
                                onChange={e => setNewSectorNode({...newSectorNode, recommended_experience: e.target.value})}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Section 5: Custom Rewards */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">05 · CUSTOM STATION CO-REWARDS</span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block font-bold text-black">Preset Co-Rewards select</label>
                            <div className="flex flex-col gap-1.5">
                              {[
                                '☕ Free Coffee after Check-in',
                                '🥐 Free Baked Pastry on NFC Tap',
                                '🎟️ Free Entry Walk Event Ticket',
                                '📖 Secret OTR Story Unlock',
                                '🎖️ Neighborhood Trailfinder Badge'
                              ].map(tem => (
                                <button
                                  key={tem}
                                  type="button"
                                  onClick={() => setNewSectorNode({...newSectorNode, custom_reward: tem})}
                                  className={`px-3 py-2 text-left rounded-lg text-[10px] font-bold border transition-all ${
                                    newSectorNode.custom_reward === tem
                                      ? 'bg-black text-[#FFE01A] border-black'
                                      : 'bg-uh-gray-50 text-uh-gray-500 border-uh-gray-100 hover:border-uh-gray-200'
                                  }`}
                                >
                                  {tem}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block font-bold text-black font-sans">Custom Reward Text</label>
                            <textarea
                              rows={5}
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none resize-none"
                              placeholder="Describe customized rewards, pass offerings, or special local deals walkers unlock..."
                              value={newSectorNode.custom_reward}
                              onChange={e => setNewSectorNode({...newSectorNode, custom_reward: e.target.value})}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 6: Community Transit Metrics */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">06 · COMMUNITY METRICS INTEGRATION</span>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-[8px] text-[#999] tracking-widest uppercase mb-1.5 block">Total Walkers</label>
                            <input
                              type="number"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.metric_walkers}
                              onChange={e => setNewSectorNode({ ...newSectorNode, metric_walkers: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-[#999] tracking-widest uppercase mb-1.5 block">Total Visits</label>
                            <input
                              type="number"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.metric_visits}
                              onChange={e => setNewSectorNode({ ...newSectorNode, metric_visits: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-[#999] tracking-widest uppercase mb-1.5 block">Events Hosted</label>
                            <input
                              type="number"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.metric_events}
                              onChange={e => setNewSectorNode({ ...newSectorNode, metric_events: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-[#999] tracking-widest uppercase mb-1.5 block font-mono animate-none">Miles Walked</label>
                            <input
                              type="number"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.metric_miles}
                              onChange={e => setNewSectorNode({ ...newSectorNode, metric_miles: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-[#999] tracking-widest uppercase mb-1.5 block">Conversations Shared</label>
                            <input
                              type="number"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.metric_conversations}
                              onChange={e => setNewSectorNode({ ...newSectorNode, metric_conversations: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <label className="text-[8px] text-[#999] tracking-widest uppercase mb-1.5 block font-mono">Stories Documented</label>
                            <input
                              type="number"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.metric_stories}
                              onChange={e => setNewSectorNode({ ...newSectorNode, metric_stories: parseInt(e.target.value) || 0 })}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 7: Co-Branding Partner Recognition */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">07 · CO-BRAND PARTNER RECOGNITION TRAY</span>
                        <div className="grid grid-cols-1 gap-3 text-left">
                          {/* Sponsor logo */}
                          <div className="space-y-1">
                            <label className="text-[8px] text-[#999] tracking-widest uppercase block">Sponsor Logo URL (Optional)</label>
                            <input
                              type="text"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.sponsor_logo_url}
                              onChange={e => setNewSectorNode({ ...newSectorNode, sponsor_logo_url: e.target.value })}
                              placeholder="URL path to sponsor logo"
                            />
                          </div>
                          {/* Partner logo */}
                          <div className="space-y-1">
                            <label className="text-[8px] text-[#999] tracking-widest uppercase block">Station Partner Logo URL (Optional)</label>
                            <input
                              type="text"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.partner_logo_url}
                              onChange={e => setNewSectorNode({ ...newSectorNode, partner_logo_url: e.target.value })}
                              placeholder="URL path to partner logo"
                            />
                          </div>
                          {/* Community logo */}
                          <div className="space-y-1">
                            <label className="text-[8px] text-[#999] tracking-widest uppercase block animate-none">Community Hub Logo URL (Optional)</label>
                            <input
                              type="text"
                              className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-3 py-2 text-[11px] font-bold focus:border-uh-yellow outline-none"
                              value={newSectorNode.community_logo_url}
                              onChange={e => setNewSectorNode({ ...newSectorNode, community_logo_url: e.target.value })}
                              placeholder="URL path to community alliance logo"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Section 8: Station Graphic Gallery */}
                      <div className="bg-white border border-uh-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
                        <span className="text-[9px] font-black tracking-[0.2em] text-[#FFE01A] uppercase block border-b border-uh-gray-50 pb-2">08 · STATION GRAPHICS GALLERY (UP TO 8)</span>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] text-[#999] tracking-widest uppercase block">Add Gallery Photos ({newSectorNode.gallery_urls?.length || 0} / 8)</label>
                            <label className="cursor-pointer px-4 py-2 bg-black hover:bg-black/85 text-[#FFE01A] text-[9px] font-black uppercase tracking-widest rounded-xl">
                              {uploadingStatus['gallery_urls'] ? 'Uploading...' : 'Upload Photos'}
                              <input
                                type="file"
                                multiple
                                accept="image/*"
                                className="hidden"
                                onChange={e => handleSectorNodeFileUpload(e, 'gallery_urls')}
                                disabled={uploadingStatus['gallery_urls'] || (newSectorNode.gallery_urls?.length || 0) >= 8}
                              />
                            </label>
                          </div>

                          {newSectorNode.gallery_urls && newSectorNode.gallery_urls.length > 0 && (
                            <div className="grid grid-cols-4 gap-2 pt-2 animate-in fade-in">
                              {newSectorNode.gallery_urls.map((url, i) => (
                                <div key={url} className="relative group aspect-square rounded-xl overflow-hidden border border-[#eaeaea]">
                                  <img src={url} className="w-full h-full object-cover" />
                                  <button
                                    type="button"
                                    onClick={() => setNewSectorNode({
                                      ...newSectorNode,
                                      gallery_urls: newSectorNode.gallery_urls.filter((_, idx) => idx !== i)
                                    })}
                                    className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center text-[9px] uppercase font-black tracking-widest opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action buttons list */}
                      <div className="flex gap-4 pt-4">
                        <button 
                          onClick={handleAddSectorNode}
                          className="flex-1 py-4 bg-black text-[#FFE01A] text-[10px] font-black tracking-widest uppercase rounded-2xl hover:scale-[1.01] active:scale-[0.98] transition-all shadow-lg font-sans"
                        >
                          {editingNodeId ? '💾 Save Hub Changes' : '✨ Confirm Destination Builders'}
                        </button>
                        <button 
                          type="button"
                          onClick={() => {
                            setShowAddSectorNode(false);
                            setEditingNodeId(null);
                          }}
                          className="px-6 bg-uh-gray-50 text-uh-gray-500 border border-uh-gray-200 text-[10px] font-black tracking-widest uppercase rounded-2xl hover:bg-uh-gray-100 transition-all font-sans"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                    {/* Live Mobile Phone Device Column (Sticky!) */}
                    <div className="lg:col-span-5 lg:sticky lg:top-8 self-start flex flex-col items-center">
                      <span className="text-[9px] font-black tracking-widest uppercase text-uh-gray-400 mb-4 block">LIVE PREVIEW SIMULATOR</span>
                      
                      {/* Interactive mock smartphone framework */}
                      <div className="w-[316px] h-[640px] bg-black rounded-[48px] p-3 shadow-2xl relative border-[6px] border-[#222] overflow-hidden flex flex-col">
                        {/* Device Notch Speaker Capsule */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-5 w-28 bg-black rounded-b-xl z-[60] flex items-center justify-center gap-1.5 pointer-events-none">
                          <div className="w-8 h-0.5 bg-[#2a2a2a] rounded-full" />
                          <div className="w-1.5 h-1.5 bg-[#1f1f1f] rounded-full" />
                        </div>

                        {/* Mobile Screen Container */}
                        <div className={`flex-1 rounded-[36px] overflow-y-auto overflow-x-hidden flex flex-col relative text-[11px] font-sans select-none scrollbar-none pb-8
                          ${newSectorNode.theme_mode === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-white text-uh-black'}`}
                        >
                          {/* Responsive Cover Background image container */}
                          <div className="absolute inset-x-0 top-0 h-[190px] pointer-events-none z-0">
                            {newSectorNode.cover_image_url ? (
                              <img src={newSectorNode.cover_image_url} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-[#1c1c1c] to-[#222]" />
                            )}
                            <div className="absolute inset-0 pointer-events-none" 
                                 style={{
                                   backgroundImage: newSectorNode.theme_mode === 'dark' 
                                     ? 'linear-gradient(to top, #0a0a0a, rgba(10,10,10,0.3) 75%, rgba(0,0,0,0.2))'
                                     : 'linear-gradient(to top, #ffffff, rgba(255,255,255,0.3) 75%, rgba(0,0,0,0.2))'
                                 }}
                            />
                          </div>

                          {/* Top Status Indicators line */}
                          <div className="px-5 pt-3 pb-1 flex justify-between items-center text-[8px] font-black text-white/80 z-50 pointer-events-none">
                            <span>12:26 UTC</span>
                            <div className="flex items-center gap-1 opacity-70">
                              <Wifi size={8} />
                              <span className="font-mono text-[7px]">PRESENCE_HUB</span>
                            </div>
                          </div>

                          {/* Overlaying badge layout */}
                          <div className="px-5 pt-20 pb-3 flex flex-col relative z-20">
                            <div className="flex items-end gap-3.5 mb-2">
                              <div 
                                className={`w-12 h-12 bg-uh-black flex items-center justify-center p-1 text-[10px] font-black border-2
                                  ${newSectorNode.logo_style === 'rounded' ? 'rounded-2xl' : newSectorNode.logo_style === 'square' ? 'rounded-sm' : 'rounded-full'}`}
                                style={{ borderColor: newSectorNode.partner_accent || '#FFE01A' }}
                              >
                                {newSectorNode.logo_url ? (
                                  <img src={newSectorNode.logo_url} className="w-full h-full object-cover rounded-inherit" />
                                ) : (
                                  <span style={{ color: newSectorNode.partner_accent || '#FFE01A' }}>
                                    {newSectorNode.partner_initials || (newSectorNode.name ? newSectorNode.name.slice(0, 2).toUpperCase() : 'AP')}
                                  </span>
                                )}
                              </div>
                              <div className="pb-0.5">
                                <span className="px-1.5 py-0.5 rounded text-[6.5px] font-black uppercase text-black" style={{ backgroundColor: newSectorNode.partner_accent || '#FFE01A' }}>
                                  {newSectorNode.partner_type ? newSectorNode.partner_type.replace('_', ' ').toUpperCase() : 'WALK HQ'}
                                </span>
                                <p className="text-[7.5px] leading-tight text-white/60 font-semibold mt-0.5">VERIFIED SATELLITE</p>
                              </div>
                            </div>

                            {/* Hub Name text block */}
                            <h1 className="text-base font-black uppercase tracking-tight leading-none text-white truncate max-w-[240px]">
                              {newSectorNode.name ? newSectorNode.name.replace(/_HUB/g, '').replace(/_/g, ' ') : 'ALPHA PLAZA'}
                            </h1>
                            <p className="text-[9px] text-white/70 font-semibold font-mono truncate">
                              {newSectorNode.address || 'Over-the-Rhine, Cincinnati, OH'}
                            </p>
                            {newSectorNode.hub_tagline && (
                              <p className="text-[8.5px] text-white/50 italic mt-1 leading-normal max-w-[200px] line-clamp-2">
                                "{newSectorNode.hub_tagline}"
                              </p>
                            )}
                          </div>

                          {/* Signal validation banner bar */}
                          <div className={`px-4 py-1.5 border-y flex items-center justify-between text-[7px] font-semibold tracking-widest z-10
                            ${newSectorNode.theme_mode === 'dark' ? 'border-white/5 bg-white/5 text-white/50' : 'border-uh-black/5 bg-uh-black/5 text-uh-black/50'}`}
                          >
                            <div className="flex items-center gap-1">
                              <span className="w-1 h-1 rounded-full animate-pulse" style={{ backgroundColor: newSectorNode.partner_accent || '#FFE01A' }} />
                              <span>SATELLITE BEACON: ACTIVE</span>
                            </div>
                            <span style={{ color: newSectorNode.partner_accent || '#FFE01A' }}>+50 XP ON DISCOVERY</span>
                          </div>

                          {/* Viewport Core Feed List */}
                          <div className="p-4 space-y-4 relative z-10">
                            {/* Why This Place Matters Card */}
                            {newSectorNode.why_it_matters && (
                              <div className={`p-3 rounded-xl border-l-2 text-[9px] leading-snug
                                ${newSectorNode.theme_mode === 'dark' ? 'bg-white/5 border-white/10 text-white/80' : 'bg-[#fafafa] border-uh-black/10 text-uh-black/80'}`}
                                style={{ borderLeftColor: newSectorNode.partner_accent || '#FFE01A' }}
                              >
                                <span className="text-[6.5px] font-black uppercase tracking-[0.2em] opacity-40 block mb-0.5">WHY THIS PLACE MATTERS</span>
                                <p className="italic">"{newSectorNode.why_it_matters}"</p>
                              </div>
                            )}

                            {/* Reordered card list: Events, Walkers, History, Map */}
                            <div className="grid grid-cols-2 gap-2">
                              {/* 1. Events (Primary Top Left) */}
                              <div className="p-2 w-full rounded-xl border flex flex-col justify-between h-16 bg-black/35 text-white animate-none"
                                   style={{ borderColor: `${newSectorNode.partner_accent || '#FFE01A'}22` }}
                              >
                                <Calendar size={10} className="text-uh-yellow" style={{ color: newSectorNode.partner_accent }} />
                                <div>
                                  <p className="font-bold text-[8px] uppercase tracking-wide leading-none text-white">Events</p>
                                  <p className="text-[6px] font-mono tracking-widest mt-0.5 text-uh-yellow uppercase" style={{ color: newSectorNode.partner_accent }}>3 DEPARTURES</p>
                                </div>
                              </div>

                              {/* 2. Walkers (Primary Top Right) */}
                              <div className="p-2 w-full rounded-xl border flex flex-col justify-between h-16 bg-black/35 text-white"
                                   style={{ borderColor: `${newSectorNode.partner_accent || '#FFE01A'}22` }}
                              >
                                <Users size={10} className="text-white/60" />
                                <div>
                                  <p className="font-bold text-[8px] uppercase tracking-wide leading-none text-white">Walkers</p>
                                  <p className="text-[6px] text-white/40 uppercase tracking-widest mt-0.5">8 RESIDENT</p>
                                </div>
                              </div>

                              {/* 3. History (Secondary Bottom Left) */}
                              <div className={`p-2 w-full rounded-xl border flex flex-col justify-between h-16
                                ${newSectorNode.theme_mode === 'dark' ? 'bg-[#111] border-white/5 text-white' : 'bg-uh-gray-50 border-uh-gray-100 text-uh-black'}`}
                              >
                                <BookOpen size={10} className="opacity-60" />
                                <div>
                                  <p className="font-bold text-[8px] uppercase tracking-wide leading-none">History</p>
                                  <p className="text-[6px] opacity-40 uppercase tracking-widest mt-0.5 font-mono">STATION TALES</p>
                                </div>
                              </div>

                              {/* 4. City Map (Secondary Bottom Right) */}
                              <div className={`p-2 w-full rounded-xl border flex flex-col justify-between h-16
                                ${newSectorNode.theme_mode === 'dark' ? 'bg-[#111] border-white/5 text-white' : 'bg-uh-gray-50 border-uh-gray-100 text-uh-black'}`}
                              >
                                <Map size={10} className="opacity-60" />
                                <div>
                                  <p className="font-bold text-[8px] uppercase tracking-wide leading-none">City Map</p>
                                  <p className="text-[6px] opacity-40 uppercase tracking-widest mt-0.5 font-mono">SECTOR_LOCATOR</p>
                                </div>
                              </div>
                            </div>

                            {/* Rewards Ticket Pass block */}
                            {newSectorNode.custom_reward && (
                              <div className={`p-3 rounded-xl border flex items-center justify-between text-left relative overflow-hidden transition-all
                                ${newSectorNode.theme_mode === 'dark' ? 'bg-white/5 border-white/10 text-white' : 'bg-[#fafafa] border-uh-black/10 text-uh-black'}`}
                                style={{ borderColor: `${newSectorNode.partner_accent || '#FFE01A'}44` }}
                              >
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-black shadow bg-uh-yellow"
                                       style={{ backgroundColor: newSectorNode.partner_accent || '#FFE01A' }}
                                  >
                                    <Star size={10} className="fill-black" />
                                  </div>
                                  <div className="max-w-[170px]">
                                    <h4 className="text-[8px] font-black uppercase tracking-tight">TAP_REWARD_PASS</h4>
                                    <p className="text-[7px] uppercase mt-0.5 font-bold tracking-wider opacity-75 truncate">
                                      {newSectorNode.custom_reward}
                                    </p>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black text-emerald-500 font-mono">+25XP</span>
                              </div>
                            )}

                            {/* Community stats grid */}
                            <div className={`p-3 rounded-xl space-y-2 text-left transition-all
                              ${newSectorNode.theme_mode === 'dark' ? 'bg-[#141414] border border-white/5' : 'bg-[#fafafa] border border-uh-black/5'}`}
                            >
                              <span className="text-[6.5px] font-black tracking-[0.15em] opacity-40 uppercase block font-sans">NETWORK METRIC SYSTEM</span>
                              <div className="grid grid-cols-3 gap-1">
                                <div className="text-center">
                                  <span className="text-[11px] font-black block leading-none" style={{ color: newSectorNode.partner_accent || '#FFE01A' }}>{newSectorNode.metric_walkers}</span>
                                  <span className="text-[6px] text-uh-gray-400 font-mono block mt-1">WALKERS</span>
                                </div>
                                <div className="text-center border-x border-uh-gray-100/10">
                                  <span className="text-[11px] font-black block leading-none" style={{ color: newSectorNode.partner_accent || '#FFE01A' }}>{newSectorNode.metric_miles}</span>
                                  <span className="text-[6px] text-uh-gray-400 font-mono block mt-1">MILES</span>
                                </div>
                                <div className="text-center">
                                  <span className="text-[11px] font-black block leading-none" style={{ color: newSectorNode.partner_accent || '#FFE01A' }}>{newSectorNode.metric_visits}</span>
                                  <span className="text-[6px] text-uh-gray-400 font-mono block mt-1 font-sans">TAP_COUNT</span>
                                </div>
                              </div>
                            </div>

                            {/* Additional Gallery */}
                            {newSectorNode.gallery_urls && newSectorNode.gallery_urls.length > 0 && (
                              <div className="space-y-1 text-left">
                                <span className="text-[6.5px] font-black tracking-[0.15em] opacity-40 uppercase block">STATION SNAPSHOTS</span>
                                <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
                                  {newSectorNode.gallery_urls.map(imgU => (
                                    <img key={imgU} src={imgU} className="w-14 h-10 object-cover rounded bg-black flex-shrink-0" />
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Founder Section */}
                            {(newSectorNode.founder_story || newSectorNode.business_history) && (
                              <div className={`p-3 rounded-xl text-left space-y-2
                                ${newSectorNode.theme_mode === 'dark' ? 'bg-[#141414] border border-white/5' : 'bg-[#fafafa] border border-uh-black/5'}`}
                              >
                                <span className="text-[6.5px] font-black tracking-[0.15em] opacity-40 uppercase block">STATION_HERITAGE</span>
                                {newSectorNode.founder_photo_url && (
                                  <div className="flex items-center gap-2">
                                    <img src={newSectorNode.founder_photo_url} className="w-6 h-6 rounded-full object-cover border" style={{ borderColor: newSectorNode.partner_accent }} />
                                    <span className="text-[7.5px] font-black uppercase text-white/90">FOUNDER PROFILE</span>
                                  </div>
                                )}
                                {newSectorNode.founder_story && (
                                  <p className="text-[8px] opacity-70 leading-relaxed font-semibold">"{newSectorNode.founder_story.slice(0, 75)}..."</p>
                                )}
                              </div>
                            )}

                            {/* Recognition alliances tray */}
                            {(newSectorNode.sponsor_logo_url || newSectorNode.partner_logo_url || newSectorNode.community_logo_url) && (
                              <div className="pt-2 border-t border-uh-gray-100/10 text-center space-y-1.5 pointer-events-none">
                                <span className="text-[6px] font-mono tracking-widest uppercase opacity-45 block">verified alliances</span>
                                <div className="flex justify-center items-center gap-3 h-4">
                                  {newSectorNode.sponsor_logo_url && <img src={newSectorNode.sponsor_logo_url} className="h-full max-w-[30px] object-contain opacity-60 filter invert" />}
                                  {newSectorNode.partner_logo_url && <img src={newSectorNode.partner_logo_url} className="h-full max-w-[30px] object-contain opacity-60 filter invert" />}
                                  {newSectorNode.community_logo_url && <img src={newSectorNode.community_logo_url} className="h-full max-w-[30px] object-contain opacity-60 filter invert" />}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 gap-4">
                {nodes?.sort((a,b) => a.name.localeCompare(b.name)).map(node => (
                  <div key={node.id} className="bg-white border border-[#e0e0e0] rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 group hover:border-[#FFE01A] transition-all">
                    <div className="flex gap-4 items-center">
                      <div 
                        className={`w-12 h-12 bg-black flex items-center justify-center p-1 font-black text-xs border-2
                          ${node.logo_style === 'rounded' ? 'rounded-xl' : node.logo_style === 'square' ? 'rounded-md' : 'rounded-full'}`}
                        style={{ borderColor: node.partner_accent || '#FFE01A', color: node.partner_accent || '#FFE01A' }}
                      >
                        {node.logo_url ? (
                          <img src={node.logo_url} className="w-full h-full object-cover rounded-inherit" referrerPolicy="no-referrer" />
                        ) : (
                          <span>{node.partner_initials || node.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-bold uppercase">{node.name.replace(/_/g, ' ')}</span>
                          <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase text-black" style={{ backgroundColor: node.partner_accent || '#FFE01A' }}>
                            {node.partner_type ? node.partner_type.replace('_', ' ').toUpperCase() : 'STREET'}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono text-[#999] mt-0.5">{node.address || 'No address registered'}</div>
                        <div className="font-mono text-[9px] text-uh-gray-400 mt-0.5 truncate max-w-[200px]"
                             title={`${BASE_URL}/tap/${node.id}`}>
                          /tap/{node.id}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 items-center w-full md:w-auto">
                      <button
                        onClick={() => {
                          const url = `${BASE_URL}/tap/${node.id}`;
                          navigator.clipboard.writeText(url);
                          setHudMessage({ text: `URL_COPIED: ${node.id.toUpperCase()}`, type: 'info' });
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 border border-uh-gray-200 
                                   text-uh-gray-600 hover:border-uh-black hover:text-uh-black 
                                   transition-all text-[9px] font-black tracking-widest uppercase rounded-lg"
                      >
                        Copy URL
                      </button>

                      <a
                        href={`${BASE_URL}/tap/${node.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 border border-uh-gray-200 
                                   text-uh-gray-600 hover:border-uh-black hover:text-uh-black 
                                   transition-all text-[9px] font-black tracking-widest uppercase rounded-lg"
                      >
                        Visit
                      </a>

                      <button
                        onClick={() => setPreviewNodeId(node.id)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-uh-yellow text-uh-black 
                                   hover:bg-yellow-400 transition-all text-[9px] font-black 
                                   tracking-widest uppercase rounded-lg"
                      >
                        Preview
                      </button>

                      {/* Brand Edit Button */}
                      <button
                        onClick={() => {
                          setNewSectorNode({
                            name: node.name || '',
                            address: node.address || '',
                            latitude: node.latitude || 39.1092,
                            longitude: node.longitude || -84.5125,
                            radius_limit: node.radius_limit || 4828,
                            type: node.type || 'street' as any,
                            partner_name: node.partner_name || '',
                            partner_type: (node.partner_type || 'walk_hq') as any,
                            partner_initials: node.partner_initials || '',
                            partner_accent: node.partner_accent || '#FFE01A',
                            hub_tagline: node.hub_tagline || '',
                            cover_image_url: node.cover_image_url || '',
                            logo_url: node.logo_url || '',
                            gallery_urls: node.gallery_urls || [],
                            founder_photo_url: node.founder_photo_url || '',
                            theme_mode: node.theme_mode || 'light',
                            logo_style: node.logo_style || 'circle',
                            why_it_matters: node.why_it_matters || '',
                            founder_story: node.founder_story || '',
                            business_history: node.business_history || '',
                            community_impact: node.community_impact || '',
                            recommended_experience: node.recommended_experience || '',
                            custom_reward: node.custom_reward || '☕ Free Coffee on Check-in',
                            metric_walkers: node.metric_walkers || 1422,
                            metric_visits: node.metric_visits || 4210,
                            metric_events: node.metric_events || 127,
                            metric_miles: node.metric_miles || 8442,
                            metric_conversations: node.metric_conversations || 340,
                            metric_stories: node.metric_stories || 85,
                            partner_logo_url: node.partner_logo_url || '',
                            sponsor_logo_url: node.sponsor_logo_url || '',
                            community_logo_url: node.community_logo_url || ''
                          });
                          setEditingNodeId(node.id);
                          setShowAddSectorNode(true);
                          setTimeout(() => {
                            document.getElementById('sector-builder-container')?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 border border-black text-black hover:bg-black hover:text-[#FFE01A] transition-all text-[9px] font-black tracking-widest uppercase rounded-lg"
                      >
                        Edit Brand
                      </button>

                      {isSuperAdmin && (
                        <button 
                          onClick={() => handleDeleteSectorNode(node.id, node.name)}
                          className="p-2 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg transition-colors ml-auto md:ml-0"
                          title="Erase Sector Node"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-12 border-t border-uh-gray-100">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-[12px] font-bold tracking-widest uppercase text-uh-gray-400 flex items-center gap-2">
                  <Activity size={14} className="text-uh-yellow" />
                  Local_Hubs_Inventory
                </h3>
                {isSuperAdmin && (
                  <button 
                    onClick={() => setShowAddLocalHub(!showAddLocalHub)}
                    className="flex items-center gap-2 px-4 py-2 bg-black text-[#FFE01A] text-[9px] font-black tracking-widest uppercase rounded-lg hover:scale-105 transition-all"
                  >
                    <Plus size={12} />
                    {showAddLocalHub ? 'Cancel' : 'Register Local Hub'}
                  </button>
                )}
              </div>

              {showAddLocalHub && (
                <div className="bg-white border border-uh-gray-200 rounded-2xl p-8 mb-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Hub_Name</label>
                      <input 
                        className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                        value={newLocalHub.name}
                        onChange={e => setNewLocalHub({...newLocalHub, name: e.target.value})}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Address</label>
                      <div className="flex gap-2">
                        <input 
                          className="flex-grow bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                          value={newLocalHub.address}
                          onChange={e => setNewLocalHub({...newLocalHub, address: e.target.value})}
                        />
                        <button 
                          onClick={handleResolveCoordinates}
                          disabled={resolvingCoordinates || !newLocalHub.address}
                          className="px-4 bg-black text-[#FFE01A] rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2"
                        >
                          {resolvingCoordinates ? <Loader2 size={12} className="animate-spin" /> : <MapPin size={12} />}
                          Resolve
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Latitude</label>
                      <input 
                        type="number"
                        step="0.0001"
                        className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                        value={newLocalHub.latitude}
                        onChange={e => setNewLocalHub({...newLocalHub, latitude: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Longitude</label>
                      <input 
                        type="number"
                        step="0.0001"
                        className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                        value={newLocalHub.longitude}
                        onChange={e => setNewLocalHub({...newLocalHub, longitude: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Offer_Text</label>
                      <input 
                        className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                        value={newLocalHub.offer}
                        placeholder="e.g. 50% Off Tacos"
                        onChange={e => setNewLocalHub({...newLocalHub, offer: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">Tier</label>
                      <select 
                        className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                        value={newLocalHub.tier}
                        onChange={e => setNewLocalHub({...newLocalHub, tier: e.target.value as any})}
                      >
                        <option value="free">FREE</option>
                        <option value="paid">PAID</option>
                        <option value="premium">PREMIUM</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[9px] text-[#999] tracking-widest uppercase mb-2 block">CTA_URL</label>
                      <input 
                        className="w-full bg-uh-gray-50 border border-uh-gray-100 rounded-xl px-4 py-3 text-[12px] font-bold focus:border-uh-yellow outline-none"
                        value={newLocalHub.cta_url}
                        onChange={e => setNewLocalHub({...newLocalHub, cta_url: e.target.value})}
                      />
                    </div>

                    {/* ── COVER_IMAGE ── */}
                    <div className="md:col-span-2 flex flex-col gap-4 p-6 bg-white border border-uh-gray-200 rounded-2xl">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">
                          Hub_Cover_Image
                        </label>
                        <div className="flex bg-uh-gray-100 rounded-lg p-1 gap-1">
                          <button
                            type="button"
                            onClick={() => setHubCoverMode('url')}
                            className={`px-3 py-1 text-[9px] font-black rounded-md transition-all 
                              ${hubCoverMode === 'url'
                                ? 'bg-white text-uh-black shadow-sm'
                                : 'text-uh-gray-400 hover:text-uh-gray-600'}`}
                          >
                            DIRECT_LINK
                          </button>
                          <button
                            type="button"
                            onClick={() => setHubCoverMode('upload')}
                            className={`px-3 py-1 text-[9px] font-black rounded-md transition-all 
                              ${hubCoverMode === 'upload'
                                ? 'bg-white text-uh-black shadow-sm'
                                : 'text-uh-gray-400 hover:text-uh-gray-600'}`}
                          >
                            UPLOAD_FILE
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-6 items-start">
                        {/* Preview box */}
                        <div className="w-32 h-32 rounded-xl bg-uh-gray-50 border-2 border-dashed border-uh-gray-200 overflow-hidden flex items-center justify-center shrink-0 relative">
                          {(hubCoverPreview || newLocalHub.cover_url) ? (
                            <>
                              <img
                                src={hubCoverPreview || newLocalHub.cover_url}
                                alt="Cover preview"
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setHubCoverPreview(null);
                                  setNewLocalHub(prev => ({ ...prev, cover_url: '' }));
                                }}
                                className="absolute top-1 right-1 w-5 h-5 bg-black/60 text-white rounded-full text-[10px] flex items-center justify-center hover:bg-uh-magenta transition-all"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-uh-gray-300">
                              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                              </svg>
                              <span className="text-[8px] font-black tracking-widest uppercase">No Cover</span>
                            </div>
                          )}

                          {uploadingHubCover && (
                            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <Loader2 size={18} className="animate-spin text-uh-black"/>
                                <span className="text-[8px] font-black tracking-widest uppercase">Uploading...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Input area */}
                        <div className="flex-1 flex flex-col gap-3">
                          {hubCoverMode === 'url' ? (
                            <input
                              type="text"
                              placeholder="HTTPS://STOREFRONT-IMAGE-URL..."
                              value={newLocalHub.cover_url}
                              onChange={e => {
                                setNewLocalHub(prev => ({ ...prev, cover_url: e.target.value }));
                                setHubCoverPreview(null);
                              }}
                              className="w-full bg-uh-gray-50 border border-uh-gray-200 rounded-xl p-4 text-[12px] font-bold focus:border-uh-yellow outline-none font-mono"
                            />
                          ) : (
                            <>
                              <input
                                type="file"
                                ref={hubCoverInputRef}
                                onChange={handleLocalHubCoverUpload}
                                accept="image/*"
                                className="hidden"
                              />
                              <button
                                type="button"
                                onClick={() => hubCoverInputRef.current?.click()}
                                disabled={uploadingHubCover}
                                className="w-full p-8 border-2 border-dashed border-uh-gray-200 rounded-xl flex flex-col items-center justify-center gap-2 transition-all hover:border-uh-yellow disabled:opacity-50 bg-uh-gray-50"
                              >
                                {uploadingHubCover ? (
                                  <Loader2 size={22} className="animate-spin text-uh-black"/>
                                ) : (
                                  <>
                                    <Upload size={22} className="text-uh-gray-400"/>
                                    <span className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">
                                      Select Storefront Photo
                                    </span>
                                  </>
                                )}
                              </button>
                            </>
                          )}
                          <p className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                            Best results: square or landscape photo of the storefront. PNG · JPG · WEBP — displays on walker-facing hub card.
                          </p>
                        </div>
                      </div>
                    </div>
                    {/* Operating Hours Section */}
                    <div className="mt-8 border-t border-uh-gray-100 pt-6">
                      <label className="text-[10px] text-uh-black tracking-widest uppercase mb-6 block font-black">
                        Targeted_Operating_Hours
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                        {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => {
                          const isClosed = !newLocalHub.operating_hours[day];
                          return (
                            <div key={day} className="flex items-center justify-between gap-4 py-2 border-b border-uh-gray-50 last:border-0 md:border-0">
                              <div className="flex items-center gap-3 w-24">
                                <button 
                                  onClick={() => {
                                    const hours = { ...newLocalHub.operating_hours };
                                    if (isClosed) {
                                      hours[day] = { open: '09:00', close: '17:00' };
                                    } else {
                                      hours[day] = null;
                                    }
                                    setNewLocalHub({ ...newLocalHub, operating_hours: hours });
                                  }}
                                  className={`w-8 h-4 rounded-full relative transition-all ${isClosed ? 'bg-uh-gray-200' : 'bg-teal-500'}`}
                                >
                                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isClosed ? 'left-0.5' : 'left-4.5'}`} />
                                </button>
                                <span className={`text-[9px] font-black uppercase ${isClosed ? 'text-uh-gray-300 line-through' : 'text-uh-gray-600'}`}>{day.slice(0,3)}</span>
                              </div>
                              <div className={`flex items-center gap-2 flex-grow transition-opacity ${isClosed ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                <input 
                                  type="time"
                                  className="bg-uh-gray-50 border border-uh-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none flex-grow focus:border-uh-yellow"
                                  value={newLocalHub.operating_hours?.[day]?.open || '09:00'}
                                  onChange={e => {
                                    const hours = { ...newLocalHub.operating_hours };
                                    if (hours[day]) {
                                      hours[day] = { ...hours[day]!, open: e.target.value };
                                      setNewLocalHub({ ...newLocalHub, operating_hours: hours });
                                    }
                                  }}
                                />
                                <span className="text-[9px] text-uh-gray-300 uppercase font-black">to</span>
                                <input 
                                  type="time"
                                  className="bg-uh-gray-50 border border-uh-gray-100 rounded-lg px-2 py-1.5 text-[11px] font-bold outline-none flex-grow focus:border-uh-yellow"
                                  value={newLocalHub.operating_hours?.[day]?.close || '21:00'}
                                  onChange={e => {
                                    const hours = { ...newLocalHub.operating_hours };
                                    if (hours[day]) {
                                      hours[day] = { ...hours[day]!, close: e.target.value };
                                      setNewLocalHub({ ...newLocalHub, operating_hours: hours });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={handleAddLocalHub}
                    className="mt-8 w-full py-4 bg-uh-yellow text-black text-[10px] font-black tracking-widest uppercase rounded-xl hover:scale-[1.01] transition-all"
                  >
                    Confirm_Hub_Ignition
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4">
                {localHubs.map(hub => (
                  <div key={hub.id} className="bg-white border border-uh-gray-200 rounded-xl p-6 flex justify-between items-center group hover:border-[#FFE01A] transition-all">
                    <div className="flex gap-6 items-center">
                      <div className="w-12 h-12 rounded-lg bg-uh-gray-50 flex items-center justify-center border border-uh-gray-100 uppercase text-[10px] font-black">
                        {hub.tier.slice(0, 1)}
                      </div>
                      <div>
                        <div className="text-[12px] font-bold uppercase mb-1">{hub.name}</div>
                        <div className="flex gap-3 items-center">
                          <span className={`text-[8px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${
                            hub.tier === 'premium' ? 'bg-uh-yellow text-black' : 
                            hub.tier === 'paid' ? 'bg-amber-500 text-white' : 'bg-uh-gray-400 text-white'
                          }`}>{hub.tier}</span>
                          <span className="text-[8px] text-[#999] uppercase tracking-widest font-bold">{hub.offer}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                       {isSuperAdmin && (
                         <button 
                           onClick={() => handleDeleteLocalHub(hub.id, hub.name)}
                           className="p-3 rounded-lg hover:bg-rose-500 hover:text-white transition-colors"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Live Ticker Bar */}
      <LiveTicker 
        taps={taps}
        vibeReports={vibeReports}
        broadcasts={broadcasts}
      />

      {/* ── HUB PREVIEW MODAL ── */}
      {previewNodeId && (
        <div
          className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-sm 
                     flex items-center justify-center p-6"
          onClick={() => setPreviewNodeId(null)}
        >
          <div
            className="relative bg-white border border-uh-gray-200 shadow-2xl
                       flex flex-col"
            style={{ width: 400, height: '88vh', maxHeight: 860 }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 py-3 
                            border-b border-uh-gray-200 bg-black">
              <div className="flex flex-col">
                <span className="text-[8px] font-black tracking-[.2em] 
                                 text-uh-yellow uppercase">
                  WALKER_VIEW · {previewNodeId.toUpperCase()}
                </span>
                <span className="text-[7px] text-white/40 tracking-[.1em] mt-0.5">
                  {BASE_URL}/tap/{previewNodeId}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* Copy from modal */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${BASE_URL}/tap/${previewNodeId}`);
                    setHudMessage({ text: 'URL_COPIED', type: 'info' });
                  }}
                  className="text-[7px] font-black tracking-widest uppercase 
                             text-white/50 hover:text-uh-yellow transition-all px-2 py-1 
                             border border-white/10 hover:border-uh-yellow"
                >
                  ⎘ Copy
                </button>
                {/* Open in new tab from modal */}
                <a
                  href={`${BASE_URL}/tap/${previewNodeId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[7px] font-black tracking-widest uppercase 
                             text-white/50 hover:text-uh-yellow transition-all px-2 py-1 
                             border border-white/10 hover:border-uh-yellow"
                >
                  ↗ Open
                </a>
                {/* Close */}
                <button
                  onClick={() => setPreviewNodeId(null)}
                  className="text-white/50 hover:text-white transition-all 
                             px-2 py-1 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            {/* The actual live departure board in an iframe */}
            <iframe
              src={`${BASE_URL}/tap/${previewNodeId}`}
              className="flex-1 w-full border-none"
              title={`Hub preview: ${previewNodeId}`}
              allow="geolocation"
            />
          </div>
        </div>
      )}
    </div>
  );
};
