import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, doc, setDoc, getDocs, updateDoc } from 'firebase/firestore';
import { Node, Broadcast, UserProfile, Partner, BroadcastType, HubType, VibeReport, Tap } from '../types';
import { Plus, MapPin, Link as LinkIcon, Send, LayoutDashboard, LogOut, ChevronRight, Globe, ShieldCheck, RefreshCw, BarChart3 } from 'lucide-react';
import { motion } from 'motion/react';
import { handleFirestoreError, OperationType } from '../utils/firebaseErrors';

interface DashboardProps {
  userProfile: UserProfile;
  onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ userProfile, onLogout }) => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [vibeReports, setVibeReports] = useState<VibeReport[]>([]);
  const [taps, setTaps] = useState<Tap[]>([]);
  
  // Form states
  const [newNode, setNewNode] = useState({ name: '', type: 'street' as HubType, address: '', lat: 0, lng: 0, radius: 500 });
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [newBroadcast, setNewBroadcast] = useState({ 
    title: '', 
    type: 'event' as BroadcastType, 
    nodeId: '', 
    startTimeOffset: 0, 
    duration: 60, 
    partnerId: '',
    locationSource: 'node' as 'node' | 'partner'
  });
  const [newPartner, setNewPartner] = useState({ name: '', tier: 'standard' as Partner['tier'], address: '', lat: 0, lng: 0, ownerEmail: '' });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'hubs' | 'broadcasts' | 'partners' | 'analytics'>(userProfile.role === 'admin' ? 'hubs' : 'broadcasts');
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000); // Update every 30s
    return () => clearInterval(timer);
  }, []);

  const getRemainingTime = (b: Broadcast) => {
    const now = new Date();
    const start = new Date(b.starts_at);
    const expiry = new Date(b.expires_at);

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
    if (userProfile.role === 'admin') {
      const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) => {
        setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Node)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'nodes'));
      const unsubPartners = onSnapshot(collection(db, 'partners'), (snap) => {
        setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Partner)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'partners'));
      const unsubBroadcasts = onSnapshot(collection(db, 'broadcasts'), (snap) => {
        setBroadcasts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'broadcasts'));
      const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
        setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));
      const unsubVibeReports = onSnapshot(collection(db, 'vibe_reports'), (snap) => {
        setVibeReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as VibeReport)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'vibe_reports'));
      const unsubTaps = onSnapshot(collection(db, 'taps'), (snap) => {
        setTaps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tap)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'taps'));
      return () => { unsubNodes(); unsubPartners(); unsubBroadcasts(); unsubUsers(); unsubVibeReports(); unsubTaps(); };
    }
 else if (userProfile.role === 'partner' && userProfile.partner_id) {
      const unsubBroadcasts = onSnapshot(
        query(collection(db, 'broadcasts'), where('partner_id', '==', userProfile.partner_id)),
        (snap) => {
          const bData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Broadcast));
          setBroadcasts(bData);
          
          // Fetch vibe reports for these broadcasts
          const bIds = bData.map(b => b.id);
          if (bIds.length > 0) {
            // Firestore 'in' query limit is 10, but for simplicity let's assume small number or fetch all and filter
            const unsubVibes = onSnapshot(collection(db, 'vibe_reports'), (vSnap) => {
              setVibeReports(vSnap.docs.map(d => ({ id: d.id, ...d.data() } as VibeReport)).filter(v => bIds.includes(v.broadcast_id)));
            }, (err) => handleFirestoreError(err, OperationType.LIST, 'vibe_reports'));
            return () => unsubVibes();
          }
        }, (err) => handleFirestoreError(err, OperationType.LIST, 'broadcasts')
      );
      const unsubNodes = onSnapshot(collection(db, 'nodes'), (snap) => {
        setNodes(snap.docs.map(d => ({ id: d.id, ...d.data() } as Node)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'nodes'));
      const unsubTaps = onSnapshot(collection(db, 'taps'), (snap) => {
        setTaps(snap.docs.map(d => ({ id: d.id, ...d.data() } as Tap)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'taps'));
      const unsubPartners = onSnapshot(collection(db, 'partners'), (snap) => {
        setPartners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Partner)).filter(p => p.id === userProfile.partner_id));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'partners'));
      return () => { unsubBroadcasts(); unsubNodes(); unsubTaps(); unsubPartners(); };
    }
  }, [userProfile]);

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userProfile.role !== 'admin') return;
    
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
    if (userProfile.role !== 'admin') return;
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

  const handleCreateBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userProfile.role !== 'partner' && userProfile.role !== 'admin') return;

    const startsAt = new Date(Date.now() + newBroadcast.startTimeOffset * 60000).toISOString();
    const expiresAt = new Date(new Date(startsAt).getTime() + newBroadcast.duration * 60000).toISOString();
    
    const partnerId = userProfile.role === 'admin' ? (newBroadcast.partnerId || 'admin') : (userProfile.partner_id || 'admin');
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
      // If using partner location, we might still want to associate it with a node if it's nearby, 
      // but for now let's just use the partner's coordinates.
    } else if (targetNode) {
      latitude = targetNode.latitude;
      longitude = targetNode.longitude;
      address = targetNode.address || '';
    }
    
    try {
      await addDoc(collection(db, 'broadcasts'), {
        title: newBroadcast.title,
        type: newBroadcast.type,
        node_id: nodeId,
        partner_id: partnerId,
        latitude,
        longitude,
        address,
        starts_at: startsAt,
        expires_at: expiresAt,
        current_vibe: 'chill'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'broadcasts');
    }
    setHudMessage({ text: `SIGNAL_TRANSMITTED: ${newBroadcast.title.toUpperCase()}`, type: 'info' });
    setNewBroadcast({ title: '', type: 'event', nodeId: '', startTimeOffset: 0, duration: 60, partnerId: '', locationSource: 'node' });
  };

  const handleRepublish = async (b: Broadcast) => {
    if (userProfile.role !== 'admin' && userProfile.partner_id !== b.partner_id) return;

    const duration = 60; // Default 60 mins for republish
    const startsAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + duration * 60000).toISOString();
    
    try {
      await addDoc(collection(db, 'broadcasts'), {
        title: b.title,
        type: b.type,
        node_id: b.node_id,
        partner_id: b.partner_id,
        latitude: b.latitude,
        longitude: b.longitude,
        address: b.address,
        starts_at: startsAt,
        expires_at: expiresAt,
        current_vibe: 'chill'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'broadcasts');
    }
    setHudMessage({ text: `SIGNAL_REBROADCAST: ${b.title.toUpperCase()}`, type: 'info' });
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
    if (userProfile.role !== 'admin') return;

    const id = newPartner.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    if (!id) {
      setHudMessage({ text: "INVALID_PARTNER_NAME", type: 'error' });
      return;
    }
    
    try {
      // 1. Create Partner document
      await setDoc(doc(db, 'partners', id), {
        name: newPartner.name,
        tier: newPartner.tier,
        latitude: Number(newPartner.lat),
        longitude: Number(newPartner.lng),
        owner_email: newPartner.ownerEmail.toLowerCase().trim()
      });

      // 2. Update User Profile if a user with this email already exists
      const userQuery = query(collection(db, 'users'), where('email', '==', newPartner.ownerEmail.toLowerCase().trim()));
      let userSnap;
      try {
        userSnap = await getDocs(userQuery);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'users');
        return;
      }
      
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        try {
          await setDoc(doc(db, 'users', userDoc.id), {
            role: 'partner',
            partner_id: id
          }, { merge: true });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${userDoc.id}`);
        }
      }

      setHudMessage({ text: `PARTNER_ONBOARDED: ${newPartner.name.toUpperCase()}`, type: 'info' });
      setNewPartner({ name: '', tier: 'standard', address: '', lat: 0, lng: 0, ownerEmail: '' });
    } catch (err) {
      console.error("Partner creation error:", err);
      setHudMessage({ text: "PARTNER_CREATION_FAILED", type: 'error' });
    }
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
          <button onClick={onLogout} className="flex items-center gap-2 text-hud-magenta hover:bg-hud-magenta/10 px-4 py-2 border border-hud-magenta transition-all text-xs font-bold">
            <LogOut size={16} /> TERMINATE_SESSION
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Navigation */}
        <nav className="w-64 border-r border-white/10 p-4 flex flex-col gap-2 bg-hud-dark/50">
          {(userProfile.role === 'admin' || userProfile.role === 'partner') && (
            <button 
              onClick={() => setActiveTab('hubs')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'hubs' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
            >
              <Globe size={18} /> SECTOR_HUBS
            </button>
          )}
          {userProfile.role === 'admin' && (
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
          {(userProfile.role === 'partner' || userProfile.role === 'admin') && (
            <button 
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-3 p-3 text-sm font-bold transition-all ${activeTab === 'analytics' ? 'bg-hud-green text-black' : 'hover:bg-white/5 text-hud-green/60'}`}
            >
              <BarChart3 size={18} /> {userProfile.role === 'admin' ? 'SYSTEM_ANALYTICS' : 'SIGNAL_ANALYTICS'}
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

          {activeTab === 'hubs' && (userProfile.role === 'admin' || userProfile.role === 'partner') && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-green/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-green">SECTOR_HUB_MANAGEMENT</h2>
                <div className="flex flex-col items-end">
                  <div className="flex items-center gap-4 mb-2">
                    {userProfile.role === 'admin' && (
                      <button 
                        onClick={handleRestoreData}
                        disabled={isSeeding}
                        className="flex items-center gap-2 px-3 py-1 border border-hud-yellow/30 text-hud-yellow text-[9px] font-bold hover:bg-hud-yellow/10 transition-all disabled:opacity-50"
                      >
                        <RefreshCw size={12} className={isSeeding ? 'animate-spin' : ''} />
                        RESTORE_SYSTEM_DATA
                      </button>
                    )}
                    <div className="text-[10px] text-hud-green/40 font-bold uppercase">
                      {userProfile.role === 'admin' ? `ACTIVE_NODES: ${nodes.length}` : `HOSTING_HUBS: ${nodes.filter(n => broadcasts.some(b => b.node_id === n.id)).length}`}
                    </div>
                  </div>
                  {userProfile.role === 'partner' && (
                    <div className="text-[10px] text-hud-yellow font-bold uppercase mt-1">
                      TOTAL_NETWORK_TAPS: {taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).length}
                    </div>
                  )}
                </div>
              </div>

              {/* Create/Edit Node Form - Admin Only */}
              {userProfile.role === 'admin' && (
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
                  .filter(node => userProfile.role === 'admin' || broadcasts.some(b => b.node_id === node.id))
                  .map(node => (
                    <div key={node.id} className="bg-white/5 border border-white/10 p-4 flex justify-between items-center group hover:border-hud-green/40 transition-all">
                      <div className="flex-1">
                        <div className="text-xs font-bold text-hud-green mb-1">{node.name}</div>
                        <div className="text-[10px] opacity-40 font-mono">ID: {node.id} // TYPE: {node.type.toUpperCase()}</div>
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
                          {userProfile.role === 'admin' && (
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
                              const url = `${window.location.origin}/tap/${node.id}`;
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
                      {userProfile.role === 'admin' && " Use the RESTORE_SYSTEM_DATA button above to re-seed the tactical grid."}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'partners' && userProfile.role === 'admin' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-yellow/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-yellow">PARTNER_NETWORK_ADMIN</h2>
                <div className="text-[10px] text-hud-yellow/40 font-bold">ACTIVE_PARTNERS: {partners.length}</div>
              </div>

              {/* Create Partner Form */}
              <form onSubmit={handleCreatePartner} className="bg-white/5 border border-white/10 p-6 mb-8 grid grid-cols-2 gap-4">
                <div className="col-span-2 text-[10px] text-hud-yellow font-bold mb-2 tracking-widest">ONBOARD_NEW_PARTNER</div>
                
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

                <div className="col-span-2 flex flex-col gap-1">
                  <label className="text-[9px] opacity-40 font-bold">ASSOCIATE_OWNER_EMAIL</label>
                  <input 
                    type="email"
                    placeholder="partner@example.com"
                    className="bg-black border border-white/20 p-3 text-sm focus:border-hud-yellow outline-none"
                    value={newPartner.ownerEmail}
                    onChange={e => setNewPartner({...newPartner, ownerEmail: e.target.value})}
                    required
                  />
                  <p className="text-[8px] opacity-40 mt-1">USER_WILL_GAIN_PARTNER_ACCESS_UPON_LOGIN</p>
                </div>

                <button type="submit" className="bg-hud-yellow text-black font-black p-3 hover:bg-hud-yellow/80 transition-all flex items-center justify-center gap-2 col-span-2 mt-2">
                  <ShieldCheck size={18} /> AUTHORIZE_PARTNER
                </button>
              </form>

              {/* Partners List */}
              <div className="grid gap-4">
                {partners.map(partner => (
                  <div key={partner.id} className="bg-white/5 border border-white/10 p-4 flex justify-between items-center group hover:border-hud-yellow/40 transition-all">
                    <div>
                      <div className="text-xs font-bold text-hud-yellow mb-1">{partner.name}</div>
                      <div className="text-[10px] opacity-40 font-mono">
                        TIER: {partner.tier.toUpperCase()} // 
                        OWNER: {partner.owner_email || 'UNASSIGNED'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] opacity-40">LOCATION</div>
                      <div className="text-[10px] font-mono">{partner.latitude.toFixed(4)}, {partner.longitude.toFixed(4)}</div>
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

                {userProfile.role === 'admin' && (
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
                <button type="submit" className="bg-hud-magenta text-black font-black p-3 hover:bg-hud-magenta/80 transition-all flex items-center justify-center gap-2 col-span-2">
                  <Send size={18} /> TRANSMIT_SIGNAL
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
                            <div className="text-xs font-bold text-hud-magenta mb-1">{b.title}</div>
                            {b.address && (
                              <div className="text-[10px] text-white/60 mb-1 flex items-center gap-1">
                                <MapPin size={10} />
                                {b.address}
                              </div>
                            )}
                            <div className="text-[10px] opacity-40 font-mono">
                              TYPE: {b.type.toUpperCase()} // 
                              HUB: {node?.name || b.node_id || 'UNKNOWN'} // 
                              PARTNER: {partner?.name || (b.partner_id === 'admin' ? 'SYSTEM_ADMIN' : b.partner_id || 'UNKNOWN')} //
                              VIBE: {b.current_vibe.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-hud-magenta mb-1">{getRemainingTime(b)}</div>
                            <div className="text-[9px] opacity-40 font-mono uppercase tracking-widest">EXPIRES_AT: {new Date(b.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                          {(userProfile.role === 'admin' || userProfile.partner_id === b.partner_id) && (
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
          {activeTab === 'analytics' && (
            <div className="max-w-4xl mx-auto">
              <div className="flex justify-between items-end mb-8 border-b border-hud-magenta/20 pb-4">
                <h2 className="text-2xl font-black tracking-tighter text-hud-magenta">
                  {userProfile.role === 'admin' ? 'SYSTEM_WIDE_ANALYTICS' : 'SIGNAL_ANALYTICS'}
                </h2>
                <div className="text-[10px] text-hud-magenta/40 font-bold uppercase tracking-widest">
                  {userProfile.role === 'admin' ? 'GLOBAL_PULSE_MONITOR' : `PARTNER_ID: ${userProfile.partner_id}`}
                </div>
              </div>

              {/* Top Level Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">TOTAL_NETWORK_TAPS</div>
                  <div className="text-2xl font-black text-hud-green">
                    {userProfile.role === 'admin' 
                      ? taps.length 
                      : taps.filter(t => broadcasts.some(b => b.node_id === t.node_id)).length}
                  </div>
                </div>
                <div className="bg-white/5 border border-white/10 p-5">
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">UNIQUE_SESSIONS</div>
                  <div className="text-2xl font-black text-hud-yellow">
                    {userProfile.role === 'admin'
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
                  <div className="text-[9px] opacity-40 font-bold mb-2 tracking-widest">
                    {userProfile.role === 'admin' ? 'ACTIVE_PARTNERS' : 'VIBE_REPORTS'}
                  </div>
                  <div className="text-2xl font-black text-white">
                    {userProfile.role === 'admin' ? partners.length : vibeReports.length}
                  </div>
                </div>
              </div>

              {userProfile.role === 'admin' ? (
                <div className="space-y-8">
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
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {partners.map(p => {
                            const partnerBroadcasts = broadcasts.filter(b => b.partner_id === p.id);
                            const partnerNodes = new Set(partnerBroadcasts.map(b => b.node_id));
                            const partnerTaps = taps.filter(t => partnerNodes.has(t.node_id));
                            const partnerUniqueTaps = new Set(partnerTaps.map(t => t.session_uuid)).size;

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
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                              <div className="bg-hud-magenta" style={{ width: `${(packedCount / (reports.length || 1)) * 100}%` }} />
                              <div className="bg-hud-yellow" style={{ width: `${(buzzingCount / (reports.length || 1)) * 100}%` }} />
                              <div className="bg-hud-green" style={{ width: `${(chillCount / (reports.length || 1)) * 100}%` }} />
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
