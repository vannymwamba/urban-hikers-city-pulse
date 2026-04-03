import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { Node } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Palette, Store, Clock, DollarSign, Zap, ChevronLeft, Loader2, CheckCircle2, AlertCircle, MapPin, Search, Globe, Truck, Navigation } from 'lucide-react';

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
  const [performanceType, setPerformanceType] = useState('Live Music');
  const [duration, setDuration] = useState(1);
  const [tipUrl, setTipUrl] = useState('');
  const [address, setAddress] = useState('');
  const [customLat, setCustomLat] = useState<number | null>(null);
  const [customLng, setCustomLng] = useState<number | null>(null);
  const [resolvingLocation, setResolvingLocation] = useState(false);

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
        const nodeDoc = await getDoc(doc(db, 'nodes', nodeId));
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
      const response = await fetch('/api/creator/ignite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: node?.id,
          creatorName,
          performanceType,
          durationHours: duration,
          tipUrl,
          address: performanceType === 'Food Truck' ? address : undefined,
          latitude: performanceType === 'Food Truck' ? customLat : undefined,
          longitude: performanceType === 'Food Truck' ? customLng : undefined
        })
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess(true);
        // Redirect after 3 seconds
        setTimeout(() => {
          navigate(`/tap/${nodeId}`);
        }, 3000);
      } else {
        setError(result.error || 'IGNITE_FAILURE: Could not broadcast signal.');
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
          <div className="w-10" />
        </header>

        <main className="p-6 max-w-md mx-auto">
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
                  <Zap size={16} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.button>
              ))
            )}
          </div>

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

          {/* Performance Type */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-4 opacity-70">
              Performance_Type
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'Live Music', icon: Music },
                { id: 'Street Art', icon: Palette },
                { id: 'Pop-up', icon: Store },
                { id: 'Food Truck', icon: Truck }
              ].map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setPerformanceType(type.id)}
                  className={`flex flex-col items-center justify-center p-3 border transition-all ${
                    performanceType === type.id 
                      ? 'bg-hud-magenta text-hud-bg border-hud-magenta' 
                      : 'border-hud-magenta/20 hover:border-hud-magenta/50'
                  }`}
                >
                  <type.icon size={18} className="mb-1.5" />
                  <span className="text-[8px] font-bold uppercase tracking-tighter text-center">{type.id}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Location Resolution for Food Trucks */}
          <AnimatePresence>
            {performanceType === 'Food Truck' && (
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
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      placeholder="ENTER_STREET_ADDRESS"
                      value={address === 'CURRENT_GPS_LOCATION' ? '' : address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="flex-1 bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 text-xs font-mono placeholder:opacity-20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={resolveCurrentLocation}
                      disabled={resolvingLocation}
                      className="px-4 py-2 bg-hud-magenta/10 border border-hud-magenta/30 hover:bg-hud-magenta/20 transition-all flex items-center gap-2 text-[10px] font-bold uppercase"
                    >
                      {resolvingLocation ? <Loader2 size={12} className="animate-spin" /> : <Navigation size={12} />}
                      GPS
                    </button>
                  </div>
                  {customLat && customLng && (
                    <div className="text-[9px] font-mono text-green-500/80 uppercase tracking-widest">
                      Resolved: {customLat.toFixed(4)}, {customLng.toFixed(4)}
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
                  className={`flex-1 py-3 border text-xs font-bold transition-all ${
                    duration === h 
                      ? 'bg-hud-magenta text-hud-bg border-hud-magenta' 
                      : 'border-hud-magenta/20 hover:border-hud-magenta/50'
                  }`}
                >
                  {h}_HR{h > 1 ? 'S' : ''}
                </button>
              ))}
            </div>
            <div className="mt-2 text-[9px] opacity-40 italic flex items-center gap-1">
              <Clock size={10} /> Signal will automatically vanish after duration expires.
            </div>
          </section>

          {/* Tip Jar */}
          <section>
            <label className="block text-[10px] tracking-[0.2em] font-bold uppercase mb-3 opacity-70">
              Digital_Tip_Jar (Optional)
            </label>
            <div className="relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 text-hud-magenta/40">
                <DollarSign size={18} />
              </div>
              <input 
                type="url"
                placeholder="VENMO_OR_CASHAPP_URL"
                value={tipUrl}
                onChange={(e) => setTipUrl(e.target.value)}
                className="w-full bg-transparent border-b border-hud-magenta/30 focus:border-hud-magenta outline-none py-2 pl-7 text-sm font-mono placeholder:opacity-20 transition-all"
              />
            </div>
          </section>

          {/* Submit */}
          <button
            type="submit"
            disabled={igniting || !creatorName.trim()}
            className={`w-full py-5 font-bold tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-3 ${
              igniting || !creatorName.trim()
                ? 'bg-hud-magenta/20 text-hud-magenta/40 cursor-not-allowed'
                : 'bg-hud-magenta text-hud-bg hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,0,255,0.3)]'
            }`}
          >
            {igniting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Igniting_Signal...
              </>
            ) : (
              <>
                <Zap size={20} />
                Ignite_Flash_Node
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
