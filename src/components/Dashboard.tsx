import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { db, functions, storage } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, setDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { Node, Broadcast, UserProfile, Partner, BroadcastType, HubType, VibeReport, Tap, UserRole, Interaction, TabView } from '../types';
import { BASE_URL } from '../constants';
import { Plus, MapPin, Link as LinkIcon, Send, LayoutDashboard, LogOut, ChevronRight, Globe, ShieldCheck, RefreshCw, BarChart3, Image as ImageIcon, Trash2, RotateCcw, Palette, X } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';
import { LogoUpload } from './LogoUpload';
import { SponsorBadge } from './SponsorBadge';

interface DashboardProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ userProfile, onLogout }) => {
  if (!userProfile) return null;

  const isAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.email === 'vannymwamba@gmail.com';
  const isPartner = ['partner', 'partner_admin', 'partner_viewer', 'partner_content_editor'].includes(userProfile.role) || (isAdmin && !!(userProfile.partnerId || userProfile.partner_id));
  const canWrite = isAdmin || ['partner', 'partner_admin', 'partner_content_editor'].includes(userProfile.role);
  const isViewer = userProfile.role === 'partner_viewer';

  const [nodes, setNodes] = useState<Node[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [vibeReports, setVibeReports] = useState<VibeReport[]>([]);
  const [taps, setTaps] = useState<Tap[]>([]);
  const [tabViews, setTabViews] = useState<TabView[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  
  // Form states
  const [newNode, setNewNode] = useState({ name: '', type: 'street' as HubType, address: '', lat: 0, lng: 0, radius: 500 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [editingBroadcastId, setEditingBroadcastId] = useState<string | null>(null);
  const [newBroadcast, setNewBroadcast] = useState({ 
    title: '', 
    type: BroadcastType.LIVE_EVENT, 
    nodeId: '', 
    startTimeOffset: 0, 
    duration: 60, 
    partnerId: '',
    locationSource: 'node' as 'node' | 'partner'
  });
  const [newPartner, setNewPartner] = useState({ 
    name: '', 
    tier: 'standard' as Partner['tier'], 
    address: '', 
    lat: 0, 
    lng: 0, 
    owner_email: '',
    role: 'partner_admin' as UserRole,
    logoUrl: '',
    logoUpdatedAt: null as string | null,
    brandColor: '#00FF00',
    dealText: '',
    sponsorZones: [] as string[]
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isSyncingLibrary, setIsSyncingLibrary] = useState(false);
  const [isSyncingCivic, setIsSyncingCivic] = useState(false);
  
  // New Broadcast fields
  const [broadcastImageUrl, setBroadcastImageUrl] = useState('');
  const [broadcastImageMode, setBroadcastImageMode] = useState<'url' | 'upload'>('url');
  const [broadcastAddress, setBroadcastAddress] = useState('');
  const [broadcastCustomLat, setBroadcastCustomLat] = useState<number | null>(null);
  const [broadcastCustomLng, setBroadcastCustomLng] = useState<number | null>(null);
  const [isUploadingBroadcastImage, setIsUploadingBroadcastImage] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'hubs' | 'broadcasts' | 'partners' | 'analytics' | 'profile'>(isAdmin ? 'hubs' : 'broadcasts');
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  const [now, setNow] = useState(new Date());
  
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const editId = params.get('editBroadcastId');
    if (editId) {
      setActiveTab('broadcasts');
      setEditingBroadcastId(editId);
    }
  }, [location.search]);

  useEffect(() => {
    if (editingBroadcastId && broadcasts.length > 0) {
      const b = broadcasts.find(b => b.id === editingBroadcastId);
      if (b) {
        setNewBroadcast({
          title: b.title,
          type: b.type,
          nodeId: b.nodeId || b.node_id || '',
          startTimeOffset: 0,
          duration: 60,
          partnerId: b.partnerId || b.partner_id || '',
          locationSource: b.address ? 'node' : 'partner'
        });
        setBroadcastImageUrl(b.cover_url || b.imageUrl || '');
        setBroadcastAddress(b.address || '');
        setBroadcastCustomLat(b.latitude || null);
        setBroadcastCustomLng(b.longitude || null);
      }
    }
  }, [editingBroadcastId, broadcasts]);

  const parseDate = (val: any): Date => {
    if (!val) return new Date(0);
    if (val instanceof Date) return val;
    if (typeof val.toDate === 'function') return val.toDate();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date(0) : d;
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // Update every 30s
    return () => clearInterval(timer);
  }, []);

  const getRemainingTime = (b: Broadcast) => {
    if (!b.starts_at || !b.expires_at) return 'TIME_UNKNOWN';
    const now = new Date();
    const start = parseDate(b.starts_at);
    const expiry = parseDate(b.expires_at);

    if (start.getTime() === 0 || expiry.getTime() === 0) return 'INVALID_TIME';

    if (now < start) {
      const diff = start.getTime() - now.getTime();
      const mins = Math.floor(diff / 60000);
      const hrs = Math.floor(mins / 60);
      if (hrs > 0) return `STARTS IN ${hrs}H ${mins % 60}M`;
      return `STARTS IN ${mins}M`;
    }

    const diff = expiry.getTime() - now.getTime();
    if (diff <= 0) return 'EXPIRED';
    
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    
    if (hrs > 0) return `${hrs}H ${mins % 60}M REMAINING`;
    return `${mins}M REMAINING`;
  };

  useEffect(() => {
    if (hudMessage) {
      const timer = setTimeout(() => setHudMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [hudMessage]);

  useEffect(() => {
    if (isAdmin) {
      // Only listen to the collections relevant to the active tab
      const unsubscribers: (() => void)[] = [];

      if (activeTab === 'hubs') {
        unsubscribers.push(onSnapshot(collection(db, 'nodes'), (snap) => {
          setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Node)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'nodes')));
      }

      if (activeTab === 'partners') {
        unsubscribers.push(onSnapshot(collection(db, 'partners'), (snap) => {
          setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Partner)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'partners')));
      }

      if (activeTab === 'broadcasts') {
        unsubscribers.push(onSnapshot(collection(db, 'broadcasts'), (snap) => {
          setBroadcasts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'broadcasts')));
        unsubscribers.push(onSnapshot(collection(db, 'nodes'), (snap) => {
          setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Node)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'nodes')));
      }

      if (activeTab === 'analytics') {
        const vibesQuery = query(collection(db, 'vibe_reports'), orderBy('reported_at', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(vibesQuery, (snap) => {
          setVibeReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as VibeReport)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'vibe_reports')));

        const tapsQuery = query(collection(db, 'taps'), orderBy('timestamp', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(tapsQuery, (snap) => {
          setTaps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tap)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'taps')));

        const viewsQuery = query(collection(db, 'tab_views'), orderBy('timestamp', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(viewsQuery, (snap) => {
          setTabViews(snap.docs.map(d => ({ id: d.id, ...d.data() } as TabView)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'tab_views')));

        const interactionsQuery = query(collection(db, 'interactions'), orderBy('timestamp', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(interactionsQuery, (snap) => {
          setInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Interaction)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'interactions')));
      }

      return () => unsubscribers.forEach(unsub => unsub());
    }
    else if (isPartner && (userProfile.partnerId || userProfile.partner_id)) {
      const pId = userProfile.partnerId || userProfile.partner_id;
      
      const unsubBroadcasts = onSnapshot(
        query(collection(db, 'broadcasts'), where('partnerId', '==', pId)),
        (snap) => {
          setBroadcasts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'broadcasts')
      );

      const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) => {
        setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Node)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'nodes'));

      const unsubPartner = onSnapshot(doc(db, 'partners', pId!), (snap) => {
        if (snap.exists()) {
          setPartners([{ id: snap.id, ...snap.data() } as Partner]);
        }
      }, (err) => handleFirestoreError(err, OperationType.GET, `partners/${pId}`));

      const unsubscribers: (() => void)[] = [];
      if (activeTab === 'analytics') {
        const vibesQuery = query(collection(db, 'vibe_reports'), where('sponsor_id', '==', pId), orderBy('reported_at', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(vibesQuery, (vSnap) => {
          setVibeReports(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VibeReport)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'vibe_reports')));

        const tapsQuery = query(collection(db, 'taps'), where('sponsor_id', '==', pId), orderBy('timestamp', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(tapsQuery, (snap) => {
          setTaps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tap)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'taps')));

        const interactionsQuery = query(collection(db, 'interactions'), where('sponsor_id', '==', pId), orderBy('timestamp', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(interactionsQuery, (snap) => {
          setInteractions(snap.docs.map(d => ({ id: d.id, ...d.data() } as Interaction)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'interactions')));

        const viewsQuery = query(collection(db, 'tab_views'), where('sponsor_id', '==', pId), orderBy('timestamp', 'desc'), limit(200));
        unsubscribers.push(onSnapshot(viewsQuery, (snap) => {
          setTabViews(snap.docs.map(d => ({ id: d.id, ...d.data() } as TabView)));
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'tab_views')));
      }

      return () => { 
        unsubBroadcasts(); 
        unsubNodes(); 
        unsubPartner(); 
        unsubscribers.forEach(unsub => unsub());
      };
    }
  }, [userProfile, isAdmin, isPartner, activeTab]);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    const id = editingNodeId || newNode.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    if (!id) {
      setHudMessage({ text: "INVALID_HUB_NAME", type: 'error' });
      return;
    }
    try {
      await setDoc(doc(db, 'nodes', id), {
        name: newNode.name,
        type: newNode.type,
        address: newNode.address,
        latitude: Number(newNode.lat),
        longitude: Number(newNode.lng),
        radius_limit: Number(newNode.radius)
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `nodes/${id}`);
    }
    setHudMessage({ text: editingNodeId ? `HUB_RECONFIGURED: ${newNode.name.toUpperCase()}` : `HUB_IGNITED: ${newNode.name.toUpperCase()}`, type: 'info' });
    setNewNode({ name: '', type: 'street', address: '', lat: 0, lng: 0, radius: 500 });
    setEditingNodeId(null);
  };

  const handleGeocodeNode = async () => {
    if (!newNode.address) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(newNode.address)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'SERVER_ERROR' }));
        throw new Error(errorData.error || 'GEOCODING_FAILED');
      }

      const data = await response.json();
      if (data && data.lat && data.lon) {
        setNewNode({
          ...newNode,
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lon)
        });
        setHudMessage({ text: "COORDINATES_RESOLVED", type: 'info' });
      } else {
        setHudMessage({ text: "ADDRESS_NOT_FOUND", type: 'error' });
      }
    } catch (err: any) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: `GEOCODING_FAILURE: ${err.message || 'UNKNOWN'}`, type: 'error' });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleRestoreData = async () => {
    if (!isAdmin) return;
    if (!window.confirm("WARNING: This will re-seed the system with initial tactical data. Existing data will be preserved but duplicates may occur. Proceed?")) return;
    
    setIsSeeding(true);
    setHudMessage({ text: "RESTORING_SYSTEM_DATA...", type: 'info' });
    
    try {
      // We use the handleSeed exposed on window in App.tsx
      if ((window as any).handleSeed) {
        await (window as any).handleSeed();
      } else {
        throw new Error("SEED_FUNCTION_NOT_FOUND");
      }
    } catch (err) {
      console.error("Restore error:", err);
      setHudMessage({ text: "RESTORE_FAILED", type: 'error' });
    } finally {
      setIsSeeding(false);
    }
  };

  const handleSyncLibrary = async () => {
    if (!isAdmin) return;
    setIsSyncingLibrary(true);
    setHudMessage({ text: "SYNCING_LIBRARY_EVENTS...", type: 'info' });
    try {
      const response = await fetch('/api/admin/sync-library-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'SYNC_FAILED');
      }
      
      const data = await response.json();
      setHudMessage({ text: `SYNC_COMPLETE: ${data.count} EVENTS_LOADED`, type: 'info' });
    } catch (err: any) {
      console.error("Library sync error:", err);
      setHudMessage({ text: `SYNC_FAILED: ${err.message || 'INTERNAL_ERROR'}`, type: 'error' });
    } finally {
      setIsSyncingLibrary(false);
    }
  };

  const handleSyncCivic = async () => {
    if (!isAdmin) return;
    setIsSyncingCivic(true);
    setHudMessage({ text: "SYNCING_CIVIC_EVENTS...", type: 'info' });
    try {
      const response = await fetch('/api/admin/sync-civic-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'SYNC_FAILED');
      }
      
      const data = await response.json();
      setHudMessage({ text: `SYNC_COMPLETE: ${data.processed} EVENTS_LOADED`, type: 'info' });
    } catch (err: any) {
      console.error("Civic sync error:", err);
      setHudMessage({ text: `SYNC_FAILED: ${err.message || 'INTERNAL_ERROR'}`, type: 'error' });
    } finally {
      setIsSyncingCivic(false);
    }
  };

  const handleBroadcastImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingBroadcastImage(true);
    try {
      const timestamp = Date.now();
      const storagePath = `broadcasts/${timestamp}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      const uploadTask = await uploadBytesResumable(storageRef, file);
      const downloadURL = await getDownloadURL(uploadTask.ref);
      setBroadcastImageUrl(downloadURL);
      setHudMessage({ text: 'IMAGE_UPLOAD_SUCCESS', type: 'info' });
    } catch (err) {
      console.error('Broadcast image upload error:', err);
      setHudMessage({ text: 'UPLOAD_FAILED', type: 'error' });
    } finally {
      setIsUploadingBroadcastImage(false);
    }
  };

  const handleResolveBroadcastAddress = async () => {
    if (!broadcastAddress) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(broadcastAddress)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'SERVER_ERROR' }));
        throw new Error(errorData.error || 'GEOCODING_FAILED');
      }

      const data = await response.json();
      if (data && data.lat && data.lon) {
        setBroadcastCustomLat(parseFloat(data.lat));
        setBroadcastCustomLng(parseFloat(data.lon));
        setHudMessage({ text: "COORDINATES_RESOLVED", type: 'info' });
      } else {
        setHudMessage({ text: "ADDRESS_NOT_FOUND", type: 'error' });
      }
    } catch (err: any) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: `GEOCODING_FAILURE: ${err.message || 'UNKNOWN'}`, type: 'error' });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleDeleteBroadcast = async (broadcastId: string, title: string) => {
    if (!isAdmin && !isPartner) return;
    if (!window.confirm(`CRITICAL: Are you sure you want to terminate the signal for ${title?.toUpperCase() || 'UNKNOWN'}? This will remove it from the live board immediately.`)) return;

    try {
      await deleteDoc(doc(db, 'broadcasts', broadcastId));
      setHudMessage({ text: `SIGNAL_TERMINATED: ${title?.toUpperCase() || 'UNKNOWN'}`, type: 'info' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `broadcasts/${broadcastId}`);
    }
  };

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isPartner) return;

    const startsAt = new Date(Date.now() + newBroadcast.startTimeOffset * 60000).toISOString();
    const expiresAt = new Date(new Date(startsAt).getTime() + newBroadcast.duration * 60000).toISOString();
    
    const partnerId = isAdmin ? (newBroadcast.partnerId || 'admin') : (userProfile.partnerId || userProfile.partner_id || 'admin');
    const partner = partners.find(p => p.id === partnerId);
    const targetNode = nodes.find(n => n.id === newBroadcast.nodeId);
    
    // Explicitly choose location based on source
    let latitude = broadcastCustomLat !== null ? broadcastCustomLat : 0;
    let longitude = broadcastCustomLng !== null ? broadcastCustomLng : 0;
    let address = broadcastAddress || '';
    let nodeId = newBroadcast.nodeId;

    if (broadcastCustomLat === null) {
      if (newBroadcast.locationSource === 'partner' && partner) {
        latitude = partner.latitude;
        longitude = partner.longitude;
        address = broadcastAddress || partner.address || '';
      } else if (targetNode) {
        latitude = targetNode.latitude;
        longitude = targetNode.longitude;
        address = broadcastAddress || targetNode.address || '';
      } else if (newBroadcast.locationSource === 'partner' && partnerId === 'admin') {
        // Fallback for system broadcast with partner source: use a default or current node
        const defaultNode = nodes[0];
        if (defaultNode) {
          latitude = defaultNode.latitude;
          longitude = defaultNode.longitude;
          address = broadcastAddress || defaultNode.address || '';
          nodeId = defaultNode.id;
        }
      }
    }
    
    try {
      const broadcastData = {
        title: newBroadcast.title,
        type: newBroadcast.type,
        nodeId: nodeId,
        node_id: nodeId,
        partnerId: partnerId,
        partner_id: partnerId,
        latitude,
        longitude,
        address,
        startsAt: startsAt,
        starts_at: startsAt,
        expiresAt: expiresAt,
        expires_at: expiresAt,
        currentVibe: 'chill',
        current_vibe: 'chill',
        active: true,
        cover_url: broadcastImageUrl
      };

      if (editingBroadcastId) {
        await updateDoc(doc(db, 'broadcasts', editingBroadcastId), broadcastData);
        setHudMessage({ text: `SIGNAL_RECONFIGURED: ${newBroadcast.title.toUpperCase()}`, type: 'info' });
      } else {
        await addDoc(collection(db, 'broadcasts'), broadcastData);
        setHudMessage({ text: `SIGNAL_TRANSMITTED: ${newBroadcast.title.toUpperCase()}`, type: 'info' });
      }
    } catch (err) {
      handleFirestoreError(err, editingBroadcastId ? OperationType.UPDATE : OperationType.CREATE, editingBroadcastId ? `broadcasts/${editingBroadcastId}` : 'broadcasts');
    }
    
    setNewBroadcast({ title: '', type: BroadcastType.LIVE_EVENT, nodeId: '', startTimeOffset: 0, duration: 60, partnerId: '', locationSource: 'node' });
    setBroadcastImageUrl('');
    setBroadcastAddress('');
    setBroadcastCustomLat(null);
    setBroadcastCustomLng(null);
    setEditingBroadcastId(null);
  };

  const handleRepublish = async (b: Broadcast) => {
    const bPartnerId = b.partnerId || b.partner_id;
    const userPartnerId = userProfile.partnerId || userProfile.partner_id;
    if (!isAdmin && userPartnerId !== bPartnerId) return;

    const duration = 60; // Default 60 mins for republish
    const startsAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + duration * 60000).toISOString();
    
    const bNodeId = b.nodeId || b.node_id;
    
    try {
      await addDoc(collection(db, 'broadcasts'), {
        title: b.title,
        type: b.type,
        nodeId: bNodeId,
        node_id: bNodeId,
        partnerId: bPartnerId,
        partner_id: bPartnerId,
        latitude: b.latitude,
        longitude: b.longitude,
        address: b.address,
        startsAt: startsAt,
        starts_at: startsAt,
        expiresAt: expiresAt,
        expires_at: expiresAt,
        currentVibe: 'chill',
        current_vibe: 'chill'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'broadcasts');
    }
    setHudMessage({ text: `SIGNAL_REBROADCAST: ${b.title?.toUpperCase() || 'UNKNOWN'}`, type: 'info' });
  };

  const handleGeocode = async () => {
    if (!newPartner.address) return;
    setIsGeocoding(true);
    try {
      const response = await fetch(`/api/geocode?address=${encodeURIComponent(newPartner.address)}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'SERVER_ERROR' }));
        throw new Error(errorData.error || 'GEOCODING_FAILED');
      }

      const data = await response.json();
      if (data && data.lat && data.lon) {
        setNewPartner({
          ...newPartner,
          lat: parseFloat(data.lat),
          lng: parseFloat(data.lon)
        });
        setHudMessage({ text: "COORDINATES_RESOLVED", type: 'info' });
      } else {
        setHudMessage({ text: "ADDRESS_NOT_FOUND", type: 'error' });
      }
    } catch (err: any) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: `GEOCODING_FAILURE: ${err.message || 'UNKNOWN'}`, type: 'error' });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleCreatePartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const id = editingPartnerId || generatePartnerId(newPartner.name);
    
    if (!id) {
      setHudMessage({ text: "INVALID_PARTNER_NAME", type: 'error' });
      return;
    }
    
    try {
      // 1. Create/Update Partner document
      const partnerPayload = {
        name: newPartner.name,
        tier: newPartner.tier.toLowerCase(), // Must be lowercase to pass 'premium' rule
        latitude: parseFloat(newPartner.lat.toString()),  // Must be cast to number, not string
        longitude: parseFloat(newPartner.lng.toString()),// Must be cast to number, not string
        owner_email: newPartner.owner_email.toLowerCase().trim(), // Must use the key 'owner_email'
        logo_url: newPartner.logoUrl || null,
        brand_color: newPartner.brandColor || null,
        deal_text: newPartner.dealText || null,
        sponsor_zones: newPartner.sponsorZones,
        updatedAt: serverTimestamp(),
        ...(editingPartnerId ? {} : { createdAt: serverTimestamp() })
      };

      await setDoc(doc(db, 'partners', id), partnerPayload, { merge: true });

      // 2. Clear old owner(s) if we are editing (to handle reassignment)
      if (editingPartnerId) {
        const oldUsersQuery = query(collection(db, 'users'), where('partnerId', '==', editingPartnerId));
        const oldUsersSnap = await getDocs(oldUsersQuery);
        for (const userDoc of oldUsersSnap.docs) {
          const userData = userDoc.data();
          const isTargetAdmin = userData.role === 'admin' || userData.role === 'super_admin' || userData.email === 'vannymwamba@gmail.com';
          
          // Only clear if the email is NOT the new owner email
          if (userData.email.toLowerCase().trim() !== newPartner.owner_email.toLowerCase().trim()) {
            await setDoc(doc(db, 'users', userDoc.id), {
              role: isTargetAdmin ? userData.role : 'user',
              partnerId: null
            }, { merge: true });
          }
        }
      }

      // 3. Update User Profile if a user with this email already exists
      const userQuery = query(collection(db, 'users'), where('email', '==', newPartner.owner_email.toLowerCase().trim()));
      let userSnap;
      try {
        userSnap = await getDocs(userQuery);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
        return;
      }
      
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        const userData = userDoc.data();
        const isTargetAdmin = userData.role === 'admin' || userData.role === 'super_admin' || userData.email === 'vannymwamba@gmail.com';
        
        try {
          await setDoc(doc(db, 'users', userDoc.id), {
            role: isTargetAdmin ? userData.role : newPartner.role,
            partnerId: id
          }, { merge: true });
          
          // Also link the partner to the user's UID for storage rules
          await updateDoc(doc(db, 'partners', id), {
            associated_owner_uid: userDoc.id
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${userDoc.id}`);
        }
      }

      setHudMessage({ text: editingPartnerId ? `PARTNER_RECONFIGURED: ${newPartner.name.toUpperCase()}` : `PARTNER_ONBOARDED: ${newPartner.name.toUpperCase()}`, type: 'info' });
      setNewPartner({ 
        name: '', 
        tier: 'standard', 
        address: '', 
        lat: 0, 
        lng: 0, 
        owner_email: '',
        role: 'partner_admin',
        logoUrl: '',
        logoUpdatedAt: null,
        brandColor: '#00FF00',
        dealText: '',
        sponsorZones: []
      });
      setEditingPartnerId(null);
    } catch (err) {
      console.error("Partner creation/update error:", err);
      handleFirestoreError(err, editingPartnerId ? OperationType.UPDATE : OperationType.CREATE, editingPartnerId ? `partners/${editingPartnerId}` : 'partners');
      setHudMessage({ text: editingPartnerId ? "PARTNER_UPDATE_FAILED" : "PARTNER_CREATION_FAILED", type: 'error' });
    }
  };

  const handleDeletePartner = async (partnerId: string, partnerName: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`CRITICAL: Are you sure you want to terminate the partnership with ${partnerName?.toUpperCase() || 'UNKNOWN'}? This will remove their access and branding from the network.`)) return;

    try {
      await deleteDoc(doc(db, 'partners', partnerId));
      
      // Also find and update the user who was the owner
      const userQuery = query(collection(db, 'users'), where('partner_id', '==', partnerId));
      const userSnap = await getDocs(userQuery);
      
      for (const userDoc of userSnap.docs) {
        const userData = userDoc.data();
        const isTargetAdmin = userData.role === 'admin' || userData.role === 'super_admin' || userData.email === 'vannymwamba@gmail.com';
        
        await updateDoc(doc(db, 'users', userDoc.id), {
          role: isTargetAdmin ? userData.role : 'user',
          partner_id: null
        });
      }

      setHudMessage({ text: `PARTNER_TERMINATED: ${partnerName?.toUpperCase() || 'UNKNOWN'}`, type: 'info' });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `partners/${partnerId}`);
    }
  };

  const handleResetBranding = async () => {
    const pId = userProfile.partnerId || userProfile.partner_id;
    if (!pId || !canWrite) return;

    if (!window.confirm("CRITICAL: This will wipe your custom branding (logo, color, and deal text) and restore system defaults. Proceed?")) return;

    try {
      await updateDoc(doc(db, 'partners', pId), {
        logo_url: null,
        logoUrl: null,
        brand_color: '#C4832A',
        brandColor: '#C4832A',
        deal_text: '',
        dealText: '',
        logo_updated_at: serverTimestamp(),
        logoUpdatedAt: new Date().toISOString()
      });
      setHudMessage({ text: 'BRANDING_RESTORED_TO_DEFAULTS', type: 'info' });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `partners/${pId}`);
    }
  };

  const generatePartnerId = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  return (
    <div className="min-h-screen bg-white text-uh-black flex flex-col font-sans">
      {/* Sidebar / Header */}
      <header className="border-b border-uh-gray-200 p-6 flex justify-between items-center bg-uh-black text-white">
        <div className="flex items-center gap-4">
          <div className="bg-uh-yellow text-uh-black p-2 font-black text-xl">U</div>
          <div>
            <div className="text-[10px] text-uh-yellow font-bold tracking-[0.3em]">URBAN_HIKERS // CONTROL_CENTER</div>
            <div className="text-xs opacity-60 uppercase tracking-widest">{userProfile.role} ACCESS: {userProfile.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="/tap/OTR-ALPHA-01" 
            className="flex items-center gap-2 text-uh-yellow hover:bg-uh-yellow/10 px-4 py-2 border border-uh-yellow/20 transition-all text-xs font-bold"
          >
            <Globe size={16} /> VIEW_LIVE_BOARD
          </a>
          <a 
            href="/creator/ignite" 
            className="flex items-center gap-2 text-white hover:bg-white/10 px-4 py-2 border border-white/20 transition-all text-xs font-bold"
          >
            <Send size={16} /> CREATOR_IGNITE
          </a>
          {isAdmin && (
            <a 
              href="/admin/mural" 
              className="flex items-center gap-2 text-uh-yellow hover:bg-uh-yellow/10 px-4 py-2 border border-uh-yellow/20 transition-all text-xs font-bold"
            >
              <Palette size={16} /> MURAL_ADMIN
            </a>
          )}
          <button onClick={onLogout} className="flex items-center gap-2 text-white hover:bg-white/10 px-4 py-2 border border-white/20 transition-all text-xs font-bold">
            <LogOut size={16} /> TERMINATE_SESSION
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation */}
        <nav className="w-64 border-r border-uh-gray-200 p-4 flex flex-col gap-2 bg-uh-gray-50">
          {(isAdmin || isPartner) && (
            <button 
              onClick={() => setActiveTab('hubs')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all rounded-lg ${activeTab === 'hubs' ? 'bg-uh-yellow text-uh-black shadow-sm' : 'hover:bg-uh-gray-100 text-uh-gray-600'}`}
            >
              <Globe size={18} /> SECTOR_HUBS
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('partners')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all rounded-lg ${activeTab === 'partners' ? 'bg-uh-yellow text-uh-black shadow-sm' : 'hover:bg-uh-gray-100 text-uh-gray-600'}`}
            >
              <ShieldCheck size={18} /> PARTNER_NETWORK
            </button>
          )}
          <button 
            onClick={() => setActiveTab('broadcasts')}
            className={`flex items-center gap-3 p-3 text-sm font-bold transition-all rounded-lg ${activeTab === 'broadcasts' ? 'bg-uh-yellow text-uh-black shadow-sm' : 'hover:bg-uh-gray-100 text-uh-gray-600'}`}
          >
            <Send size={18} /> LIVE_BROADCASTS
          </button>
          {(isPartner || isAdmin) && (
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all rounded-lg ${activeTab === 'analytics' ? 'bg-uh-yellow text-uh-black shadow-sm' : 'hover:bg-uh-gray-100 text-uh-gray-600'}`}
            >
              <BarChart3 size={18} /> {isAdmin ? 'SYSTEM_ANALYTICS' : 'SIGNAL_ANALYTICS'}
            </button>
          )}
          {isPartner && (
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all rounded-lg ${activeTab === 'profile' ? 'bg-uh-yellow text-uh-black shadow-sm' : 'hover:bg-uh-gray-100 text-uh-gray-600'}`}
            >
              <ShieldCheck size={18} /> {isAdmin ? 'MY_PARTNER_PROFILE' : 'MY_PROFILE'}
            </button>
          )}
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-white relative">
          {/* HUD Notifications */}
          <div className="fixed top-24 right-8 z-[100] flex flex-col gap-2">
            {hudMessage && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`px-6 py-3 rounded-xl font-bold text-xs tracking-widest shadow-2xl border ${
                  hudMessage.type === 'error' 
                    ? 'bg-uh-black text-uh-magenta border-uh-magenta/20' 
                    : 'bg-uh-black text-uh-yellow border-uh-yellow/20'
                }`}
              >
                {hudMessage.text}
              </motion.div>
            )}
          </div>

          {/* Content Tabs */}
          {activeTab === 'hubs' && (isAdmin || isPartner) && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-uh-gray-200 pb-6">
                <h2 className="text-3xl font-black tracking-tighter text-uh-black">SECTOR_HUB_MANAGEMENT</h2>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-4 mb-2">
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSyncLibrary}
                          disabled={isSyncingLibrary}
                          className="flex items-center gap-2 px-4 py-2 border border-uh-gray-200 text-uh-gray-800 text-[10px] font-black tracking-widest hover:bg-uh-gray-100 transition-all disabled:opacity-50 rounded-lg"
                        >
                          <RefreshCw size={12} className={isSyncingLibrary ? 'animate-spin' : ''} />
                          SYNC_LIBRARY
                        </button>
                        <button 
                          onClick={handleSyncCivic}
                          disabled={isSyncingCivic}
                          className="flex items-center gap-2 px-4 py-2 border border-uh-gray-200 text-uh-gray-800 text-[10px] font-black tracking-widest hover:bg-uh-gray-100 transition-all disabled:opacity-50 rounded-lg"
                        >
                          <RefreshCw size={12} className={isSyncingCivic ? 'animate-spin' : ''} />
                          SYNC_CIVIC
                        </button>
                        <button 
                          onClick={handleRestoreData}
                          disabled={isSeeding}
                          className="flex items-center gap-2 px-4 py-2 bg-uh-yellow text-uh-black text-[10px] font-black tracking-widest hover:bg-uh-yellow/80 transition-all disabled:opacity-50 rounded-lg shadow-sm"
                        >
                          <RefreshCw size={12} className={isSeeding ? 'animate-spin' : ''} />
                          RESTORE_DATA
                        </button>
                      </div>
                    )}
                    <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">
                      {isAdmin ? `ACTIVE_NODES: ${nodes.length}` : `HOSTING_HUBS: ${nodes.filter(n => broadcasts.some(b => b.node_id === n.id)).length}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Create/Edit Node Form - Admin Only */}
              {isAdmin && (
                <form onSubmit={handleCreateNode} className="bg-uh-gray-50 border border-uh-gray-200 rounded-2xl p-8 mb-10 grid grid-cols-2 gap-6 shadow-sm">
                  <div className="col-span-2 flex justify-between items-center mb-2">
                    <div className="text-[11px] text-uh-black font-black tracking-[0.2em] uppercase">
                      {editingNodeId ? 'RECONFIGURE_EXISTING_HUB' : 'GENERATE_NEW_HUB'}
                    </div>
                    {editingNodeId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingNodeId(null);
                          setNewNode({ name: '', type: 'street', address: '', lat: 0, lng: 0, radius: 500 });
                        }}
                        className="text-[10px] text-uh-magenta font-bold hover:underline"
                      >
                        CANCEL_EDIT
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Hub_Identity</label>
                    <input 
                      placeholder="HUB_NAME (e.g. OTR North)"
                      className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all text-uh-black font-medium"
                      value={newNode.name}
                      onChange={e => setNewNode({...newNode, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Hub_Type</label>
                    <select 
                      className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all text-uh-black font-medium appearance-none"
                      value={newNode.type}
                      onChange={e => setNewNode({...newNode, type: e.target.value as HubType})}
                    >
                      <option value="street">STREET_LEVEL</option>
                      <option value="conference_center">CONFERENCE_HUB</option>
                    </select>
                  </div>

                  <div className="col-span-2 flex flex-col gap-2">
                    <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Physical_Address (Tactical_Location)</label>
                    <div className="flex gap-3">
                      <input 
                        placeholder="123 Main St, Cincinnati, OH"
                        className="flex-1 bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all text-uh-black font-medium"
                        value={newNode.address}
                        onChange={e => setNewNode({...newNode, address: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={handleGeocodeNode}
                        disabled={isGeocoding}
                        className="px-6 bg-uh-black text-white font-black text-[10px] tracking-widest rounded-xl hover:bg-uh-gray-800 disabled:opacity-50 transition-all"
                      >
                        {isGeocoding ? 'RESOLVING...' : 'RESOLVE'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 col-span-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Latitude</label>
                      <input 
                        type="number" step="any"
                        className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-mono"
                        value={newNode.lat || ''}
                        onChange={e => setNewNode({...newNode, lat: Number(e.target.value)})}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Longitude</label>
                      <input 
                        type="number" step="any"
                        className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-mono"
                        value={newNode.lng || ''}
                        onChange={e => setNewNode({...newNode, lng: Number(e.target.value)})}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Radius (M)</label>
                      <input 
                        type="number"
                        className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-mono"
                        value={newNode.radius || ''}
                        onChange={e => setNewNode({...newNode, radius: Number(e.target.value)})}
                        required
                      />
                    </div>
                  </div>
                  <button type="submit" className="bg-uh-yellow text-uh-black font-black p-4 rounded-xl hover:bg-uh-yellow/80 transition-all flex items-center justify-center gap-3 col-span-2 shadow-lg shadow-uh-yellow/20 text-xs tracking-widest uppercase">
                    {editingNodeId ? <RefreshCw size={18} /> : <Plus size={18} />} 
                    {editingNodeId ? 'UPDATE_HUB_CONFIG' : 'IGNITE_HUB'}
                  </button>
                </form>
              )}

              {/* Nodes List */}
              <div className="flex justify-between items-center px-6 mb-4 text-[10px] font-black text-uh-gray-400 uppercase tracking-[0.2em]">
                <div className="flex-1">HUB_IDENTITY</div>
                <div className="flex gap-10 items-center">
                  <div className="w-16 text-right">TAPS</div>
                  <div className="w-32 text-right">COORDINATES</div>
                  <div className="w-24"></div>
                </div>
              </div>

              <div className="grid gap-4">
                {nodes
                  .filter(node => isAdmin || broadcasts.some(b => b.node_id === node.id))
                  .map(node => (
                    <div key={node.id} className="bg-white border border-uh-gray-200 rounded-2xl p-6 flex justify-between items-center group hover:border-uh-yellow transition-all shadow-sm">
                      <div className="flex-1">
                        <div className="text-lg font-black text-uh-black mb-1">{node.name}</div>
                        <div className="text-[10px] text-uh-gray-400 font-black tracking-widest uppercase">ID: {node.id} // TYPE: {node.type?.toUpperCase() || 'UNKNOWN'}</div>
                      </div>
                      <div className="flex gap-10 items-center">
                        <div className="w-16 text-right">
                          <div className="text-lg font-black text-uh-black font-mono">
                            {taps.filter(t => t.node_id === node.id).length}
                          </div>
                        </div>
                        <div className="w-32 text-right">
                          <div className="text-[11px] font-mono text-uh-gray-600 font-medium">{node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}</div>
                        </div>
                        <div className="w-24 flex gap-2 justify-end">
                          {isAdmin && (
                            <button 
                              onClick={() => {
                                setEditingNodeId(node.id);
                                setNewNode({
                                  name: node.name,
                                  type: node.type,
                                  address: node.address || '',
                                  lat: node.latitude,
                                  lng: node.longitude,
                                  radius: node.radius_limit
                                });
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-yellow hover:text-uh-black transition-all"
                              title="Edit Hub Configuration"
                            >
                              <RefreshCw size={18} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const url = `${BASE_URL}/tap/${node.id}`;
                              navigator.clipboard.writeText(url);
                              setHudMessage({ text: `URL_COPIED: ${node.id.toUpperCase()}`, type: 'info' });
                            }}
                            className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-yellow hover:text-uh-black transition-all"
                            title="Copy Unique Tap URL"
                          >
                            <LinkIcon size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {nodes.length === 0 && (
                  <div className="py-24 text-center border-2 border-dashed border-uh-gray-200 rounded-3xl bg-uh-gray-50">
                    <div className="text-uh-black font-black tracking-[0.2em] mb-3 text-xl">NO_ACTIVE_HUBS_DETECTED</div>
                    <div className="text-xs text-uh-gray-400 font-bold uppercase max-w-xs mx-auto leading-relaxed tracking-widest">
                      The sector network is currently offline or uninitialized. 
                      {isAdmin && " Use the RESTORE_DATA button above to re-seed the tactical grid."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'partners' && isAdmin && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-uh-gray-200 pb-6">
                <h2 className="text-3xl font-black tracking-tighter text-uh-black">PARTNER_NETWORK_ADMIN</h2>
                <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">ACTIVE_PARTNERS: {partners.length}</div>
              </div>

              {/* Create Partner Form */}
              <form onSubmit={handleCreatePartner} className="bg-uh-gray-50 border border-uh-gray-200 rounded-2xl p-8 mb-10 grid grid-cols-2 gap-6 shadow-sm">
                <div className="col-span-2 flex justify-between items-center mb-2">
                  <div className="text-[11px] text-uh-black font-black tracking-[0.2em] uppercase">
                    {editingPartnerId ? 'RECONFIGURE_EXISTING_PARTNER' : 'ONBOARD_NEW_PARTNER'}
                  </div>
                  {editingPartnerId && (
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingPartnerId(null);
                        setNewPartner({ 
                          name: '', 
                          tier: 'standard', 
                          address: '', 
                          lat: 0, 
                          lng: 0, 
                          owner_email: '',
                          role: 'partner_admin',
                          logoUrl: '',
                          logoUpdatedAt: null,
                          brandColor: '#FFE01A',
                          dealText: '',
                          sponsorZones: []
                        });
                      }}
                      className="text-[10px] text-uh-magenta font-bold hover:underline"
                    >
                      CANCEL_EDIT
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Partner_Name</label>
                  <input 
                    placeholder="e.g. Skyline Coffee"
                    className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all text-uh-black font-medium"
                    value={newPartner.name}
                    onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Partner_Tier</label>
                  <select 
                    className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all text-uh-black font-medium appearance-none"
                    value={newPartner.tier}
                    onChange={e => setNewPartner({...newPartner, tier: e.target.value as Partner['tier']})}
                  >
                    <option value="standard">STANDARD</option>
                    <option value="premium">PREMIUM</option>
                    <option value="anchor">ANCHOR</option>
                  </select>
                </div>

                <div className="col-span-2 flex flex-col gap-2">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Physical_Address (Tactical_Location)</label>
                  <div className="flex gap-3">
                    <input 
                      placeholder="123 Main St, Cincinnati, OH"
                      className="flex-1 bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all text-uh-black font-medium"
                      value={newPartner.address}
                      onChange={e => setNewPartner({...newPartner, address: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={handleGeocode}
                      disabled={isGeocoding}
                      className="px-6 bg-uh-black text-white font-black text-[10px] tracking-widest rounded-xl hover:bg-uh-gray-800 disabled:opacity-50 transition-all"
                    >
                      {isGeocoding ? 'RESOLVING...' : 'RESOLVE'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 col-span-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Latitude</label>
                    <input 
                      type="number" step="any"
                      className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-mono"
                      value={newPartner.lat || ''}
                      onChange={e => setNewPartner({...newPartner, lat: Number(e.target.value)})}
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Longitude</label>
                    <input 
                      type="number" step="any"
                      className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-mono"
                      value={newPartner.lng || ''}
                      onChange={e => setNewPartner({...newPartner, lng: Number(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Associate_Owner_Email</label>
                  <input 
                    type="email"
                    placeholder="partner@example.com"
                    className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-medium"
                    value={newPartner.owner_email}
                    onChange={e => setNewPartner({...newPartner, owner_email: e.target.value})}
                    required
                  />
                  <p className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">USER_WILL_GAIN_PARTNER_ACCESS_UPON_LOGIN</p>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Assigned_User_Role</label>
                  <select 
                    className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-medium appearance-none"
                    value={newPartner.role}
                    onChange={e => setNewPartner({...newPartner, role: e.target.value as UserRole})}
                  >
                    <option value="partner_admin">PARTNER_ADMIN</option>
                    <option value="partner_content_editor">CONTENT_EDITOR</option>
                    <option value="partner_viewer">VIEWER_ONLY</option>
                  </select>
                </div>

                {/* Sponsor Branding Section */}
                <div className="col-span-2 border-t border-uh-gray-200 pt-8 mt-4">
                  <div className="text-[11px] text-uh-black font-black mb-6 tracking-[0.2em] uppercase">Sponsor_Branding_Config</div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Logo_Upload</label>
                      <LogoUpload 
                        partnerId={generatePartnerId(newPartner.name) || 'temp'} 
                        currentLogoUrl={newPartner.logoUrl}
                        onLogoUploaded={(url) => setNewPartner({...newPartner, logoUrl: url, logoUpdatedAt: new Date().toISOString()})}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Brand_Color</label>
                      <div className="flex gap-3">
                        <input 
                          type="color"
                          className="w-14 h-14 bg-white border border-uh-gray-200 p-1 cursor-pointer rounded-xl"
                          value={newPartner.brandColor}
                          onChange={e => setNewPartner({...newPartner, brandColor: e.target.value})}
                        />
                        <input 
                          className="flex-1 bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none font-mono text-uh-black"
                          value={newPartner.brandColor}
                          onChange={e => setNewPartner({...newPartner, brandColor: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Deal_Text (Zone_D)</label>
                      <input 
                        placeholder="e.g. 20% off with NFC tap"
                        className="bg-white border border-uh-gray-200 rounded-xl p-4 text-sm focus:border-uh-yellow outline-none text-uh-black font-medium"
                        value={newPartner.dealText}
                        onChange={e => setNewPartner({...newPartner, dealText: e.target.value})}
                      />
                    </div>
                    <div className="col-span-2 flex flex-col gap-2">
                      <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Active_Sponsor_Zones</label>
                      <div className="flex gap-4">
                        {['A', 'B', 'C', 'D'].map(zone => (
                          <label key={zone} className="flex items-center gap-2 cursor-pointer group">
                            <input 
                              type="checkbox"
                              className="hidden"
                              checked={newPartner.sponsorZones.includes(zone)}
                              onChange={e => {
                                const zones = e.target.checked 
                                  ? [...newPartner.sponsorZones, zone]
                                  : newPartner.sponsorZones.filter(z => z !== zone);
                                setNewPartner({...newPartner, sponsorZones: zones});
                              }}
                            />
                            <div className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center font-black text-sm transition-all ${newPartner.sponsorZones.includes(zone) ? 'bg-uh-yellow text-uh-black border-uh-yellow shadow-lg shadow-uh-yellow/20' : 'border-uh-gray-200 text-uh-gray-400 group-hover:border-uh-yellow/50'}`}>
                              {zone}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="bg-uh-yellow text-uh-black font-black p-4 rounded-xl hover:bg-uh-yellow/80 transition-all flex items-center justify-center gap-3 col-span-2 mt-4 shadow-lg shadow-uh-yellow/20 text-xs tracking-widest uppercase">
                  {editingPartnerId ? <RefreshCw size={18} /> : <ShieldCheck size={18} />} 
                  {editingPartnerId ? 'UPDATE_PARTNER_CONFIG' : 'AUTHORIZE_PARTNER'}
                </button>
              </form>

              {/* Partners List */}
              <div className="grid gap-4">
                {partners.map(partner => (
                  <div key={partner.id} className="bg-white border border-uh-gray-200 rounded-2xl p-6 flex justify-between items-center group hover:border-uh-yellow transition-all shadow-sm">
                    <div>
                      <div className="flex items-center gap-4 mb-3">
                        {(partner.logoUrl || partner.logo_url) && (
                          <img src={partner.logoUrl || partner.logo_url} alt="" className="w-10 h-10 rounded-lg border border-uh-gray-200 object-contain bg-uh-gray-50" referrerPolicy="no-referrer" />
                        )}
                        <div className="text-lg font-black text-uh-black">{partner.name}</div>
                        {(partner.brandColor || partner.brand_color) && (
                          <div className="w-4 h-4 rounded-full border border-uh-gray-200 shadow-sm" style={{ backgroundColor: partner.brandColor || partner.brand_color }} />
                        )}
                      </div>
                      <div className="text-[10px] text-uh-gray-400 font-black tracking-widest uppercase">
                        TIER: {partner.tier?.toUpperCase() || 'STANDARD'} // 
                        OWNER: {partner.owner_email || partner.ownerEmail || 'UNASSIGNED'} //
                        ZONES: {(partner.sponsorZones || partner.sponsor_zones)?.join(', ') || 'NONE'}
                      </div>
                      {(partner.dealText || partner.deal_text) && (
                        <div className="text-[11px] text-uh-yellow font-bold mt-2 tracking-tight">DEAL: {partner.dealText || partner.deal_text}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-8">
                      <div className="text-right">
                        <div className="text-[10px] text-uh-gray-400 font-black tracking-widest uppercase mb-1">LOCATION</div>
                        <div className="text-[11px] font-mono text-uh-gray-600 font-medium">{partner.latitude.toFixed(4)}, {partner.longitude.toFixed(4)}</div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingPartnerId(partner.id);
                            setNewPartner({
                              name: partner.name,
                              tier: partner.tier,
                              address: partner.address || '',
                              lat: partner.latitude,
                              lng: partner.longitude,
                              owner_email: partner.owner_email || partner.ownerEmail || '',
                              role: partner.role || 'partner_admin',
                              logoUrl: partner.logoUrl || partner.logo_url || '',
                              logoUpdatedAt: partner.logoUpdatedAt || partner.logo_updated_at || null,
                              brandColor: partner.brandColor || partner.brand_color || '#FFE01A',
                              dealText: partner.dealText || partner.deal_text || '',
                              sponsorZones: partner.sponsorZones || partner.sponsor_zones || []
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-yellow hover:text-uh-black transition-all"
                          title="Edit Partner Configuration"
                        >
                          <RefreshCw size={18} />
                        </button>
                        <button 
                          onClick={() => handleDeletePartner(partner.id, partner.name)}
                          className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-magenta hover:text-white hover:bg-uh-magenta transition-all"
                          title="Terminate Partnership"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'broadcasts' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-uh-gray-200 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-uh-black">BROADCAST_CONTROL</h2>
                <div className="text-[10px] text-uh-gray-400 font-bold">ACTIVE_FEEDS: {broadcasts.length}</div>
              </div>

              {/* Create Broadcast Form */}
              <form onSubmit={handleCreateBroadcast} className="bg-uh-gray-50 border border-uh-gray-200 p-6 mb-8 rounded-2xl grid grid-cols-2 gap-4 shadow-sm">
                <div className="col-span-2 flex justify-between items-center mb-2">
                  <div className="text-[10px] text-uh-gray-500 font-bold tracking-widest uppercase">
                    {editingBroadcastId ? 'Reconfigure_Broadcast' : 'Ignite_New_Broadcast'}
                  </div>
                  {editingBroadcastId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingBroadcastId(null);
                        setNewBroadcast({ title: '', type: BroadcastType.LIVE_EVENT, nodeId: '', startTimeOffset: 0, duration: 60, partnerId: '', locationSource: 'node' });
                        setBroadcastImageUrl('');
                        setBroadcastAddress('');
                        setBroadcastCustomLat(null);
                        setBroadcastCustomLng(null);
                      }}
                      className="text-[10px] font-black text-uh-magenta uppercase tracking-widest hover:underline"
                    >
                      Cancel_Edit
                    </button>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Broadcast_Title</label>
                  <input 
                    placeholder="e.g. Friday Night Live"
                    className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all"
                    value={newBroadcast.title}
                    onChange={e => setNewBroadcast({...newBroadcast, title: e.target.value})}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Broadcast_Type</label>
                  <select 
                    className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all"
                    value={newBroadcast.type}
                    onChange={e => setNewBroadcast({...newBroadcast, type: e.target.value as BroadcastType})}
                  >
                    <option value={BroadcastType.LIVE_EVENT}>LIVE_EVENT</option>
                    <option value={BroadcastType.FLASH_DEAL}>FLASH_DEAL</option>
                    <option value={BroadcastType.FOOD_TRUCK}>FOOD_TRUCK</option>
                    <option value={BroadcastType.WALKING_EVENT}>WALKING_EVENT</option>
                    <option value={BroadcastType.MURAL}>MURAL</option>
                    <option value={BroadcastType.STREET_ART}>STREET_ART</option>
                    <option value={BroadcastType.POP_UP}>POP_UP</option>
                    <option value={BroadcastType.CIVIC_EVENT}>CIVIC_EVENT</option>
                  </select>
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Signal_Location_Source</label>
                  <div className="flex gap-2 p-1 bg-uh-gray-100 rounded-xl">
                    <button 
                      type="button"
                      onClick={() => setNewBroadcast({...newBroadcast, locationSource: 'node'})}
                      className={`flex-1 py-2.5 text-[10px] font-bold rounded-lg transition-all ${newBroadcast.locationSource === 'node' ? 'bg-white text-uh-black shadow-sm' : 'text-uh-gray-500 hover:text-uh-black'}`}
                    >
                      SPECIFIC_HUB_LOCATION
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewBroadcast({...newBroadcast, locationSource: 'partner'})}
                      className={`flex-1 py-2.5 text-[10px] font-bold rounded-lg transition-all ${newBroadcast.locationSource === 'partner' ? 'bg-white text-uh-black shadow-sm' : 'text-uh-gray-500 hover:text-uh-black'}`}
                    >
                      PARTNER_DEFAULT_LOCATION
                    </button>
                  </div>
                </div>

                {newBroadcast.locationSource === 'node' && (
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Target_Hub</label>
                    <select 
                      className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all"
                      value={newBroadcast.nodeId}
                      onChange={e => setNewBroadcast({...newBroadcast, nodeId: e.target.value})}
                      required={newBroadcast.locationSource === 'node'}
                    >
                      <option value="">SELECT_TARGET_HUB</option>
                      {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                  </div>
                )}

                {isAdmin && (
                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Broadcast_As</label>
                    <select 
                      className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all"
                      value={newBroadcast.partnerId || ''}
                      onChange={e => setNewBroadcast({...newBroadcast, partnerId: e.target.value})}
                    >
                      <option value="">BROADCAST_AS_SYSTEM</option>
                      {partners.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Signal_Start (Delay)</label>
                  <select 
                    className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all"
                    value={newBroadcast.startTimeOffset}
                    onChange={e => setNewBroadcast({...newBroadcast, startTimeOffset: Number(e.target.value)})}
                    required
                  >
                    <option value={0}>IMMEDIATE_START</option>
                    <option value={15}>IN 15 MINUTES</option>
                    <option value={30}>IN 30 MINUTES</option>
                    <option value={60}>IN 1 HOUR</option>
                    <option value={120}>IN 2 HOURS</option>
                    <option value={180}>IN 3 HOURS</option>
                    <option value={360}>IN 6 HOURS</option>
                    <option value={720}>IN 12 HOURS</option>
                    <option value={1440}>IN 24 HOURS</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Signal_Duration (Live_Time)</label>
                  <select 
                    className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none transition-all"
                    value={newBroadcast.duration}
                    onChange={e => setNewBroadcast({...newBroadcast, duration: Number(e.target.value)})}
                    required
                  >
                    <option value={30}>30 MINUTES</option>
                    <option value={60}>1 HOUR</option>
                    <option value={120}>2 HOURS</option>
                    <option value={180}>3 HOURS</option>
                    <option value={240}>4 HOURS</option>
                    <option value={360}>6 HOURS</option>
                    <option value={480}>8 HOURS</option>
                    <option value={720}>12 HOURS</option>
                    <option value={1440}>24 HOURS (MAX)</option>
                  </select>
                </div>

                {/* New Broadcast Fields */}
                <div className="col-span-2 flex flex-col gap-2 border-t border-uh-gray-200 pt-4 mt-2">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Cover_Image</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <input 
                        placeholder="https://example.com/image.jpg"
                        className="bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow outline-none transition-all"
                        value={broadcastImageUrl}
                        onChange={e => setBroadcastImageUrl(e.target.value)}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="bg-uh-black text-white text-[10px] font-black p-3 rounded-xl hover:bg-uh-black/90 transition-all cursor-pointer flex items-center justify-center gap-2">
                        <ImageIcon size={14} className="text-uh-yellow" />
                        {isUploadingBroadcastImage ? 'UPLOADING...' : 'UPLOAD_IMAGE'}
                        <input 
                          type="file" 
                          className="hidden" 
                          onChange={handleBroadcastImageUpload}
                          accept="image/*"
                        />
                      </label>
                    </div>
                  </div>
                  {broadcastImageUrl && (
                    <div className="mt-2 relative w-full h-32 rounded-xl overflow-hidden border border-uh-gray-200">
                      <img src={broadcastImageUrl} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      <button 
                        type="button"
                        onClick={() => setBroadcastImageUrl('')}
                        className="absolute top-2 right-2 p-1 bg-uh-magenta text-white rounded-full shadow-lg"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <div className="col-span-2 flex flex-col gap-2 border-t border-uh-gray-200 pt-4">
                  <label className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest">Custom_Address</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="123 Main St, Cincinnati, OH"
                      className="flex-1 bg-white border border-uh-gray-200 p-3 rounded-xl text-sm focus:border-uh-yellow outline-none transition-all"
                      value={broadcastAddress}
                      onChange={e => setBroadcastAddress(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={handleResolveBroadcastAddress}
                      disabled={isGeocoding || !broadcastAddress}
                      className="bg-uh-yellow text-uh-black text-[10px] font-black px-6 rounded-xl hover:bg-uh-yellow/80 transition-all disabled:opacity-50"
                    >
                      {isGeocoding ? 'RESOLVING...' : 'RESOLVE'}
                    </button>
                  </div>
                  {broadcastCustomLat && broadcastCustomLng && (
                    <div className="text-[10px] font-bold text-uh-green ml-1">
                      RESOLVED_COORDS: {broadcastCustomLat.toFixed(4)}, {broadcastCustomLng.toFixed(4)}
                    </div>
                  )}
                </div>

                <button 
                  type="submit" 
                  disabled={!canWrite}
                  className={`bg-uh-black text-white font-black p-4 rounded-xl hover:bg-uh-black/90 transition-all flex items-center justify-center gap-2 col-span-2 shadow-lg shadow-uh-black/10 ${!canWrite ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {editingBroadcastId ? <RefreshCw size={18} className="text-uh-yellow" /> : <Send size={18} className="text-uh-yellow" />} 
                  {canWrite ? (editingBroadcastId ? 'UPDATE_SIGNAL' : 'TRANSMIT_SIGNAL') : 'READ_ONLY_ACCESS'}
                </button>
              </form>

              {/* Broadcasts List */}
              <div className="grid gap-4">
                {broadcasts.map(b => {
                  const partner = partners.find(p => p.id === b.partner_id);
                  const node = nodes.find(n => n.id === b.node_id);
                  
                    return (
                      <div key={b.id} className="bg-white border border-uh-gray-200 p-5 rounded-2xl flex justify-between items-center group hover:border-uh-yellow hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-3 h-3 rounded-full ${
                            b.current_vibe === 'packed' ? 'bg-uh-magenta shadow-[0_0_8px_rgba(226,75,74,0.3)]' :
                            b.current_vibe === 'buzzing' ? 'bg-uh-yellow shadow-[0_0_8px_rgba(255,224,26,0.3)]' :
                            'bg-uh-green shadow-[0_0_8px_rgba(76,217,138,0.3)]'
                          }`} />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-sm font-black text-uh-black tracking-tight">{b.title}</div>
                              {partner && <SponsorBadge partner={partner} zone="A" compact />}
                            </div>
                            {b.address && (
                              <div className="text-[11px] text-uh-gray-500 mb-2 flex items-center gap-1">
                                <MapPin size={12} className="text-uh-gray-400" />
                                {b.address}
                              </div>
                            )}
                            <div className="flex gap-3 text-[10px] font-bold uppercase tracking-wider">
                              <span className="text-uh-gray-400">Type: <span className="text-uh-black">{b.type?.replace('_', ' ') || 'UNKNOWN'}</span></span>
                              <span className="text-uh-gray-400">Hub: <span className="text-uh-black">{node?.name || b.node_id || 'UNKNOWN'}</span></span>
                              <span className="text-uh-gray-400">Vibe: <span className="text-uh-black">{b.current_vibe || 'UNKNOWN'}</span></span>
                            </div>
                          </div>
                        </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-xs font-black text-uh-black mb-1">{getRemainingTime(b)}</div>
                              <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">EXPIRES: {b.expires_at ? parseDate(b.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'UNKNOWN'}</div>
                            </div>
                            <div className="flex gap-2">
                              {(isAdmin || (isPartner && userProfile.partner_id === b.partner_id && canWrite)) && (
                                <>
                                  <button 
                                    onClick={() => {
                                      setEditingBroadcastId(b.id);
                                      setNewBroadcast({
                                        title: b.title,
                                        type: b.type,
                                        nodeId: b.nodeId || b.node_id || '',
                                        startTimeOffset: 0, // Reset to immediate start for edits usually
                                        duration: 60, // Default or calculate from current expiry
                                        partnerId: b.partnerId || b.partner_id || '',
                                        locationSource: b.address ? 'node' : 'partner' // Heuristic
                                      });
                                      setBroadcastImageUrl(b.cover_url || b.imageUrl || '');
                                      setBroadcastAddress(b.address || '');
                                      setBroadcastCustomLat(b.latitude || null);
                                      setBroadcastCustomLng(b.longitude || null);
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-yellow hover:text-uh-black transition-all"
                                    title="EDIT_SIGNAL"
                                  >
                                    <RefreshCw size={18} />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteBroadcast(b.id, b.title)}
                                    className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-magenta hover:text-white hover:bg-uh-magenta transition-all"
                                    title="TERMINATE_SIGNAL"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </>
                              )}
                              {(isAdmin || (isPartner && userProfile.partner_id === b.partner_id && canWrite)) && (
                                <button 
                                  onClick={() => handleRepublish(b)}
                                  className="p-3 bg-uh-gray-50 text-uh-gray-600 rounded-xl border border-uh-gray-200 hover:border-uh-yellow hover:text-uh-black hover:bg-uh-yellow transition-all"
                                  title="REPUBLISH_SIGNAL"
                                >
                                  <RotateCcw size={18} />
                                </button>
                              )}
                            </div>
                          </div>
                      </div>
                    );
                })}
              </div>
            </div>
          )}
          {activeTab === 'profile' && isPartner && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-uh-gray-200 pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter text-uh-black">PARTNER_PROFILE_CONFIG</h2>
                  <div className="text-[10px] text-uh-gray-400 font-bold">PARTNER_ID: {userProfile.partner_id || userProfile.partnerId}</div>
                </div>
                <button 
                  onClick={handleResetBranding}
                  className="flex items-center gap-2 px-4 py-2 border border-uh-magenta/30 text-uh-magenta text-[10px] font-bold hover:bg-uh-magenta/10 rounded-lg transition-all"
                >
                  <RotateCcw size={14} /> RESET_TO_DEFAULTS
                </button>
              </div>

              {partners.find(p => p.id === (userProfile.partner_id || userProfile.partnerId)) ? (
                <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div>
                      <label className="text-[10px] text-uh-black font-black mb-6 block tracking-widest uppercase">Brand_Identity</label>
                      <div className="space-y-8">
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Partner_Logo</label>
                          <LogoUpload 
                            partnerId={(userProfile.partner_id || userProfile.partnerId)!} 
                            partnerEmail={partners.find(p => p.id === (userProfile.partner_id || userProfile.partnerId))?.owner_email || partners.find(p => p.id === (userProfile.partner_id || userProfile.partnerId))?.ownerEmail || ''}
                            currentLogoUrl={partners.find(p => p.id === (userProfile.partner_id || userProfile.partnerId))?.logoUrl || partners.find(p => p.id === (userProfile.partner_id || userProfile.partnerId))?.logo_url}
                            onLogoUploaded={(url) => {
                              setHudMessage({ text: 'LOGO_UPDATED_SUCCESSFULLY', type: 'info' });
                            }}
                          />
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Brand_Color</label>
                          <div className="flex gap-4 items-center bg-uh-gray-50 p-4 rounded-xl border border-uh-gray-100">
                            <input 
                              type="color"
                              disabled={!canWrite}
                              className={`w-12 h-12 bg-transparent border-none cursor-pointer rounded-lg overflow-hidden ${!canWrite ? 'opacity-50 cursor-not-allowed' : ''}`}
                              value={partners.find(p => p.id === userProfile.partner_id)?.brand_color || '#FFE01A'}
                              onChange={async (e) => {
                                if (!canWrite) return;
                                try {
                                  await updateDoc(doc(db, 'partners', userProfile.partner_id!), { brand_color: e.target.value });
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.UPDATE, `partners/${userProfile.partner_id}`);
                                }
                              }}
                            />
                            <div>
                              <div className="text-xs font-black text-uh-black uppercase">{partners.find(p => p.id === userProfile.partner_id)?.brand_color || '#FFE01A'}</div>
                              <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">Primary_Accent</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-uh-black font-black mb-6 block tracking-widest uppercase">Promotional_Content</label>
                      <div className="space-y-8">
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest ml-1">Deal_Text (Call-to-Action)</label>
                          <textarea 
                            disabled={!canWrite}
                            className={`bg-white border border-uh-gray-200 p-4 rounded-xl text-sm focus:border-uh-yellow focus:ring-2 focus:ring-uh-yellow/20 outline-none min-h-[120px] transition-all ${!canWrite ? 'opacity-50 cursor-not-allowed' : ''}`}
                            placeholder="e.g. Show this card for 10% off your first cold brew!"
                            value={partners.find(p => p.id === userProfile.partner_id)?.deal_text || ''}
                            onChange={async (e) => {
                              if (!canWrite) return;
                              try {
                                await updateDoc(doc(db, 'partners', userProfile.partner_id!), { deal_text: e.target.value });
                              } catch (err) {
                                handleFirestoreError(err, OperationType.UPDATE, `partners/${userProfile.partner_id}`);
                              }
                            }}
                          />
                        </div>

                        <div className="bg-uh-yellow/5 border border-uh-yellow/20 p-5 rounded-2xl">
                          <div className="text-[9px] text-uh-yellow font-black mb-3 uppercase tracking-widest">Live_Preview</div>
                          <div className="border border-uh-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                            <SponsorBadge partner={partners.find(p => p.id === userProfile.partner_id) || null} zone="A" compact />
                            <div className="p-4">
                              <div className="h-2 w-24 bg-uh-gray-100 rounded-full mb-2" />
                              <div className="h-1.5 w-32 bg-uh-gray-50 rounded-full" />
                              <SponsorBadge partner={partners.find(p => p.id === userProfile.partner_id) || null} zone="D" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center border-2 border-dashed border-uh-gray-200 rounded-3xl bg-uh-gray-50">
                  <div className="text-uh-magenta font-black tracking-[0.2em] mb-4">PARTNER_ENTITY_NOT_FOUND</div>
                  <div className="text-[11px] text-uh-gray-500 font-bold uppercase max-w-xs mx-auto leading-relaxed">
                    Your account is not correctly linked to a partner entity. Please contact a system administrator.
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-uh-gray-200 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-uh-black">
                  {isAdmin ? 'SYSTEM_WIDE_ANALYTICS' : 'SIGNAL_ANALYTICS'}
                </h2>
                <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">
                  {isAdmin ? 'GLOBAL_PULSE_MONITOR' : `PARTNER_ID: ${userProfile.partner_id}`}
                </div>
              </div>

              {/* Top Level Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-uh-gray-200 p-6 rounded-2xl shadow-sm">
                  <div className="text-[9px] text-uh-gray-400 font-bold mb-2 tracking-widest uppercase">Total_Network_Taps</div>
                  <div className="text-3xl font-black text-uh-black">
                    {isAdmin 
                      ? taps.length 
                      : taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).length}
                  </div>
                </div>
                <div className="bg-white border border-uh-gray-200 p-6 rounded-2xl shadow-sm">
                  <div className="text-[9px] text-uh-gray-400 font-bold mb-2 tracking-widest uppercase">Unique_Sessions</div>
                  <div className="text-3xl font-black text-uh-black">
                    {isAdmin
                      ? new Set(taps.map(t => t.session_uuid)).size
                      : new Set(taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).map(t => t.session_uuid)).size}
                  </div>
                </div>
                <div className="bg-white border border-uh-gray-200 p-6 rounded-2xl shadow-sm">
                  <div className="text-[9px] text-uh-gray-400 font-bold mb-2 tracking-widest uppercase">Active_Signals</div>
                  <div className="text-3xl font-black text-uh-black">
                    {broadcasts.filter(b => new Date(b.expires_at) > new Date()).length}
                  </div>
                </div>
                <div className="bg-white border border-uh-gray-200 p-6 rounded-2xl shadow-sm">
                  <div className="text-[9px] text-uh-gray-400 font-bold mb-2 tracking-widest uppercase">Tap_Vs_Browser</div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-3xl font-black text-uh-black">
                      {taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length}
                    </div>
                    <div className="text-sm font-bold text-uh-gray-300">/</div>
                    <div className="text-xl font-bold text-uh-gray-400">
                      {taps.filter(t => t.access_vector === 'direct').length}
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin ? (
                <div className="space-y-8">
                  {/* Physical vs Digital Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl relative overflow-hidden shadow-sm">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-uh-yellow" />
                      <h3 className="text-[10px] font-black text-uh-gray-400 mb-4 tracking-widest uppercase">PHYSICAL_ENGAGEMENT (NFC/QR)</h3>
                      <div className="flex items-baseline gap-4">
                        <div className="text-5xl font-black text-uh-black">
                          {taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length + 
                           interactions.filter(i => i.access_vector === 'nfc' || i.access_vector === 'qr').length +
                           vibeReports.filter(v => v.access_vector === 'nfc' || v.access_vector === 'qr').length}
                        </div>
                        <div className="text-xs font-bold text-uh-gray-500">
                          {((taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length + 
                             interactions.filter(i => i.access_vector === 'nfc' || i.access_vector === 'qr').length +
                             vibeReports.filter(v => v.access_vector === 'nfc' || v.access_vector === 'qr').length) / 
                            (taps.length + interactions.length + vibeReports.length + tabViews.length || 1) * 100).toFixed(1)}% OF TOTAL
                        </div>
                      </div>
                    </div>
                    <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl relative overflow-hidden shadow-sm">
                      <div className="absolute top-0 left-0 w-full h-1.5 bg-uh-black" />
                      <h3 className="text-[10px] font-black text-uh-gray-400 mb-4 tracking-widest uppercase">DIGITAL_ENGAGEMENT (DIRECT)</h3>
                      <div className="flex items-baseline gap-4">
                        <div className="text-5xl font-black text-uh-black">
                          {taps.filter(t => t.access_vector === 'direct').length + 
                           interactions.filter(i => i.access_vector === 'direct').length +
                           vibeReports.filter(v => v.access_vector === 'direct').length +
                           tabViews.filter(v => v.access_vector === 'direct').length}
                        </div>
                        <div className="text-xs font-bold text-uh-gray-500">
                          {((taps.filter(t => t.access_vector === 'direct').length + 
                             interactions.filter(i => i.access_vector === 'direct').length +
                             vibeReports.filter(v => v.access_vector === 'direct').length +
                             tabViews.filter(v => v.access_vector === 'direct').length) / 
                            (taps.length + interactions.length + vibeReports.length + tabViews.length || 1) * 100).toFixed(1)}% OF TOTAL
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Access Vector Breakdown */}
                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-8 tracking-widest uppercase">GLOBAL_ACCESS_VECTOR_BREAKDOWN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {['nfc', 'qr', 'direct'].map(vector => {
                        const vectorTaps = taps.filter(t => t.access_vector === vector);
                        const vectorViews = tabViews.filter(v => v.access_vector === vector);
                        const vectorInteractions = interactions.filter(i => i.access_vector === vector);
                        const vectorVibes = vibeReports.filter(v => v.access_vector === vector);
                        
                        const uniqueUsers = new Set([
                          ...vectorTaps, 
                          ...vectorViews, 
                          ...vectorInteractions, 
                          ...vectorVibes
                        ].map(x => x.session_uuid)).size;
                        
                        const label = vector === 'nfc' ? 'NFC_TAP' : vector === 'qr' ? 'QR_SCAN' : 'DIRECT_BROWSER';
                        const colorClass = vector === 'nfc' ? 'bg-uh-green' : vector === 'qr' ? 'bg-uh-yellow' : 'bg-uh-black';

                        return (
                          <div key={vector} className="bg-uh-gray-50 border border-uh-gray-100 p-6 rounded-xl relative overflow-hidden group hover:border-uh-gray-200 transition-all">
                            <div className={`absolute top-0 right-0 w-1.5 h-full ${colorClass}`} />
                            <div className="text-[10px] font-black text-uh-gray-400 mb-6 tracking-widest uppercase">{label}</div>
                            <div className="space-y-6">
                              <div className="flex justify-between items-end">
                                <div>
                                  <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">Total_Actions</div>
                                  <div className="text-3xl font-black text-uh-black">
                                    {vectorTaps.length + vectorViews.length + vectorInteractions.length + vectorVibes.length}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">Unique_Users</div>
                                  <div className="text-lg font-black text-uh-black/70">{uniqueUsers}</div>
                                </div>
                              </div>
                              <div className="pt-4 border-t border-uh-gray-200 grid grid-cols-2 gap-y-3 text-[10px] font-bold text-uh-gray-500">
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-uh-gray-300" />
                                  <span>TAPS: {vectorTaps.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-uh-gray-300" />
                                  <span>VIEWS: {vectorViews.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-uh-gray-300" />
                                  <span>INTERACT: {vectorInteractions.length}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="w-1 h-1 rounded-full bg-uh-gray-300" />
                                  <span>VIBES: {vectorVibes.length}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Partner Performance Table */}
                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-8 tracking-widest uppercase">PARTNER_NETWORK_PERFORMANCE</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[10px] font-black text-uh-gray-400 uppercase tracking-widest border-b border-uh-gray-100">
                            <th className="pb-4 font-black">PARTNER_IDENTITY</th>
                            <th className="pb-4 text-right font-black">NODES</th>
                            <th className="pb-4 text-right font-black">SIGNALS</th>
                            <th className="pb-4 text-right font-black">TOTAL_TAPS</th>
                            <th className="pb-4 text-right font-black">UNIQUE_TAPS</th>
                            <th className="pb-4 text-right font-black">ACTIVE_UNIQUE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-uh-gray-50">
                          {partners.map(p => {
                            const partnerBroadcasts = broadcasts.filter(b => b.partner_id === p.id);
                            const activePartnerBroadcasts = partnerBroadcasts.filter(b => parseDate(b.expires_at) > now);
                            const partnerNodes = new Set(partnerBroadcasts.map(b => b.node_id));
                            const activePartnerNodes = new Set(activePartnerBroadcasts.map(b => b.node_id));
                            const partnerTaps = taps.filter(t => partnerNodes.has(t.node_id));
                            const activePartnerTaps = taps.filter(t => activePartnerNodes.has(t.node_id));
                            const partnerUniqueTaps = new Set(partnerTaps.map(t => t.session_uuid)).size;
                            const activeUniqueTaps = new Set(activePartnerTaps.map(t => t.session_uuid)).size;

                            return (
                              <tr key={p.id} className="group hover:bg-uh-gray-50 transition-all">
                                <td className="py-5">
                                  <div className="text-sm font-black text-uh-black">{p.name}</div>
                                  <div className="text-[10px] text-uh-gray-400 font-bold mt-0.5">{p.id}</div>
                                </td>
                                <td className="py-5 text-right text-xs font-bold text-uh-gray-600">{partnerNodes.size}</td>
                                <td className="py-5 text-right text-xs font-bold text-uh-gray-600">{partnerBroadcasts.length}</td>
                                <td className="py-5 text-right text-xs font-black text-uh-green">{partnerTaps.length}</td>
                                <td className="py-5 text-right text-xs font-black text-uh-yellow">{partnerUniqueTaps}</td>
                                <td className="py-5 text-right text-xs font-black text-uh-magenta">{activeUniqueTaps}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Node Activity Heatmap-style list */}
                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-8 tracking-widest uppercase">SECTOR_HUB_ACTIVITY_LOG</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {nodes.map(node => {
                        const nodeTaps = taps.filter(t => t.node_id === node.id);
                        const nodeUniqueTaps = new Set(nodeTaps.map(t => t.session_uuid)).size;
                        const activeSignals = broadcasts.filter(b => b.node_id === node.id && new Date(b.expires_at) > new Date());

                        return (
                          <div key={node.id} className="bg-uh-gray-50 border border-uh-gray-100 p-6 rounded-xl hover:border-uh-yellow hover:bg-white hover:shadow-md transition-all">
                            <div className="flex justify-between items-start mb-6">
                              <div>
                                <div className="text-sm font-black text-uh-black">{node.name}</div>
                                <div className="text-[10px] text-uh-gray-400 font-bold">{node.id}</div>
                              </div>
                              <div className={`px-3 py-1 rounded-full text-[9px] font-black tracking-widest ${activeSignals.length > 0 ? 'bg-uh-yellow text-uh-black' : 'bg-uh-gray-200 text-uh-gray-500'}`}>
                                {activeSignals.length > 0 ? 'LIVE_SIGNAL' : 'IDLE'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">Total_Taps</div>
                                <div className="text-2xl font-black text-uh-black">{nodeTaps.length}</div>
                              </div>
                              <div>
                                <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">Unique_Users</div>
                                <div className="text-2xl font-black text-uh-black">{nodeUniqueTaps}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tab Navigation Analytics */}
                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-8 tracking-widest uppercase">TAB_NAVIGATION_ANALYTICS</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {['feed', 'wallet', 'map'].map(tab => {
                        const views = tabViews.filter(v => v.tab === tab);
                        const uniqueSessions = new Set(views.map(v => v.session_uuid)).size;
                        const tapInTab = taps.filter(t => t.tab === tab).length;

                        return (
                          <div key={tab} className="bg-uh-gray-50 border border-uh-gray-100 p-6 rounded-xl hover:border-uh-yellow hover:bg-white hover:shadow-md transition-all">
                            <div className="text-[11px] font-black text-uh-black mb-6 uppercase tracking-widest border-b border-uh-gray-200 pb-2">{tab}_VIEW_METRICS</div>
                            <div className="space-y-6">
                              <div>
                                <div className="text-[9px] text-uh-gray-400 font-bold uppercase tracking-widest">Total_Views</div>
                                <div className="text-3xl font-black text-uh-black">{views.length}</div>
                              </div>
                              <div className="grid grid-cols-1 gap-4">
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">Unique_Sessions</span>
                                  <span className="text-sm font-black text-uh-black">{uniqueSessions}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">Taps_In_Tab</span>
                                  <span className="text-sm font-black text-uh-green">{tapInTab}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">Sponsor_Taps</span>
                                  <span className="text-sm font-black text-uh-magenta">{taps.filter(t => t.tab === tab && t.sponsor_id).length}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Physical vs Digital Engagement Comparison */}
                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl col-span-1 md:col-span-2 shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-8 tracking-widest uppercase">PHYSICAL_VS_DIGITAL_ENGAGEMENT</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                      {/* Physical (NFC/QR) */}
                      <div className="border-l-4 border-uh-yellow pl-8">
                        <div className="text-[11px] font-black text-uh-black mb-6 uppercase tracking-widest">PHYSICAL_VECTORS (NFC/QR)</div>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">TOTAL_TAPS</div>
                            <div className="text-3xl font-black text-uh-black">{taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">INTERACTIONS</div>
                            <div className="text-3xl font-black text-uh-black">{interactions.filter(i => i.access_vector === 'nfc' || i.access_vector === 'qr').length}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">VIBE_REPORTS</div>
                            <div className="text-3xl font-black text-uh-black">{vibeReports.filter(r => r.access_vector === 'nfc' || r.access_vector === 'qr').length}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">TAB_VIEWS</div>
                            <div className="text-3xl font-black text-uh-black">{tabViews.filter(v => v.access_vector === 'nfc' || v.access_vector === 'qr').length}</div>
                          </div>
                        </div>
                      </div>

                      {/* Digital (Direct) */}
                      <div className="border-l-4 border-uh-black pl-8">
                        <div className="text-[11px] font-black text-uh-black mb-6 uppercase tracking-widest">DIGITAL_VECTORS (DIRECT)</div>
                        <div className="grid grid-cols-2 gap-8">
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">TOTAL_TAPS</div>
                            <div className="text-3xl font-black text-uh-black">{taps.filter(t => t.access_vector === 'direct').length}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">INTERACTIONS</div>
                            <div className="text-3xl font-black text-uh-black">{interactions.filter(i => i.access_vector === 'direct').length}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">VIBE_REPORTS</div>
                            <div className="text-3xl font-black text-uh-black">{vibeReports.filter(r => r.access_vector === 'direct').length}</div>
                          </div>
                          <div>
                            <div className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest mb-1">TAB_VIEWS</div>
                            <div className="text-3xl font-black text-uh-black">{tabViews.filter(v => v.access_vector === 'direct').length}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl col-span-1 md:col-span-2 shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-8 tracking-widest uppercase">GLOBAL_ACCESS_VECTOR_BREAKDOWN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      {['nfc', 'qr', 'direct'].map(vector => {
                        const vectorTaps = taps.filter(t => t.access_vector === vector);
                        const vectorViews = tabViews.filter(v => v.access_vector === vector);
                        const vectorInteractions = interactions.filter(i => i.access_vector === vector);
                        const vectorVibes = vibeReports.filter(r => r.access_vector === vector);
                        
                        const totalActions = vectorTaps.length + vectorViews.length + vectorInteractions.length + vectorVibes.length;
                        const uniqueUsers = new Set([
                          ...vectorTaps.map(t => t.session_uuid),
                          ...vectorViews.map(v => v.session_uuid),
                          ...vectorInteractions.map(i => i.session_uuid),
                          ...vectorVibes.map(r => r.session_uuid)
                        ]).size;

                        const label = vector === 'nfc' ? 'NFC_TAP' : vector === 'qr' ? 'QR_SCAN' : 'DIRECT_BROWSER';
                        const colorClass = vector === 'nfc' ? 'bg-uh-green' : vector === 'qr' ? 'bg-uh-yellow' : 'bg-uh-black';

                        return (
                          <div key={vector} className="bg-uh-gray-50 border border-uh-gray-100 p-6 rounded-xl relative overflow-hidden group hover:border-uh-gray-200 transition-all">
                            <div className={`absolute top-0 right-0 w-1.5 h-full ${colorClass}`} />
                            <div className="text-[11px] font-black text-uh-black mb-4 uppercase tracking-widest">{label}</div>
                            <div className="flex items-baseline gap-2 mb-1">
                              <div className="text-4xl font-black text-uh-black">{totalActions}</div>
                              <div className="text-[10px] text-uh-gray-400 font-bold uppercase">ACTIONS</div>
                            </div>
                            <div className="text-[10px] text-uh-gray-500 font-bold uppercase tracking-widest mb-6">UNIQUE_USERS: {uniqueUsers}</div>
                            
                            <div className="space-y-3 pt-6 border-t border-uh-gray-200">
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-uh-gray-400">TAPS</span>
                                <span className="text-uh-black">{vectorTaps.length}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-uh-gray-400">VIEWS</span>
                                <span className="text-uh-black">{vectorViews.length}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-uh-gray-400">INTERACTIONS</span>
                                <span className="text-uh-black">{vectorInteractions.length}</span>
                              </div>
                              <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest">
                                <span className="text-uh-gray-400">VIBES</span>
                                <span className="text-uh-black">{vectorVibes.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-6 tracking-widest uppercase">ACTIVE_SIGNAL_PERFORMANCE</h3>
                    <div className="space-y-6">
                      {broadcasts.map(b => {
                        const reports = vibeReports.filter(r => r.broadcast_id === b.id);
                        const packedCount = reports.filter(r => r.vibe === 'packed').length;
                        const buzzingCount = reports.filter(r => r.vibe === 'buzzing').length;
                        const chillCount = reports.filter(r => r.vibe === 'chill').length;
                        
                        return (
                          <div key={b.id} className="border-l-4 border-uh-magenta/20 pl-6 py-2">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-sm font-black text-uh-black">{b.title}</span>
                              <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">{b.current_vibe}</span>
                            </div>
                            <div className="flex gap-1 h-2 bg-uh-gray-100 rounded-full overflow-hidden">
                              <div className="bg-uh-magenta transition-all duration-500" style={{ width: `${(packedCount / (reports.length || 1)) * 100}%` }} />
                              <div className="bg-uh-yellow transition-all duration-500" style={{ width: `${(buzzingCount / (reports.length || 1)) * 100}%` }} />
                              <div className="bg-uh-green transition-all duration-500" style={{ width: `${(chillCount / (reports.length || 1)) * 100}%` }} />
                            </div>
                            <div className="flex justify-between mt-3">
                              <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">REPORTS: {reports.length}</span>
                              <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">STATUS: {getRemainingTime(b)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {broadcasts.length === 0 && (
                        <div className="text-center py-12 text-uh-gray-400 text-xs font-bold uppercase tracking-widest italic">NO_ACTIVE_SIGNALS_DETECTED</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-uh-gray-200 p-8 rounded-2xl shadow-sm">
                    <h3 className="text-sm font-black text-uh-black mb-6 tracking-widest uppercase">MY_ACTIVE_HUBS</h3>
                    <div className="space-y-6">
                      {nodes.filter(n => broadcasts.some(b => b.node_id === n.id)).map(node => {
                        const nodeTaps = taps.filter(t => t.node_id === node.id).length;
                        const activeBroadcasts = broadcasts.filter(b => b.node_id === node.id);
                        
                        return (
                          <div key={node.id} className="border-l-4 border-uh-green/20 pl-6 py-2">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-black text-uh-green">{node.name}</span>
                              <span className="text-[10px] text-uh-gray-400 font-bold uppercase tracking-widest">{node.type}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-uh-gray-500 font-bold uppercase tracking-widest">TOTAL_TAPS: {nodeTaps}</span>
                              <span className="text-[10px] text-uh-gray-500 font-bold uppercase tracking-widest">SIGNALS: {activeBroadcasts.length}</span>
                            </div>
                          </div>
                        );
                      })}
                      {broadcasts.length === 0 && (
                        <div className="text-center py-12 text-uh-gray-400 text-xs font-bold uppercase tracking-widest italic">NO_HUB_ACTIVITY_DETECTED</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
