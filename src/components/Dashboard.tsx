import React, { useState, useEffect } from 'react';
import { db, functions } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, setDoc, getDocs, updateDoc, deleteDoc, serverTimestamp, limit, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Node, Broadcast, UserProfile, Partner, BroadcastType, HubType, VibeReport, Tap, UserRole, Interaction, TabView } from '../types';
import { BASE_URL } from '../constants';
import { Plus, MapPin, Link as LinkIcon, Send, LayoutDashboard, LogOut, ChevronRight, Globe, ShieldCheck, RefreshCw, BarChart3, Image as ImageIcon, Trash2, RotateCcw, Palette } from 'lucide-react';
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
  const [newBroadcast, setNewBroadcast] = useState({ 
    title: '', 
    type: 'event' as BroadcastType, 
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
  
  const [activeTab, setActiveTab] = useState<'hubs' | 'broadcasts' | 'partners' | 'analytics' | 'profile'>(isAdmin ? 'hubs' : 'broadcasts');
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  const [now, setNow] = useState(new Date());
  
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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newNode.address)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setNewNode({
          ...newNode,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        });
        setHudMessage({ text: "COORDINATES_RESOLVED", type: 'info' });
      } else {
        setHudMessage({ text: "ADDRESS_NOT_FOUND", type: 'error' });
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: "GEOCODING_FAILURE", type: 'error' });
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

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin && !isPartner) return;

    const startsAt = new Date(Date.now() + newBroadcast.startTimeOffset * 60000).toISOString();
    const expiresAt = new Date(new Date(startsAt).getTime() + newBroadcast.duration * 60000).toISOString();
    
    const partnerId = isAdmin ? (newBroadcast.partnerId || 'admin') : (userProfile.partnerId || userProfile.partner_id || 'admin');
    const partner = partners.find(p => p.id === partnerId);
    const targetNode = nodes.find(n => n.id === newBroadcast.nodeId);
    
    // Explicitly choose location based on source
    let latitude = 0;
    let longitude = 0;
    let address = '';
    let nodeId = newBroadcast.nodeId;

    if (newBroadcast.locationSource === 'partner' && partner) {
      latitude = partner.latitude;
      longitude = partner.longitude;
      address = partner.address || '';
    } else if (targetNode) {
      latitude = targetNode.latitude;
      longitude = targetNode.longitude;
      address = targetNode.address || '';
    } else if (newBroadcast.locationSource === 'partner' && partnerId === 'admin') {
      // Fallback for system broadcast with partner source: use a default or current node
      const defaultNode = nodes[0];
      if (defaultNode) {
        latitude = defaultNode.latitude;
        longitude = defaultNode.longitude;
        address = defaultNode.address || '';
        nodeId = defaultNode.id;
      }
    }
    
    try {
      await addDoc(collection(db, 'broadcasts'), {
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
        active: true
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'broadcasts');
    }
    setHudMessage({ text: `SIGNAL_TRANSMITTED: ${newBroadcast.title.toUpperCase()}`, type: 'info' });
    setNewBroadcast({ title: '', type: 'event', nodeId: '', startTimeOffset: 0, duration: 60, partnerId: '', locationSource: 'node' });
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
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(newPartner.address)}`);
      const data = await response.json();
      if (data && data.length > 0) {
        setNewPartner({
          ...newPartner,
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        });
        setHudMessage({ text: "COORDINATES_RESOLVED", type: 'info' });
      } else {
        setHudMessage({ text: "ADDRESS_NOT_FOUND", type: 'error' });
      }
    } catch (err) {
      console.error("Geocoding error:", err);
      setHudMessage({ text: "GEOCODING_FAILURE", type: 'error' });
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
    <div className="min-h-screen bg-hud-bg text-white flex flex-col font-sans">
      {/* Sidebar / Header */}
      <header className="border-b border-white/10 p-6 flex justify-between items-center bg-hud-dark">
        <div className="flex items-center gap-4">
          <div className="bg-hud-yellow text-black p-2 font-black text-xl">U</div>
          <div>
            <div className="text-[10px] text-hud-green font-bold tracking-[0.3em]">URBAN_HIKERS // CONTROL_CENTER</div>
            <div className="text-xs opacity-60 uppercase tracking-widest">{userProfile.role} ACCESS: {userProfile.email}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a 
            href="/tap/OTR-ALPHA-01" 
            className="flex items-center gap-2 text-hud-yellow hover:bg-hud-yellow/10 px-4 py-2 border border-hud-yellow/20 transition-all text-xs font-bold"
          >
            <Globe size={16} /> VIEW_LIVE_BOARD
          </a>
          <a 
            href="/creator/ignite" 
            className="flex items-center gap-2 text-hud-magenta hover:bg-hud-magenta/10 px-4 py-2 border border-hud-magenta transition-all text-xs font-bold"
          >
            <Send size={16} /> CREATOR_IGNITE
          </a>
          {isAdmin && (
            <a 
              href="/admin/mural" 
              className="flex items-center gap-2 text-[#FFD700] hover:bg-[#FFD700]/10 px-4 py-2 border border-[#FFD700] transition-all text-xs font-bold"
            >
              <Palette size={16} /> MURAL_ADMIN
            </a>
          )}
          <button onClick={onLogout} className="flex items-center gap-2 text-hud-magenta hover:bg-hud-magenta/10 px-4 py-2 border border-hud-magenta transition-all text-xs font-bold">
            <LogOut size={16} /> TERMINATE_SESSION
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation */}
        <nav className="w-64 border-r border-white/10 p-4 flex flex-col gap-2 bg-hud-dark/50">
          {(isAdmin || isPartner) && (
            <button 
              onClick={() => setActiveTab('hubs')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'hubs' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
            >
              <Globe size={18} /> SECTOR_HUBS
            </button>
          )}
          {isAdmin && (
            <button 
              onClick={() => setActiveTab('partners')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'partners' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
            >
              <ShieldCheck size={18} /> PARTNER_NETWORK
            </button>
          )}
          <button 
            onClick={() => setActiveTab('broadcasts')}
            className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'broadcasts' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
          >
            <Send size={18} /> LIVE_BROADCASTS
          </button>
          {(isPartner || isAdmin) && (
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
            >
              <BarChart3 size={18} /> {isAdmin ? 'SYSTEM_ANALYTICS' : 'SIGNAL_ANALYTICS'}
            </button>
          )}
          {isPartner && (
            <button 
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'profile' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
            >
              <ShieldCheck size={18} /> {isAdmin ? 'MY_PARTNER_PROFILE' : 'MY_PROFILE'}
            </button>
          )}
        </nav>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-8 bg-hud-bg relative">
          {/* HUD Notifications */}
          <div className="fixed top-24 right-8 z-[100] flex flex-col gap-2">
            {hudMessage && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`px-4 py-2 border font-bold text-[10px] tracking-widest shadow-lg ${
                  hudMessage.type === 'error' 
                    ? 'bg-hud-magenta/20 border-hud-magenta text-hud-magenta' 
                    : 'bg-hud-green/20 border-hud-green text-hud-green'
                }`}
              >
                {hudMessage.text}
              </motion.div>
            )}
          </div>

          {/* Scanline Effect */}
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-50 bg-[length:100%_2px,3px_100%] opacity-20" />

          {activeTab === 'hubs' && (isAdmin || isPartner) && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-green/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-green">SECTOR_HUB_MANAGEMENT</h2>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-4 mb-2">
                    {isAdmin && (
                      <div className="flex gap-2">
                        <button 
                          onClick={handleSyncLibrary}
                          disabled={isSyncingLibrary}
                          className="flex items-center gap-2 px-3 py-1 border border-hud-green/30 text-hud-green text-[9px] font-bold hover:bg-hud-green/10 transition-all disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isSyncingLibrary ? 'animate-spin' : ''} />
                          SYNC_LIBRARY_EVENTS
                        </button>
                        <button 
                          onClick={handleSyncCivic}
                          disabled={isSyncingCivic}
                          className="flex items-center gap-2 px-3 py-1 border border-hud-magenta/30 text-hud-magenta text-[9px] font-bold hover:bg-hud-magenta/10 transition-all disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isSyncingCivic ? 'animate-spin' : ''} />
                          SYNC_CIVIC_EVENTS
                        </button>
                        <button 
                          onClick={handleRestoreData}
                          disabled={isSeeding}
                          className="flex items-center gap-2 px-3 py-1 border border-hud-yellow/30 text-hud-yellow text-[9px] font-bold hover:bg-hud-yellow/10 transition-all disabled:opacity-50"
                        >
                          <RefreshCw size={12} className={isSeeding ? 'animate-spin' : ''} />
                          RESTORE_SYSTEM_DATA
                        </button>
                      </div>
                    )}
                    <div className="text-[10px] text-hud-green/40 font-bold uppercase">
                      {isAdmin ? `ACTIVE_NODES: ${nodes.length}` : `HOSTING_HUBS: ${nodes.filter(n => broadcasts.some(b => b.node_id === n.id)).length}`}
                    </div>
                  </div>
                  {isPartner && (
                    <div className="text-[10px] text-hud-yellow font-bold uppercase mt-1">
                      TOTAL_NETWORK_TAPS: {taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).length}
                    </div>
                  )}
                </div>
              </div>

              {/* Create/Edit Node Form - Admin Only */}
              {isAdmin && (
                <form onSubmit={handleCreateNode} className="bg-white/5 border border-white/10 p-6 mb-8 grid grid-cols-2 gap-4">
                  <div className="col-span-2 flex justify-between items-center mb-2">
                    <div className="text-[10px] text-hud-green font-bold tracking-widest uppercase">
                      {editingNodeId ? 'RECONFIGURE_EXISTING_HUB' : 'GENERATE_NEW_HUB'}
                    </div>
                    {editingNodeId && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEditingNodeId(null);
                          setNewNode({ name: '', type: 'street', address: '', lat: 0, lng: 0, radius: 500 });
                        }}
                        className="text-[9px] text-hud-magenta font-bold hover:underline"
                      >
                        CANCEL_EDIT
                      </button>
                    )}
                  </div>
                  <input 
                    placeholder="HUB_NAME (e.g. OTR North)"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-green outline-none"
                    value={newNode.name}
                    onChange={e => setNewNode({...newNode, name: e.target.value})}
                    required
                  />
                  <select 
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-green outline-none"
                    value={newNode.type}
                    onChange={e => setNewNode({...newNode, type: e.target.value as HubType})}
                  >
                    <option value="street">STREET_LEVEL</option>
                    <option value="conference_center">CONFERENCE_HUB</option>
                  </select>

                  <div className="col-span-2 flex flex-col gap-1">
                    <label className="text-[9px] opacity-40 font-bold">PHYSICAL_ADDRESS (FOR_GEOCODING)</label>
                    <div className="flex gap-2">
                      <input 
                        placeholder="123 Main St, Cincinnati, OH"
                        className="flex-1 bg-black border border-white/20 p-3 text-sm focus:border-hud-green outline-none"
                        value={newNode.address}
                        onChange={e => setNewNode({...newNode, address: e.target.value})}
                      />
                      <button 
                        type="button"
                        onClick={handleGeocodeNode}
                        disabled={isGeocoding}
                        className="px-4 bg-hud-green text-black font-bold text-[10px] hover:bg-hud-green/80 disabled:opacity-50"
                      >
                        {isGeocoding ? 'RESOLVING...' : 'RESOLVE_COORDS'}
                      </button>
                    </div>
                  </div>

                  <input 
                    type="number" step="any" placeholder="LATITUDE"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-green outline-none"
                    value={newNode.lat || ''}
                    onChange={e => setNewNode({...newNode, lat: Number(e.target.value)})}
                    required
                  />
                  <input 
                    type="number" step="any" placeholder="LONGITUDE"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-green outline-none"
                    value={newNode.lng || ''}
                    onChange={e => setNewNode({...newNode, lng: Number(e.target.value)})}
                    required
                  />
                  <input 
                    type="number" placeholder="RADIUS_LIMIT (METERS)"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-green outline-none"
                    value={newNode.radius || ''}
                    onChange={e => setNewNode({...newNode, radius: Number(e.target.value)})}
                    required
                  />
                  <button type="submit" className="bg-hud-green text-black font-black p-3 hover:bg-hud-green/80 transition-all flex items-center justify-center gap-2">
                    {editingNodeId ? <RefreshCw size={18} /> : <Plus size={18} />} 
                    {editingNodeId ? 'UPDATE_HUB_CONFIG' : 'IGNITE_HUB'}
                  </button>
                </form>
              )}

              {/* Nodes List */}
              <div className="flex justify-between items-center px-4 mb-2 text-[9px] font-bold text-hud-green/40 uppercase tracking-[0.2em]">
                <div className="flex-1">HUB_IDENTITY</div>
                <div className="flex gap-6 items-center">
                  <div className="w-16 text-right">TAPS</div>
                  <div className="w-32 text-right">COORDINATES</div>
                  <div className="w-20"></div>
                </div>
              </div>

              <div className="grid gap-4">
                {nodes
                  .filter(node => isAdmin || broadcasts.some(b => b.node_id === node.id))
                  .map(node => (
                    <div key={node.id} className="bg-white/5 border border-white/10 p-4 flex justify-between items-center group hover:border-hud-green/40 transition-all">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-hud-green mb-1">{node.name}</div>
                        <div className="text-[10px] opacity-40 font-mono">ID: {node.id} // TYPE: {node.type?.toUpperCase() || 'UNKNOWN'}</div>
                      </div>
                      <div className="flex gap-6 items-center">
                        <div className="w-16 text-right">
                          <div className="text-[10px] font-mono font-bold text-hud-green">
                            {taps.filter(t => t.node_id === node.id).length}
                          </div>
                        </div>
                        <div className="w-32 text-right">
                          <div className="text-[10px] font-mono">{node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}</div>
                        </div>
                        <div className="w-20 flex gap-2 justify-end">
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
                              className="p-2 border border-white/10 hover:border-hud-green hover:text-hud-green transition-all"
                              title="Edit Hub Configuration"
                            >
                              <RefreshCw size={16} />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              const url = `${BASE_URL}/tap/${node.id}`;
                              navigator.clipboard.writeText(url);
                              setHudMessage({ text: `URL_COPIED: ${node.id.toUpperCase()}`, type: 'info' });
                            }}
                            className="p-2 border border-white/10 hover:border-hud-yellow hover:text-hud-yellow transition-all"
                            title="Copy Unique Tap URL"
                          >
                            <LinkIcon size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                {nodes.length === 0 && (
                  <div className="py-20 text-center border border-dashed border-white/10 bg-white/[0.02]">
                    <div className="text-hud-green font-black tracking-[0.2em] mb-2">NO_ACTIVE_HUBS_DETECTED</div>
                    <div className="text-[10px] opacity-40 uppercase max-w-xs mx-auto leading-relaxed">
                      The sector network is currently offline or uninitialized. 
                      {isAdmin && " Use the RESTORE_SYSTEM_DATA button above to re-seed the tactical grid."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'partners' && isAdmin && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-yellow/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-yellow">PARTNER_NETWORK_ADMIN</h2>
                <div className="text-[10px] text-hud-yellow/40 font-bold">ACTIVE_PARTNERS: {partners.length}</div>
              </div>

              {/* Create Partner Form */}
              <form onSubmit={handleCreatePartner} className="bg-white/5 border border-white/10 p-6 mb-8 grid grid-cols-2 gap-4">
                <div className="col-span-2 flex justify-between items-center mb-2">
                  <div className="text-[10px] text-hud-yellow font-bold tracking-widest uppercase">
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
                          brandColor: '#00FF00',
                          dealText: '',
                          sponsorZones: []
                        });
                      }}
                      className="text-[9px] text-hud-magenta font-bold hover:underline"
                    >
                      CANCEL_EDIT
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">PARTNER_NAME</label>
                  <input 
                    placeholder="e.g. Skyline Coffee"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.name}
                    onChange={e => setNewPartner({...newPartner, name: e.target.value})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">PARTNER_TIER</label>
                  <select 
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.tier}
                    onChange={e => setNewPartner({...newPartner, tier: e.target.value as Partner['tier']})}
                  >
                    <option value="standard">STANDARD</option>
                    <option value="premium">PREMIUM</option>
                    <option value="anchor">ANCHOR</option>
                  </select>
                </div>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">PHYSICAL_ADDRESS (FOR_GEOCODING)</label>
                  <div className="flex gap-2">
                    <input 
                      placeholder="123 Main St, Cincinnati, OH"
                      className="flex-1 bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                      value={newPartner.address}
                      onChange={e => setNewPartner({...newPartner, address: e.target.value})}
                    />
                    <button 
                      type="button"
                      onClick={handleGeocode}
                      disabled={isGeocoding}
                      className="px-4 bg-hud-yellow text-black font-bold text-[10px] hover:bg-hud-yellow/80 disabled:opacity-50"
                    >
                      {isGeocoding ? 'RESOLVING...' : 'RESOLVE_COORDS'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">LATITUDE</label>
                  <input 
                    type="number" step="any"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.lat || ''}
                    onChange={e => setNewPartner({...newPartner, lat: Number(e.target.value)})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">LONGITUDE</label>
                  <input 
                    type="number" step="any"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.lng || ''}
                    onChange={e => setNewPartner({...newPartner, lng: Number(e.target.value)})}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">ASSOCIATE_OWNER_EMAIL</label>
                  <input 
                    type="email"
                    placeholder="partner@example.com"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.owner_email}
                    onChange={e => setNewPartner({...newPartner, owner_email: e.target.value})}
                    required
                  />
                  <p className="text-[8px] opacity-40 mt-1">USER_WILL_GAIN_PARTNER_ACCESS_UPON_LOGIN</p>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">ASSIGNED_USER_ROLE</label>
                  <select 
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.role}
                    onChange={e => setNewPartner({...newPartner, role: e.target.value as UserRole})}
                  >
                    <option value="partner_admin">PARTNER_ADMIN</option>
                    <option value="partner_content_editor">CONTENT_EDITOR</option>
                    <option value="partner_viewer">VIEWER_ONLY</option>
                  </select>
                </div>

                {/* Sponsor Branding Section */}
                <div className="col-span-2 border-t border-white/10 pt-4 mt-2">
                  <div className="text-[10px] text-hud-yellow font-bold mb-4 tracking-widest uppercase">Sponsor_Branding_Config</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] opacity-40 font-bold uppercase">Logo_Upload</label>
                      <LogoUpload 
                        partnerId={generatePartnerId(newPartner.name) || 'temp'} 
                        currentLogoUrl={newPartner.logoUrl}
                        onLogoUploaded={(url) => setNewPartner({...newPartner, logoUrl: url, logoUpdatedAt: new Date().toISOString()})}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[9px] opacity-40 font-bold uppercase">Brand_Color</label>
                      <div className="flex gap-2">
                        <input 
                          type="color"
                          className="w-12 h-11 bg-black border border-white/20 p-1 cursor-pointer"
                          value={newPartner.brandColor}
                          onChange={e => setNewPartner({...newPartner, brandColor: e.target.value})}
                        />
                        <input 
                          className="flex-1 bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none font-mono"
                          value={newPartner.brandColor}
                          onChange={e => setNewPartner({...newPartner, brandColor: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[9px] opacity-40 font-bold uppercase">Deal_Text (Zone_D)</label>
                      <input 
                        placeholder="e.g. 20% off with NFC tap"
                        className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                        value={newPartner.dealText}
                        onChange={e => setNewPartner({...newPartner, dealText: e.target.value})}
                      />
                    </div>
                    <div className="col-span-2 flex flex-col gap-1">
                      <label className="text-[9px] opacity-40 font-bold uppercase">Active_Sponsor_Zones</label>
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
                            <div className={`w-8 h-8 border flex items-center justify-center font-bold text-xs transition-all ${newPartner.sponsorZones.includes(zone) ? 'bg-hud-yellow text-black border-hud-yellow' : 'border-white/20 text-white/40 group-hover:border-hud-yellow/50'}`}>
                              {zone}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <button type="submit" className="bg-hud-yellow text-black font-black p-3 hover:bg-hud-yellow/80 transition-all flex items-center justify-center gap-2 col-span-2 mt-2">
                  {editingPartnerId ? <RefreshCw size={18} /> : <ShieldCheck size={18} />} 
                  {editingPartnerId ? 'UPDATE_PARTNER_CONFIG' : 'AUTHORIZE_PARTNER'}
                </button>
              </form>

              {/* Partners List */}
              <div className="grid gap-4">
                {partners.map(partner => (
                  <div key={partner.id} className="bg-white/5 border border-white/10 p-4 flex justify-between items-center group hover:border-hud-yellow/40 transition-all">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        {(partner.logoUrl || partner.logo_url) && (
                          <img src={partner.logoUrl || partner.logo_url} alt="" className="w-8 h-8 border border-white/10 object-contain bg-black" referrerPolicy="no-referrer" />
                        )}
                        <div className="text-xs font-bold text-hud-yellow">{partner.name}</div>
                        {(partner.brandColor || partner.brand_color) && (
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: partner.brandColor || partner.brand_color }} />
                        )}
                      </div>
                      <div className="text-[10px] opacity-40 font-mono">
                        TIER: {partner.tier?.toUpperCase() || 'STANDARD'} // 
                        OWNER: {partner.owner_email || partner.ownerEmail || 'UNASSIGNED'} //
                        ZONES: {(partner.sponsorZones || partner.sponsor_zones)?.join(', ') || 'NONE'}
                      </div>
                      {(partner.dealText || partner.deal_text) && (
                        <div className="text-[9px] text-hud-yellow/60 mt-1 italic">DEAL: {partner.dealText || partner.deal_text}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[10px] opacity-40">LOCATION</div>
                        <div className="text-[10px] font-mono">{partner.latitude.toFixed(4)}, {partner.longitude.toFixed(4)}</div>
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
                              brandColor: partner.brandColor || partner.brand_color || '#00FF00',
                              dealText: partner.dealText || partner.deal_text || '',
                              sponsorZones: partner.sponsorZones || partner.sponsor_zones || []
                            });
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-2 border border-white/10 hover:border-hud-yellow hover:text-hud-yellow transition-all"
                          title="Edit Partner Configuration"
                        >
                          <RefreshCw size={16} />
                        </button>
                        <button 
                          onClick={() => handleDeletePartner(partner.id, partner.name)}
                          className="p-2 border border-white/10 hover:border-hud-magenta hover:text-hud-magenta transition-all"
                          title="Terminate Partnership"
                        >
                          <Trash2 size={16} />
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
              <div className="flex justify-between items-end mb-8 border-b border-hud-magenta/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-magenta">BROADCAST_CONTROL</h2>
                <div className="text-[10px] text-hud-magenta/40 font-bold">ACTIVE_FEEDS: {broadcasts.length}</div>
              </div>

              {/* Create Broadcast Form */}
              <form onSubmit={handleCreateBroadcast} className="bg-white/5 border border-white/10 p-6 mb-8 grid grid-cols-2 gap-4">
                <div className="col-span-2 text-[10px] text-hud-magenta font-bold mb-2 tracking-widest">IGNITE_NEW_BROADCAST</div>
                <input 
                  placeholder="BROADCAST_TITLE"
                  className="bg-black border border-white/20 p-3 text-sm focus:border-hud-magenta outline-none"
                  value={newBroadcast.title}
                  onChange={e => setNewBroadcast({...newBroadcast, title: e.target.value})}
                  required
                />
                <select 
                  className="bg-black border border-white/20 p-3 text-sm focus:border-hud-magenta outline-none"
                  value={newBroadcast.type}
                  onChange={e => setNewBroadcast({...newBroadcast, type: e.target.value as BroadcastType})}
                >
                  <option value="event">LIVE_EVENT</option>
                  <option value="flash_deal">FLASH_DEAL</option>
                  <option value="conference_panel">CONFERENCE_PANEL</option>
                  <option value="civic_free">CIVIC_FREE</option>
                </select>

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold uppercase tracking-widest">Signal_Location_Source</label>
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setNewBroadcast({...newBroadcast, locationSource: 'node'})}
                      className={`flex-1 p-3 text-[10px] font-bold border transition-all ${newBroadcast.locationSource === 'node' ? 'bg-hud-magenta text-black border-hud-magenta' : 'bg-black text-white/40 border-white/20'}`}
                    >
                      SPECIFIC_HUB_LOCATION
                    </button>
                    <button 
                      type="button"
                      onClick={() => setNewBroadcast({...newBroadcast, locationSource: 'partner'})}
                      className={`flex-1 p-3 text-[10px] font-bold border transition-all ${newBroadcast.locationSource === 'partner' ? 'bg-hud-magenta text-black border-hud-magenta' : 'bg-black text-white/40 border-white/20'}`}
                    >
                      PARTNER_DEFAULT_LOCATION
                    </button>
                  </div>
                </div>

                {newBroadcast.locationSource === 'node' && (
                  <select 
                    className="col-span-2 bg-black border border-white/20 p-3 text-sm focus:border-hud-magenta outline-none"
                    value={newBroadcast.nodeId}
                    onChange={e => setNewBroadcast({...newBroadcast, nodeId: e.target.value})}
                    required={newBroadcast.locationSource === 'node'}
                  >
                    <option value="">SELECT_TARGET_HUB</option>
                    {nodes.map(n => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                )}

                {isAdmin && (
                  <select 
                    className="col-span-2 bg-black border border-white/20 p-3 text-sm focus:border-hud-magenta outline-none"
                    value={newBroadcast.partnerId || ''}
                    onChange={e => setNewBroadcast({...newBroadcast, partnerId: e.target.value})}
                  >
                    <option value="">BROADCAST_AS_SYSTEM</option>
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold uppercase tracking-widest">Signal_Start (Delay)</label>
                  <select 
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-magenta outline-none w-full"
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
                  <label className="text-[9px] opacity-40 font-bold uppercase tracking-widest">Signal_Duration (Live_Time)</label>
                  <select 
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-magenta outline-none w-full"
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
                <button 
                  type="submit" 
                  disabled={!canWrite}
                  className={`bg-hud-magenta text-black font-black p-3 hover:bg-hud-magenta/80 transition-all flex items-center justify-center gap-2 col-span-2 ${!canWrite ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <Send size={18} /> {canWrite ? 'TRANSMIT_SIGNAL' : 'READ_ONLY_ACCESS'}
                </button>
              </form>

              {/* Broadcasts List */}
              <div className="grid gap-4">
                {broadcasts.map(b => {
                  const partner = partners.find(p => p.id === b.partner_id);
                  const node = nodes.find(n => n.id === b.node_id);
                  
                    return (
                      <div key={b.id} className="bg-white/5 border border-white/10 p-4 flex justify-between items-center group hover:border-hud-magenta/40 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`w-2 h-2 rounded-full ${
                            b.current_vibe === 'packed' ? 'bg-hud-magenta shadow-[0_0_8px_rgba(226,75,74,0.5)]' :
                            b.current_vibe === 'buzzing' ? 'bg-hud-yellow shadow-[0_0_8px_rgba(245,200,0,0.5)]' :
                            'bg-hud-green shadow-[0_0_8px_rgba(76,217,138,0.5)]'
                          }`} />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <div className="text-xs font-bold text-hud-magenta">{b.title}</div>
                              {partner && <SponsorBadge partner={partner} zone="A" />}
                            </div>
                            {b.address && (
                              <div className="text-[10px] text-white/60 mb-1 flex items-center gap-1">
                                <MapPin size={10} />
                                {b.address}
                              </div>
                            )}
                            <div className="text-[10px] opacity-40 font-mono">
                              TYPE: {b.type?.toUpperCase() || 'UNKNOWN'} // 
                              HUB: {node?.name || b.node_id || 'UNKNOWN'} // 
                              PARTNER: {partner?.name || (b.partner_id === 'admin' ? 'SYSTEM_ADMIN' : b.partner_id || 'UNKNOWN')} //
                              VIBE: {b.current_vibe?.toUpperCase() || 'UNKNOWN'}
                            </div>
                            {partner && <SponsorBadge partner={partner} zone="D" />}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-hud-magenta mb-1">{getRemainingTime(b)}</div>
                            <div className="text-[9px] opacity-40 font-mono uppercase tracking-widest">EXPIRES_AT: {b.expires_at ? parseDate(b.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'UNKNOWN'}</div>
                          </div>
                          {(isAdmin || (isPartner && userProfile.partner_id === b.partner_id && canWrite)) && (
                            <button 
                              onClick={() => handleRepublish(b)}
                              className="px-3 py-2 hover:bg-hud-magenta/20 text-hud-magenta transition-all border border-hud-magenta/20 hover:border-hud-magenta flex items-center gap-2 text-[10px] font-bold"
                              title="REPUBLISH_SIGNAL"
                            >
                              <RefreshCw size={14} />
                              REPUBLISH
                            </button>
                          )}
                        </div>
                      </div>
                    );
                })}
              </div>
            </div>
          )}
          {activeTab === 'profile' && isPartner && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-yellow/20 pb-4">
                <div>
                  <h2 className="text-2xl font-black tracking-tighter text-hud-yellow">PARTNER_PROFILE_CONFIG</h2>
                  <div className="text-[10px] text-hud-yellow/40 font-bold">PARTNER_ID: {userProfile.partner_id || userProfile.partnerId}</div>
                </div>
                <button 
                  onClick={handleResetBranding}
                  className="flex items-center gap-2 px-4 py-2 border border-hud-magenta/30 text-hud-magenta text-[10px] font-bold hover:bg-hud-magenta/10 transition-all"
                >
                  <RotateCcw size={14} /> RESET_TO_DEFAULTS
                </button>
              </div>

              {partners.find(p => p.id === (userProfile.partner_id || userProfile.partnerId)) ? (
                <div className="bg-white/5 border border-white/10 p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="text-[10px] text-hud-yellow font-bold mb-4 block tracking-widest uppercase">Brand_Identity</label>
                      <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] opacity-40 font-bold uppercase">Partner_Logo</label>
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
                          <label className="text-[9px] opacity-40 font-bold uppercase">Brand_Color</label>
                          <div className="flex gap-3 items-center">
                            <input 
                              type="color"
                              disabled={!canWrite}
                              className={`w-12 h-12 bg-transparent border-none cursor-pointer ${!canWrite ? 'opacity-50 cursor-not-allowed' : ''}`}
                              value={partners.find(p => p.id === userProfile.partner_id)?.brand_color || '#C4832A'}
                              onChange={async (e) => {
                                if (!canWrite) return;
                                try {
                                  await updateDoc(doc(db, 'partners', userProfile.partner_id!), { brand_color: e.target.value });
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.UPDATE, `partners/${userProfile.partner_id}`);
                                }
                              }}
                            />
                            <span className="text-xs font-mono opacity-60 uppercase">{partners.find(p => p.id === userProfile.partner_id)?.brand_color || '#C4832A'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-hud-yellow font-bold mb-4 block tracking-widest uppercase">Promotional_Content</label>
                      <div className="space-y-6">
                        <div className="flex flex-col gap-2">
                          <label className="text-[9px] opacity-40 font-bold uppercase">Deal_Text (Call-to-Action)</label>
                          <textarea 
                            disabled={!canWrite}
                            className={`bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none min-h-[100px] ${!canWrite ? 'opacity-50 cursor-not-allowed' : ''}`}
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

                        <div className="bg-hud-yellow/5 border border-hud-yellow/20 p-4 rounded-xl">
                          <div className="text-[9px] text-hud-yellow font-bold mb-2 uppercase tracking-widest">Live_Preview</div>
                          <div className="border border-white/10 rounded-lg overflow-hidden bg-white">
                            <SponsorBadge partner={partners.find(p => p.id === userProfile.partner_id) || null} zone="A" compact />
                            <div className="p-3">
                              <div className="h-2 w-24 bg-black/10 rounded mb-2" />
                              <div className="h-1.5 w-32 bg-black/5 rounded" />
                              <SponsorBadge partner={partners.find(p => p.id === userProfile.partner_id) || null} zone="D" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center border border-dashed border-white/10 bg-white/[0.02]">
                  <div className="text-hud-magenta font-black tracking-[0.2em] mb-2">PARTNER_ENTITY_NOT_FOUND</div>
                  <div className="text-[10px] opacity-40 uppercase max-w-xs mx-auto leading-relaxed">
                    Your account is not correctly linked to a partner entity. Please contact a system administrator.
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-magenta/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-magenta">
                  {isAdmin ? 'SYSTEM_WIDE_ANALYTICS' : 'SIGNAL_ANALYTICS'}
                </h2>
                <div className="text-[10px] text-hud-magenta/40 font-bold uppercase tracking-widest">
                  {isAdmin ? 'GLOBAL_PULSE_MONITOR' : `PARTNER_ID: ${userProfile.partner_id}`}
                </div>
              </div>

              {/* Top Level Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">TOTAL_NETWORK_TAPS</div>
                  <div className="text-2xl font-black text-hud-green">
                    {isAdmin 
                      ? taps.length 
                      : taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).length}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">UNIQUE_SESSIONS</div>
                  <div className="text-2xl font-black text-hud-yellow">
                    {isAdmin
                      ? new Set(taps.map(t => t.session_uuid)).size
                      : new Set(taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).map(t => t.session_uuid)).size}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">ACTIVE_SIGNALS</div>
                  <div className="text-2xl font-black text-hud-magenta">
                    {broadcasts.filter(b => new Date(b.expires_at) > new Date()).length}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">TAP_VS_BROWSER</div>
                  <div className="flex items-end gap-2">
                    <div className="text-2xl font-black text-hud-magenta">
                      {taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length}
                    </div>
                    <div className="text-[10px] opacity-40 mb-1">/</div>
                    <div className="text-lg font-bold text-white/60 mb-0.5">
                      {taps.filter(t => t.access_vector === 'direct').length}
                    </div>
                  </div>
                </div>
              </div>

              {isAdmin ? (
                <div className="space-y-8">
                  {/* Physical vs Digital Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 border border-white/10 p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-hud-green to-hud-yellow" />
                      <h3 className="text-[10px] font-bold text-white/40 mb-4 tracking-widest uppercase">PHYSICAL_ENGAGEMENT (NFC/QR)</h3>
                      <div className="flex items-end gap-4">
                        <div className="text-4xl font-black text-white">
                          {taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length + 
                           interactions.filter(i => i.access_vector === 'nfc' || i.access_vector === 'qr').length +
                           vibeReports.filter(v => v.access_vector === 'nfc' || v.access_vector === 'qr').length}
                        </div>
                        <div className="text-xs font-mono text-hud-green mb-1">
                          {((taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length + 
                             interactions.filter(i => i.access_vector === 'nfc' || i.access_vector === 'qr').length +
                             vibeReports.filter(v => v.access_vector === 'nfc' || v.access_vector === 'qr').length) / 
                            (taps.length + interactions.length + vibeReports.length + tabViews.length || 1) * 100).toFixed(1)}% OF TOTAL
                        </div>
                      </div>
                    </div>
                    <div className="bg-white/5 border border-white/10 p-6 relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-full h-1 bg-hud-magenta" />
                      <h3 className="text-[10px] font-bold text-white/40 mb-4 tracking-widest uppercase">DIGITAL_ENGAGEMENT (DIRECT)</h3>
                      <div className="flex items-end gap-4">
                        <div className="text-4xl font-black text-white">
                          {taps.filter(t => t.access_vector === 'direct').length + 
                           interactions.filter(i => i.access_vector === 'direct').length +
                           vibeReports.filter(v => v.access_vector === 'direct').length +
                           tabViews.filter(v => v.access_vector === 'direct').length}
                        </div>
                        <div className="text-xs font-mono text-hud-magenta mb-1">
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
                  <div className="bg-white/5 border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-hud-magenta mb-6 tracking-widest uppercase">GLOBAL_ACCESS_VECTOR_BREAKDOWN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                        const color = vector === 'nfc' ? 'text-hud-green' : vector === 'qr' ? 'text-hud-yellow' : 'text-hud-magenta';

                        return (
                          <div key={vector} className="border border-white/10 p-4 relative overflow-hidden group">
                            <div className={`absolute top-0 right-0 w-1 h-full ${color.replace('text-', 'bg-')}`} />
                            <div className={`text-[10px] font-bold ${color} mb-4 tracking-widest uppercase`}>{label}</div>
                            <div className="space-y-4">
                              <div className="flex justify-between items-end">
                                <div>
                                  <div className="text-[9px] opacity-40 font-bold uppercase">Total_Actions</div>
                                  <div className="text-2xl font-black text-white">
                                    {vectorTaps.length + vectorViews.length + vectorInteractions.length + vectorVibes.length}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[9px] opacity-40 font-bold uppercase">Unique_Users</div>
                                  <div className="text-lg font-bold text-white/80">{uniqueUsers}</div>
                                </div>
                              </div>
                              <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-y-2 text-[9px] font-mono opacity-60">
                                <span>TAPS: {vectorTaps.length}</span>
                                <span>VIEWS: {vectorViews.length}</span>
                                <span>INTERACT: {vectorInteractions.length}</span>
                                <span>VIBES: {vectorVibes.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Partner Performance Table */}
                  <div className="bg-white/5 border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-hud-magenta mb-6 tracking-widest uppercase">PARTNER_NETWORK_PERFORMANCE</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/10">
                            <th className="pb-3">PARTNER_IDENTITY</th>
                            <th className="pb-3 text-right">NODES</th>
                            <th className="pb-3 text-right">SIGNALS</th>
                            <th className="pb-3 text-right">TOTAL_TAPS</th>
                            <th className="pb-3 text-right">UNIQUE_TAPS</th>
                            <th className="pb-3 text-right">ACTIVE_UNIQUE</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
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
                              <tr key={p.id} className="group hover:bg-white/[0.02]">
                                <td className="py-4">
                                  <div className="text-xs font-bold text-hud-yellow">{p.name}</div>
                                  <div className="text-[9px] opacity-30 font-mono mt-0.5">{p.id}</div>
                                </td>
                                <td className="py-4 text-right text-[11px] font-mono">{partnerNodes.size}</td>
                                <td className="py-4 text-right text-[11px] font-mono">{partnerBroadcasts.length}</td>
                                <td className="py-4 text-right text-[11px] font-mono text-hud-green">{partnerTaps.length}</td>
                                <td className="py-4 text-right text-[11px] font-mono text-hud-yellow">{partnerUniqueTaps}</td>
                                <td className="py-4 text-right text-[11px] font-mono text-hud-magenta">{activeUniqueTaps}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Node Activity Heatmap-style list */}
                  <div className="bg-white/5 border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-hud-green mb-6 tracking-widest uppercase">SECTOR_HUB_ACTIVITY_LOG</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {nodes.map(node => {
                        const nodeTaps = taps.filter(t => t.node_id === node.id);
                        const nodeUniqueTaps = new Set(nodeTaps.map(t => t.session_uuid)).size;
                        const activeSignals = broadcasts.filter(b => b.node_id === node.id && new Date(b.expires_at) > new Date());

                        return (
                          <div key={node.id} className="border border-white/10 p-4 hover:border-hud-green/40 transition-all">
                            <div className="flex justify-between items-start mb-3">
                              <div>
                                <div className="text-xs font-bold text-hud-green">{node.name}</div>
                                <div className="text-[9px] opacity-30 font-mono">{node.id}</div>
                              </div>
                              <div className={`px-2 py-0.5 rounded text-[8px] font-black ${activeSignals.length > 0 ? 'bg-hud-green text-black' : 'bg-white/10 text-white/40'}`}>
                                {activeSignals.length > 0 ? 'LIVE_SIGNAL' : 'IDLE'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-[9px] opacity-40 font-bold uppercase">Total_Taps</div>
                                <div className="text-lg font-black text-white">{nodeTaps.length}</div>
                              </div>
                              <div>
                                <div className="text-[9px] opacity-40 font-bold uppercase">Unique_Users</div>
                                <div className="text-lg font-black text-white">{nodeUniqueTaps}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Tab Navigation Analytics */}
                  <div className="bg-white/5 border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-hud-yellow mb-6 tracking-widest uppercase">TAB_NAVIGATION_ANALYTICS</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {['feed', 'wallet', 'map'].map(tab => {
                        const views = tabViews.filter(v => v.tab === tab);
                        const uniqueSessions = new Set(views.map(v => v.session_uuid)).size;
                        const tapInTab = taps.filter(t => t.tab === tab).length;

                        return (
                          <div key={tab} className="border border-white/10 p-4 hover:border-hud-yellow/40 transition-all">
                            <div className="text-[10px] font-bold text-hud-yellow mb-3 uppercase tracking-widest">{tab}_VIEW_METRICS</div>
                            <div className="space-y-4">
                              <div>
                                <div className="text-[9px] opacity-40 font-bold uppercase">Total_Views</div>
                                <div className="text-xl font-black text-white">{views.length}</div>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <div className="text-[9px] opacity-40 font-bold uppercase">Unique_Sessions</div>
                                  <div className="text-sm font-bold text-white/80">{uniqueSessions}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] opacity-40 font-bold uppercase">Taps_In_Tab</div>
                                  <div className="text-sm font-bold text-hud-green">{tapInTab}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] opacity-40 font-bold uppercase">Sponsor_Taps</div>
                                  <div className="text-sm font-bold text-hud-magenta">{taps.filter(t => t.tab === tab && t.sponsor_id).length}</div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Physical vs Digital Engagement Comparison */}
                  <div className="bg-white/5 border border-white/10 p-6 col-span-1 md:col-span-2">
                    <h3 className="text-sm font-bold text-hud-yellow mb-6 tracking-widest uppercase">PHYSICAL_VS_DIGITAL_ENGAGEMENT</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Physical (NFC/QR) */}
                      <div className="border-l-2 border-hud-green/30 pl-6">
                        <div className="text-[10px] font-bold text-hud-green mb-4 uppercase tracking-widest">PHYSICAL_VECTORS (NFC/QR)</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">TOTAL_TAPS</div>
                            <div className="text-2xl font-black text-white">{taps.filter(t => t.access_vector === 'nfc' || t.access_vector === 'qr').length}</div>
                          </div>
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">INTERACTIONS</div>
                            <div className="text-2xl font-black text-white">{interactions.filter(i => i.access_vector === 'nfc' || i.access_vector === 'qr').length}</div>
                          </div>
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">VIBE_REPORTS</div>
                            <div className="text-2xl font-black text-white">{vibeReports.filter(r => r.access_vector === 'nfc' || r.access_vector === 'qr').length}</div>
                          </div>
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">TAB_VIEWS</div>
                            <div className="text-2xl font-black text-white">{tabViews.filter(v => v.access_vector === 'nfc' || v.access_vector === 'qr').length}</div>
                          </div>
                        </div>
                      </div>

                      {/* Digital (Direct) */}
                      <div className="border-l-2 border-hud-magenta/30 pl-6">
                        <div className="text-[10px] font-bold text-hud-magenta mb-4 uppercase tracking-widest">DIGITAL_VECTORS (DIRECT)</div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">TOTAL_TAPS</div>
                            <div className="text-2xl font-black text-white">{taps.filter(t => t.access_vector === 'direct').length}</div>
                          </div>
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">INTERACTIONS</div>
                            <div className="text-2xl font-black text-white">{interactions.filter(i => i.access_vector === 'direct').length}</div>
                          </div>
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">VIBE_REPORTS</div>
                            <div className="text-2xl font-black text-white">{vibeReports.filter(r => r.access_vector === 'direct').length}</div>
                          </div>
                          <div>
                            <div className="text-[9px] opacity-40 font-mono">TAB_VIEWS</div>
                            <div className="text-2xl font-black text-white">{tabViews.filter(v => v.access_vector === 'direct').length}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6 col-span-1 md:col-span-2">
                    <h3 className="text-sm font-bold text-hud-yellow mb-6 tracking-widest uppercase">GLOBAL_ACCESS_VECTOR_BREAKDOWN</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        const color = vector === 'nfc' ? 'text-hud-green' : vector === 'qr' ? 'text-hud-yellow' : 'text-hud-magenta';

                        return (
                          <div key={vector} className="border border-white/10 p-4">
                            <div className={`text-[10px] font-bold ${color} mb-2 uppercase tracking-widest`}>{label}</div>
                            <div className="flex items-baseline gap-2">
                              <div className="text-2xl font-black text-white">{totalActions}</div>
                              <div className="text-[10px] opacity-40 font-mono uppercase">ACTIONS</div>
                            </div>
                            <div className="text-[9px] opacity-40 font-mono mt-1">UNIQUE_USERS: {uniqueUsers}</div>
                            
                            <div className="mt-4 space-y-1">
                              <div className="flex justify-between text-[9px] font-mono">
                                <span className="opacity-40 uppercase">TAPS:</span>
                                <span className="text-white">{vectorTaps.length}</span>
                              </div>
                              <div className="flex justify-between text-[9px] font-mono">
                                <span className="opacity-40 uppercase">VIEWS:</span>
                                <span className="text-white">{vectorViews.length}</span>
                              </div>
                              <div className="flex justify-between text-[9px] font-mono">
                                <span className="opacity-40 uppercase">INTERACTIONS:</span>
                                <span className="text-white">{vectorInteractions.length}</span>
                              </div>
                              <div className="flex justify-between text-[9px] font-mono">
                                <span className="opacity-40 uppercase">VIBES:</span>
                                <span className="text-white">{vectorVibes.length}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-hud-magenta mb-4 tracking-widest uppercase">ACTIVE_SIGNAL_PERFORMANCE</h3>
                    <div className="space-y-4">
                      {broadcasts.map(b => {
                        const reports = vibeReports.filter(r => r.broadcast_id === b.id);
                        const packedCount = reports.filter(r => r.vibe === 'packed').length;
                        const buzzingCount = reports.filter(r => r.vibe === 'buzzing').length;
                        const chillCount = reports.filter(r => r.vibe === 'chill').length;
                        
                        return (
                          <div key={b.id} className="border-l-2 border-hud-magenta/20 pl-4 py-2">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold">{b.title}</span>
                              <span className="text-[10px] opacity-40 font-mono uppercase">{b.current_vibe}</span>
                            </div>
                            <div className="flex gap-1 h-1 bg-white/5 rounded-full overflow-hidden">
                              <div className="bg-hud-magenta transition-all duration-500" style={{ width: `${(packedCount / (reports.length || 1)) * 100}%` }} />
                              <div className="bg-hud-yellow transition-all duration-500" style={{ width: `${(buzzingCount / (reports.length || 1)) * 100}%` }} />
                              <div className="bg-hud-green transition-all duration-500" style={{ width: `${(chillCount / (reports.length || 1)) * 100}%` }} />
                            </div>
                            <div className="flex justify-between mt-1">
                              <span className="text-[9px] opacity-40 font-mono">REPORTS: {reports.length}</span>
                              <span className="text-[9px] opacity-40 font-mono">STATUS: {getRemainingTime(b)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {broadcasts.length === 0 && (
                        <div className="text-center py-8 opacity-40 text-xs italic">NO_ACTIVE_SIGNALS_DETECTED</div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 p-6">
                    <h3 className="text-sm font-bold text-hud-green mb-4 tracking-widest uppercase">MY_ACTIVE_HUBS</h3>
                    <div className="space-y-4">
                      {nodes.filter(n => broadcasts.some(b => b.node_id === n.id)).map(node => {
                        const nodeTaps = taps.filter(t => t.node_id === node.id).length;
                        const activeBroadcasts = broadcasts.filter(b => b.node_id === node.id);
                        
                        return (
                          <div key={node.id} className="border-l-2 border-hud-green/20 pl-4 py-2">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-xs font-bold text-hud-green">{node.name}</span>
                              <span className="text-[10px] opacity-40 font-mono uppercase">{node.type}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] opacity-40 font-mono">TOTAL_TAPS: {nodeTaps}</span>
                              <span className="text-[9px] opacity-40 font-mono">SIGNALS: {activeBroadcasts.length}</span>
                            </div>
                          </div>
                        );
                      })}
                      {broadcasts.length === 0 && (
                        <div className="text-center py-8 opacity-40 text-xs italic">NO_HUB_ACTIVITY_DETECTED</div>
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
