import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, storage } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Node, BroadcastType } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Palette, Store, Clock, DollarSign, Zap, ChevronLeft, Loader2, CheckCircle2, AlertCircle, MapPin, Search, Globe, Truck, Navigation, Image as ImageIcon, Link as LinkIcon, Map as MapIcon, List as ListIcon, Share2, ArrowRight } from 'lucide-react';
import { AddressSearchInput } from './AddressSearchInput';
import { LocalPulseLoader } from './LocalPulseLoader';

interface CreatorIntakeWindowProps {
  nodeId?: string;
}

export const CreatorIntakeWindow: React.FC<CreatorIntakeWindowProps> = ({ nodeId: propNodeId }) => {
  const { nodeId: paramNodeId } = useParams<{ nodeId: string }>();
  const nodeId = propNodeId || paramNodeId;
  const navigate = useNavigate();
  
  const [node, setNode] = useState<Node | null>(null);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExploring, setIsExploring] = useState(!nodeId);
  const [igniting, setIgniting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [creatorName, setCreatorName] = useState('');
  const [performanceType, setPerformanceType] = useState('live_event');
  const [duration, setDuration] = useState(1);
  const [tipUrl, setTipUrl] = useState('');
  const [address, setAddress] = useState('');
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);

  // New State
  const [broadcastVisual, setBroadcastVisual] = useState<'upload' | 'url'>('upload');
  const [imageUrl, setImageUrl] = useState('');
  const [scope, setScope] = useState<'single_hub' | 'all_nodes'>('single_hub');
  const [walkDetails, setWalkDetails] = useState({
    title: '',
    price: '',
    capacity: '',
    departureTime: '',
    meetingPoint: '',
    guideName: ''
  });
  const [hubLiveCounts, setHubLiveCounts] = useState<Record<string, number>>({});
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pricing = {
    all_nodes_1hr: 4.99,
    all_nodes_2hr: 7.99,
    all_nodes_4hr: 12.99
  };
  const currentPrice = scope === 'all_nodes' ? (duration === 1 ? pricing.all_nodes_1hr : duration === 2 ? pricing.all_nodes_2hr : pricing.all_nodes_4hr) : 0;

  useEffect(() => {
    const fetchLiveCounts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'broadcasts'));
        const now = new Date();
        const counts: Record<string, number> = {};
        
        querySnapshot.docs.forEach(doc => {
          const data = doc.data();
          const expiresAt = new Date(data.expiresAt || data.expires_at || 0);
          if (expiresAt > now && data.scope !== 'all_nodes' && data.nodeId) {
            counts[data.nodeId] = (counts[data.nodeId] || 0) + 1;
          }
        });
        setHubLiveCounts(counts);
      } catch (err) {
        console.error('Error fetching live counts:', err);
      }
    };
    fetchLiveCounts();
  }, []);

  useEffect(() => {
    const fetchAllNodes = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'nodes'));
        const nodes = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Node));
        setAllNodes(nodes);
      } catch (err) {
        console.error('Error fetching all nodes:', err);
      }
    };

    fetchAllNodes();
  }, []);

  useEffect(() => {
    console.log("CreatorIntakeWindow: nodeId =", nodeId);
    const fetchNode = async () => {
      if (!nodeId) {
        setLoading(false);
        return;
      }
      try {
        console.log("CreatorIntakeWindow: Fetching node", nodeId);
        let nodeDoc = await getDoc(doc(db, 'nodes', nodeId));
        
        // Fallback for case sensitivity
        if (!nodeDoc.exists()) {
          nodeDoc = await getDoc(doc(db, 'nodes', nodeId.toLowerCase()));
          if (!nodeDoc.exists()) {
            nodeDoc = await getDoc(doc(db, 'nodes', nodeId.toUpperCase()));
          }
        }

        console.log("CreatorIntakeWindow: Node exists?", nodeDoc.exists());
        if (nodeDoc.exists()) {
          setNode({ id: nodeDoc.id, ...nodeDoc.data() } as Node);
          setError(null);
          setIsExploring(false);
        } else {
          setError('NODE_NOT_FOUND: This physical anchor is not registered.');
          setIsExploring(true);
        }
      } catch (err) {
        console.error('Error fetching node:', err);
        setError('SYSTEM_ERROR: Could not verify location.');
      } finally {
        setLoading(false);
      }
    };

    fetchNode();
  }, [nodeId]);

  const handleIgnite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creatorName.trim()) return;

    setIgniting(true);
    setError(null);

    try {
      const payload = {
        nodeId: node?.id,
        creatorName,
        performanceType,
        durationHours: duration,
        tipUrl,
        address: performanceType === 'food_truck' ? address : undefined,
        latitude: performanceType === 'food_truck' ? customLat : undefined,
        longitude: performanceType === 'food_truck' ? customLng : undefined,
        scope,
        cover_url: imageUrl,
        payment_type: performanceType === 'walking_event' ? 'stripe' : (tipUrl ? 'tip_jar' : 'free'),
        price: performanceType === 'walking_event' ? parseFloat(walkDetails.price) : 0,
        walk_details: performanceType === 'walking_event' ? walkDetails : undefined
      };

      if (scope === 'all_nodes' || performanceType === 'walking_event') {
        // Trigger Stripe Checkout
        const stripeResponse = await fetch('/api/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: scope === 'all_nodes' ? 'broadcast_all' : 'walking_event_setup',
            amount: scope === 'all_nodes' ? currentPrice : 0, // setup might be free or different
            payload
          })
        });
        const { url } = await stripeResponse.json();
        if (url) window.location.href = url;
        return;
      }

      const response = await fetch('/api/creator/ignite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Redirect after 3 seconds
        setTimeout(() => {
          navigate(`/tap/${nodeId}`);
        }, 3000);
      } else {
        const errorMsg = result.details 
          ? `IGNITE_FAILURE: ${result.error} (${result.details})` 
          : (result.error || 'IGNITE_FAILURE: Could not broadcast signal.');
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Ignite error:', err);
      setError('NETWORK_ERROR: Check your connection and try again.');
    } finally {
      setIgniting(false);
    }
  };

  const handleSelectNode = (selectedNode: Node) => {
    setNode(selectedNode);
    setIsExploring(false);
    setError(null);
    // Update URL without full reload
    window.history.pushState({}, '', `/creator/ignite/${selectedNode.id}`);
  };

  const resolveCurrentLocation = () => {
    setResolvingLocation(true);
    if (!navigator.geolocation) {
      setError('GEOLOCATION_NOT_SUPPORTED: Your browser does not support location services.');
      setResolvingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCustomLat(position.coords.latitude);
        setCustomLng(position.coords.longitude);
        setAddress('CURRENT_GPS_LOCATION');
        setResolvingLocation(false);
        setError(null);
      },
      (err) => {
        console.error('Geolocation error:', err);
        setError('LOCATION_ACCESS_DENIED: Please enable GPS to ignite a mobile node.');
        setResolvingLocation(false);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('FILE_TOO_LARGE: Maximum size is 5MB.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const storageRef = ref(storage, `broadcasts/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      setImageUrl(url);
    } catch (err) {
      console.error('Upload error:', err);
      setError('UPLOAD_FAILURE: Could not store image.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-hud-bg flex flex-col items-center justify-center text-hud-magenta">
        <Loader2 className="animate-spin mb-4" size={48} />
        <div className="text-xs tracking-[0.2em] font-bold uppercase">Verifying_Location_Node...</div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="h-screen bg-hud-bg flex flex-col items-center justify-center text-hud-magenta p-8 text-center">
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mb-6 text-green-500"
        >
          <CheckCircle2 size={80} />
        </motion.div>
        <h1 className="text-2xl font-bold tracking-tighter mb-2 uppercase">Signal_Ignited</h1>
        <p className="text-hud-magenta/60 text-sm mb-8">Your live performance is now broadcasting to the city radar.</p>
        <div className="text-[10px] tracking-[0.3em] uppercase opacity-50">Redirecting_to_Sector_Hub...</div>
      </div>
    );
  }

  if (isExploring) {
    return (
      <div className="min-h-screen bg-hud-bg text-hud-magenta font-sans selection:bg-hud-magenta selection:text-hud-bg">
        <header className="p-6 border-b border-hud-magenta/20 flex items-center justify-between sticky top-0 bg-hud-bg/80 backdrop-blur-md z-10">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-hud-magenta/10 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="flex flex-col items-center">
            <div className="text-[10px] tracking-[0.4em] font-bold uppercase opacity-50">Creator_Protocol</div>
            <div className="text-lg font-bold tracking-tighter uppercase leading-none">Explore_Hubs</div>
          </div>
          <div className="flex items-center bg-hud-magenta/10 rounded-full p-1 border border-hud-magenta/20">
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'list' ? 'bg-hud-magenta text-hud-bg' : 'text-hud-magenta/40'}`}
            >
              <ListIcon size={16} />
            </button>
            <button 
              onClick={() => setViewMode('map')}
              className={`p-1.5 rounded-full transition-all ${viewMode === 'map' ? 'bg-hud-magenta text-hud-bg' : 'text-hud-magenta/40'}`}
            >
              <MapIcon size={16} />
            </button>
          </div>
        </header>

        <main className="p-6 max-w-md mx-auto">
          {viewMode === 'list' ? (
            <>
              <div className="mb-8">
                <h2 className="text-2xl font-bold tracking-tighter uppercase mb-2">Where_to_Post?</h2>
                <p className="text-hud-magenta/60 text-xs leading-relaxed">
                  Select a tactical anchor to broadcast your live signal. Each hub has a unique audience and vibe.
                </p>
              </div>

              <div className="space-y-4">
                {allNodes.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-hud-magenta/20 opacity-40">
                    <Globe className="mx-auto mb-3 animate-pulse" size={32} />
                    <div className="text-[10px] uppercase tracking-widest">Scanning_For_Active_Nodes...</div>
                  </div>
                ) : (
                  allNodes.map((n) => (
                    <motion.button
                      key={n.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSelectNode(n)}
                      className="w-full p-4 border border-hud-magenta/30 bg-hud-magenta/5 rounded-sm flex items-center gap-4 text-left hover:bg-hud-magenta/10 transition-all group"
                    >
                      <div className="w-12 h-12 rounded-full bg-hud-magenta/10 flex items-center justify-center shrink-0 group-hover:bg-hud-magenta/20 transition-colors">
                        <MapPin size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold uppercase tracking-tight truncate">{n.name}</div>
                        <div className="text-[10px] opacity-50 uppercase tracking-widest">{n.type.replace('_', ' ')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {hubLiveCounts[n.id] > 0 && (
                          <div className="bg-hud-magenta/20 text-hud-magenta text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-hud-magenta animate-pulse" />
                            {hubLiveCounts[n.id]} LIVE
                          </div>
                        )}
                        <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </motion.button>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="h-[60vh] w-full bg-hud-magenta/5 border border-hud-magenta/20 rounded-lg flex items-center justify-center relative overflow-hidden">
              <div className="text-[10px] uppercase tracking-[0.3em] opacity-30">Map_View_Initializing...</div>
              {/* Simplified Map Pins for Demo */}
              {allNodes.map((n, i) => (
                <motion.div
                  key={n.id}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="absolute cursor-pointer group"
                  style={{ 
                    left: `${(n.longitude + 84.6) * 1000 % 80 + 10}%`, 
                    top: `${(n.latitude - 39.1) * 1000 % 80 + 10}%` 
                  }}
                  onClick={() => handleSelectNode(n)}
                >
                  <div className={`p-2 rounded-full shadow-lg transition-all group-hover:scale-125 ${hubLiveCounts[n.id] > 0 ? 'bg-uh-yellow text-uh-black' : 'bg-gray-700 text-white'}`}>
                    <MapPin size={16} />
                  </div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-hud-bg/90 backdrop-blur-md border border-hud-magenta/20 px-2 py-0.5 rounded text-[8px] font-bold uppercase whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {n.name}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {error && (
            <div className="mt-8 p-4 border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] uppercase tracking-widest flex items-center gap-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-hud-bg text-hud-magenta font-sans selection:bg-hud-magenta selection:text-hud-bg">
      {/* Header */}
      <header className="p-6 border-b border-hud-magenta/20 flex items-center justify-between sticky top-0 bg-hud-bg/80 backdrop-blur-md z-10">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 hover:bg-hud-magenta/10 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <div className="flex flex-col items-center">
          <div className="text-[10px] tracking-[0.4em] font-bold uppercase opacity-50">Creator_Protocol</div>
          <div className="text-lg font-bold tracking-tighter uppercase leading-none">Flash_Node_Ignite</div>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </header>

      <main className="p-6 max-w-md mx-auto">
        {/* Node Info */}
        <div className="mb-8 p-4 border border-hud-magenta/30 bg-hud-magenta/5 rounded-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-20">
            <Zap size={40} />
          </div>
          <div className="flex justify-between items-start mb-1">
            <div className="text-[10px] tracking-widest uppercase opacity-60">Active_Anchor</div>
            <button 
              onClick={() => setIsExploring(true)}
              className="text-[9px] uppercase tracking-widest font-bold text-hud-magenta/40 hover:text-hud-magenta transition-colors flex items-center gap-1"
            >
              <Search size={10} /> Change_Hub
            </button>
          </div>
          <div className="text-xl font-bold tracking-tight uppercase">{node?.name || 'Unknown_Node'}</div>
          <div className="text-[10px] font-mono opacity-40 mt-1">{node?.latitude.toFixed(4)}, {node?.longitude.toFixed(4)}</div>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 border border-red-500 bg-red-500/10 text-red-500 text-xs flex items-start gap-3"
          >
            <AlertCircle className="shrink-0" size={16} />
            <div>{error}</div>
          </motion.div>
        )}

        <form onSubmit={handleIgnite} className="space-y-8">
          {/* Creator Name */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-3 opacity-70">
              Creator_Identity
            </label>
            <input 
              type="text"
              required
              placeholder="e.g. THE_BLUEGRASS_BOYS"
              value={creatorName}
              onChange={(e) => setCreatorName(e.target.value.toUpperCase())}
              className="w-full bg-transparent border-b-2 border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xl font-bold tracking-tight placeholder:opacity-20 transition-all"
            />
          </section>

          {/* Broadcast Visual */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-4 opacity-70">
              Broadcast_Visual
            </label>
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className={`p-6 border-2 border-dashed rounded-[20px] flex flex-col items-center gap-2 transition-all ${broadcastVisual === 'upload' ? 'border-hud-magenta bg-hud-magenta/5' : 'border-hud-magenta/10 hover:border-hud-magenta/30'}`}
              >
                {uploading ? (
                  <Loader2 size={24} className="text-hud-magenta animate-spin" />
                ) : (
                  <ImageIcon size={24} className={broadcastVisual === 'upload' ? 'text-hud-magenta' : 'text-hud-magenta/40'} />
                )}
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest">
                    {uploading ? 'Uploading...' : 'Upload Photo'}
                  </div>
                  <div className="text-[8px] opacity-40 uppercase">JPG · PNG · WEBP · 5MB</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setBroadcastVisual('url')}
                className={`p-6 border-2 border-dashed rounded-[20px] flex flex-col items-center gap-2 transition-all ${broadcastVisual === 'url' ? 'border-hud-magenta bg-hud-magenta/5' : 'border-hud-magenta/10 hover:border-hud-magenta/30'}`}
              >
                <LinkIcon size={24} className={broadcastVisual === 'url' ? 'text-hud-magenta' : 'text-hud-magenta/40'} />
                <div className="text-center">
                  <div className="text-[10px] font-bold uppercase tracking-widest">Paste URL</div>
                  <div className="text-[8px] opacity-40 uppercase">Any public image link</div>
                </div>
              </button>
            </div>
            
            {broadcastVisual === 'url' && (
              <input 
                type="url"
                placeholder="https://example.com/image.jpg"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full mt-4 bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20 transition-all"
              />
            )}
            
            {imageUrl && (
              <div className="mt-4 h-32 w-full rounded-lg overflow-hidden border border-hud-magenta/20">
                <img src={imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </section>

          {/* Category Type */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-4 opacity-70">
              Category_Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: BroadcastType.LIVE_EVENT, label: 'LIVE EVENT', icon: Music },
                { id: BroadcastType.FOOD_TRUCK, label: 'FOOD TRUCK', icon: Truck },
                { id: BroadcastType.WALKING_EVENT, label: 'WALKING EVENT', icon: Navigation },
                { id: BroadcastType.POP_UP, label: 'POP-UP', icon: Store },
                { id: BroadcastType.STREET_ART, label: 'STREET ART', icon: Palette },
                { id: BroadcastType.FLASH_DEAL, label: 'FLASH DEAL', icon: Zap },
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setPerformanceType(type.id)}
                  className={`flex flex-col items-center justify-center p-5 border-2 rounded-[20px] transition-all ${
                    performanceType === type.id 
                      ? 'border-hud-magenta bg-hud-magenta/5 text-hud-magenta' 
                      : 'border-hud-magenta/10 hover:border-hud-magenta/30 text-hud-magenta/60'
                  }`}
                >
                  <type.icon size={24} className="mb-2" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-center">{type.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Walk Details */}
          <AnimatePresence>
            {performanceType === 'walking_event' && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-6 border-l-2 border-hud-magenta/20 pl-4 py-2"
              >
                <label className="block text-[10px] tracking-[0.2em] font-bold uppercase opacity-70">
                  Walk_Details
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <input 
                      type="text"
                      placeholder="WALK_TITLE"
                      value={walkDetails.title}
                      onChange={(e) => setWalkDetails({...walkDetails, title: e.target.value})}
                      className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-sm font-bold placeholder:opacity-20"
                    />
                  </div>
                  <div>
                    <input 
                      type="number"
                      placeholder="PRICE_PER_PERSON ($)"
                      value={walkDetails.price}
                      onChange={(e) => setWalkDetails({...walkDetails, price: e.target.value})}
                      className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20"
                    />
                  </div>
                  <div>
                    <input 
                      type="number"
                      placeholder="MAX_CAPACITY"
                      value={walkDetails.capacity}
                      onChange={(e) => setWalkDetails({...walkDetails, capacity: e.target.value})}
                      className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20"
                    />
                  </div>
                  <div>
                    <input 
                      type="time"
                      placeholder="DEPARTURE_TIME"
                      value={walkDetails.departureTime}
                      onChange={(e) => setWalkDetails({...walkDetails, departureTime: e.target.value})}
                      className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20"
                    />
                  </div>
                  <div>
                    <input 
                      type="text"
                      placeholder="GUIDE_NAME"
                      value={walkDetails.guideName}
                      onChange={(e) => setWalkDetails({...walkDetails, guideName: e.target.value})}
                      className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20"
                    />
                  </div>
                  <div className="col-span-2">
                    <input 
                      type="text"
                      placeholder="MEETING_POINT"
                      value={walkDetails.meetingPoint}
                      onChange={(e) => setWalkDetails({...walkDetails, meetingPoint: e.target.value})}
                      className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20"
                    />
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Location Resolution for Food Trucks */}
          <AnimatePresence>
            {performanceType === 'food_truck' && (
              <motion.section
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-3 opacity-70">
                  Mobile_Location_Resolution
                </label>
                <div className="space-y-4">
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <AddressSearchInput 
                        value={address === 'CURRENT_GPS_LOCATION' ? '' : address}
                        onSelect={async (addr) => {
                          setAddress(addr);
                          setResolvingLocation(true);
                          try {
                            const response = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`);
                            if (response.ok) {
                              const data = await response.json();
                              if (data && data.lat && data.lon) {
                                setCustomLat(parseFloat(data.lat));
                                setCustomLng(parseFloat(data.lon));
                              }
                            }
                          } catch (err) {
                            console.error("Auto-geocode error:", err);
                          } finally {
                            setResolvingLocation(false);
                          }
                        }}
                        placeholder="ENTER_STREET_ADDRESS"
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={resolveCurrentLocation}
                        disabled={resolvingLocation}
                        className="px-4 py-3 bg-hud-magenta text-hud-bg rounded-2xl hover:bg-hud-magenta/80 transition-all flex items-center gap-2 text-[10px] font-black uppercase shadow-lg shadow-hud-magenta/20"
                      >
                        {resolvingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                        GPS
                      </button>
                    </div>
                  </div>
                  {customLat && customLng && address && (
                    <div className="text-[9px] font-mono text-green-500/80 uppercase tracking-widest flex items-center gap-2 bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                      <CheckCircle2 size={10} />
                      RESOLVED: {customLat.toFixed(4)}, {customLng.toFixed(4)}
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>

          {/* Duration */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-4 opacity-70">
              Signal_Duration
            </label>
            <div className="flex gap-2">
              {[1, 2, 4].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setDuration(h)}
                  className={`flex-1 py-3 border-2 rounded-[20px] text-xs font-bold transition-all ${
                    duration === h 
                      ? 'bg-hud-magenta text-hud-bg border-hud-magenta' 
                      : 'border-hud-magenta/10 hover:border-hud-magenta/30'
                  }`}
                >
                  {h}_HR{h > 1 ? 'S' : ''}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[9px] opacity-40 italic flex items-center gap-1">
              <Clock size={10} /> Signal vanishes automatically after duration expires.
            </div>
          </section>

          {/* Broadcast Scope */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-4 opacity-70">
              Broadcast_Scope
            </label>
            <div className="flex bg-hud-magenta/5 rounded-[20px] p-1 border border-hud-magenta/10">
              <button
                type="button"
                onClick={() => setScope('single_hub')}
                className={`flex-1 py-4 rounded-[18px] transition-all flex flex-col items-center ${scope === 'single_hub' ? 'bg-white text-uh-black shadow-lg' : 'text-hud-magenta/40'}`}
              >
                <div className="text-[10px] font-black uppercase tracking-widest">This Hub Only</div>
                <div className="text-[12px] font-black">Free</div>
                <div className="text-[8px] opacity-50 uppercase">{node?.name || 'Alpha Plaza'} only</div>
              </button>
              <button
                type="button"
                onClick={() => setScope('all_nodes')}
                className={`flex-1 py-4 rounded-[18px] transition-all flex flex-col items-center ${scope === 'all_nodes' ? 'bg-hud-magenta text-white shadow-lg' : 'text-hud-magenta/40'}`}
              >
                <div className="text-[10px] font-black uppercase tracking-widest">All Nodes</div>
                <div className="text-[12px] font-black">${currentPrice}</div>
                <div className="text-[8px] opacity-50 uppercase">All 8 active hubs</div>
              </button>
            </div>
            
            <AnimatePresence>
              {scope === 'all_nodes' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 p-4 bg-hud-magenta/5 border border-hud-magenta/20 rounded-[12px] flex items-start gap-3"
                >
                  <Zap size={16} className="text-hud-magenta shrink-0" />
                  <div className="text-[10px] font-bold text-hud-magenta uppercase leading-relaxed">
                    Your signal broadcasts to all 8 active hubs simultaneously
                    <div className="opacity-50 mt-1 text-[8px]">
                      Alpha Plaza · Lydia's · Downtown · Beta Concourse · Gamma Gardens · The Loon · Urban Hikers · Urbana Cafe
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Tip Jar */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-3 opacity-70">
              Digital_Tip_Jar (Optional)
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-hud-magenta/40">
                <Share2 size={16} />
              </div>
              <input 
                type="url"
                placeholder="Venmo or CashApp URL"
                value={tipUrl}
                onChange={(e) => setTipUrl(e.target.value)}
                className="w-full bg-transparent border border-hud-magenta/20 rounded-[12px] py-3 pl-10 text-sm font-mono placeholder:opacity-20 focus:border-hud-magenta outline-none transition-all"
              />
            </div>
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={igniting || !creatorName.trim()}
            className={`w-full py-5 rounded-[24px] font-black tracking-[0.3em] uppercase transition-all flex flex-col items-center justify-center gap-1 ${
              igniting || !creatorName.trim()
                ? 'bg-hud-magenta/20 text-hud-magenta/40 cursor-not-allowed'
                : 'bg-[#1A1A1A] text-white hover:scale-[1.02] active:scale-95 shadow-xl'
            }`}
          >
            {igniting ? (
              <div className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={20} />
                Igniting_Signal...
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Zap size={20} className="text-uh-yellow" />
                  {scope === 'all_nodes' ? `Broadcast to All — Pay $${currentPrice}` : 'Ignite Flash Node'}
                </div>
              </>
            )}
          </button>
        </form>
      </main>

      <footer className="p-8 text-center opacity-30">
        <div className="text-[10px] tracking-[0.2em] uppercase font-bold">Urban_Hikers_Protocol_v2.5</div>
      </footer>
    </div>
  );
};
