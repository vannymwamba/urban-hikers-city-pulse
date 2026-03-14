import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, where, addDoc, doc, getDoc, setDoc, getDocs, orderBy, getDocFromServer } from 'firebase/firestore';
import { Node, Broadcast, Vibe, UserProfile, UserRole } from './types';
import { DepartureBoard } from './components/DepartureBoard';
import { VibeCheck } from './components/VibeCheck';
import { VibeTrend } from './components/VibeTrend';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import seedData from './seed';
import { getDistance } from './utils/geo';
import { handleFirestoreError, OperationType } from './utils/firebaseErrors';

import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertTriangle, Share2 } from 'lucide-react';

// Session UUID for anonymous tracking
const SESSION_ID = (() => {
  let id = localStorage.getItem('uh_session_id');
  if (!id) {
    id = uuidv4();
    localStorage.setItem('uh_session_id', id);
  }
  return id;
})();

// Detect access vector from URL
const ACCESS_VECTOR = (() => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if (ref === 'nfc') return 'nfc';
  if (ref === 'qr') return 'qr';
  return 'direct';
})();


class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = "A system error has occurred.";
      try {
        const parsed = JSON.parse(this.state.errorInfo || '');
        if (parsed.error && parsed.error.includes('permissions')) {
          displayMessage = "Access Denied: You do not have permission to view this data.";
        }
      } catch (e) {
        // Not JSON, use default
      }

      return (
        <div className="h-screen flex flex-col items-center justify-center bg-hud-bg text-hud-magenta p-8 text-center">
          <AlertTriangle className="mb-4" size={48} />
          <div className="text-xl font-bold tracking-widest mb-2">SYSTEM_CRITICAL_FAILURE</div>
          <div className="text-sm border border-hud-magenta p-4 bg-hud-magenta/10 mb-4">{displayMessage}</div>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 border border-hud-magenta hover:bg-hud-magenta hover:text-hud-bg transition-all font-bold"
          >
            REBOOT_SYSTEM
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [currentNode, setCurrentNode] = useState<Node | null>(null);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [isTappedIn, setIsTappedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const [path, setPath] = useState(window.location.pathname);
  const [now, setNow] = useState(new Date());

  const isAdmin = user?.email === 'vannymwamba@gmail.com';

  // Update current time every 10 seconds for precise expiry tracking
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Listen for navigation events (back/forward or manual pushState)
  useEffect(() => {
    const handleLocationChange = () => {
      setPath(window.location.pathname);
      setSelectedBroadcast(null);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  useEffect(() => {
    if (hudMessage) {
      const timer = setTimeout(() => setHudMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [hudMessage]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(profileRef, async (docSnap) => {
      let profile: UserProfile | null = null;

      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
        
        // If they are currently a 'user', check if they should be a 'partner'
        if (profile.role === 'user') {
          const partnerQuery = query(collection(db, 'partners'), where('owner_email', '==', user.email?.toLowerCase().trim()));
          let partnerSnap;
          try {
            partnerSnap = await getDocs(partnerQuery);
          } catch (err) {
            handleFirestoreError(err, OperationType.LIST, 'partners');
            setLoading(false);
            return;
          }
          
          if (!partnerSnap.empty) {
            const partnerId = partnerSnap.docs[0].id;
            const updatedProfile: UserProfile = {
              ...profile,
              role: 'partner',
              partner_id: partnerId
            };
            // This will trigger the snapshot listener again
            try {
              await setDoc(profileRef, updatedProfile);
            } catch (err) {
              handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
              setLoading(false);
            }
            return;
          }
        }
      } else {
        // Profile doesn't exist yet, check if they are a partner first
        const partnerQuery = query(collection(db, 'partners'), where('owner_email', '==', user.email?.toLowerCase().trim()));
        let partnerSnap;
        try {
          partnerSnap = await getDocs(partnerQuery);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'partners');
          setLoading(false);
          return;
        }
        
        if (!partnerSnap.empty) {
          const partnerId = partnerSnap.docs[0].id;
          profile = {
            uid: user.uid,
            email: user.email!,
            role: 'partner',
            partner_id: partnerId
          };
        } else {
          profile = {
            uid: user.uid,
            email: user.email!,
            role: user.email === 'vannymwamba@gmail.com' ? 'admin' : 'user'
          };
        }
        // Create the profile
        try {
          await setDoc(profileRef, profile);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }

      setUserProfile(profile);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubProfile();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("Login error:", err);
    }
  };

  const handleSeed = async () => {
    if (!user) {
      setHudMessage({ text: "AUTH_REQUIRED: PLEASE_LOGIN_FIRST", type: 'error' });
      return;
    }
    if (!isAdmin) {
      setHudMessage({ text: "ACCESS_DENIED: ADMIN_PRIVILEGES_REQUIRED", type: 'error' });
      return;
    }
    setIsSeeding(true);
    setHudMessage({ text: "INITIALIZING_TACTICAL_DATA...", type: 'info' });
    try {
      await seedData();
      setHudMessage({ text: "DATA_IGNITION_SUCCESSFUL", type: 'info' });
    } catch (err) {
      console.error("Seed error:", err);
      setHudMessage({ text: "SEED_FAILURE: CHECK_CONSOLE", type: 'error' });
    } finally {
      setIsSeeding(false);
    }
  };

  // Expose to window for the DepartureBoard component
  useEffect(() => {
    (window as any).handleSeed = handleSeed;
    return () => { delete (window as any).handleSeed; };
  }, [handleSeed]);

  // Derive view from path state
  const pathParts = path.split('/').filter(Boolean);
  const isDashboard = pathParts.includes('dashboard');
  const isLogin = pathParts.includes('login');
  const tapIndex = pathParts.indexOf('tap');
  const nodeId = tapIndex !== -1 && pathParts[tapIndex + 1] ? pathParts[tapIndex + 1] : null;
  const isHome = path === '/' || path === '' || isLogin;

  useEffect(() => {
    if (!currentNode || isDashboard || isHome) return;

    const recordTap = async () => {
      try {
        // We use a session-based approach to avoid double-counting 
        // rapid refreshes, but still track unique visits.
        const tapKey = `uh_tapped_${nodeId}_${SESSION_ID}`;
        const hasTapped = sessionStorage.getItem(tapKey);
        
        if (!hasTapped) {
          try {
            await addDoc(collection(db, 'taps'), {
              node_id: nodeId,
              session_uuid: SESSION_ID,
              access_vector: ACCESS_VECTOR,
              timestamp: new Date().toISOString()
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'taps');
          }
          sessionStorage.setItem(tapKey, 'true');
          console.log(`TAP_RECORDED: ${nodeId} via ${ACCESS_VECTOR}`);
        }
      } catch (err) {
        console.error("Error recording tap:", err);
      }
    };

    recordTap();
  }, [currentNode, nodeId, isDashboard]);

  useEffect(() => {
    if (isDashboard || isHome) {
      setLoading(false);
      return;
    }
    const fetchNode = () => {
      const activeNodeId = nodeId || 'OTR-ALPHA-01';
      setLoading(true);
      const nodeRef = doc(db, 'nodes', activeNodeId);
      
      // Use onSnapshot to get cached data immediately and then live updates
      const unsubscribe = onSnapshot(nodeRef, (nodeSnap) => {
        if (nodeSnap.exists()) {
          setCurrentNode({ id: nodeSnap.id, ...nodeSnap.data() } as Node);
        } else {
          // Fallback for demo if node doesn't exist
          setCurrentNode({
            id: activeNodeId,
            name: `SECTOR_${activeNodeId.toUpperCase()}`,
            type: 'street',
            latitude: 0,
            longitude: 0,
            radius_limit: 5000
          });
        }
        setLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `nodes/${activeNodeId}`);
      });

      return unsubscribe;
    };

    const unsubscribe = fetchNode();
    return () => unsubscribe();
  }, [nodeId, isDashboard, isHome]);

  useEffect(() => {
    if (!currentNode) return;

    // Connection Test
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'nodes', 'connection-test'));
      } catch (err) {
        if (err instanceof Error && err.message.includes('offline')) {
          console.error("FIREBASE_OFFLINE: CHECK_CONFIG");
        }
      }
    };
    testConnection();

    // Real-time subscription to broadcasts
    // We filter by expiry on server and distance client-side
    // We also limit to events starting within the next 24 hours
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    
    const q = query(
      collection(db, 'broadcasts'),
      where('expires_at', '>', now.toISOString()),
      where('starts_at', '<=', twentyFourHoursFromNow),
      orderBy('expires_at')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Broadcast[];
      
      // Filter by distance to current node
      const filtered = data.filter(b => {
        const distance = getDistance(
          currentNode.latitude, 
          currentNode.longitude, 
          b.latitude, 
          b.longitude
        );
        return distance <= currentNode.radius_limit;
      });

      setBroadcasts(filtered);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'broadcasts');
    });

    return () => unsubscribe();
  }, [currentNode, now]);

  const handleVibeReport = async (vibe: Vibe) => {
    if (!selectedBroadcast) return;
    
    setIsReporting(true);
    try {
      const { updateDoc, getDocs, orderBy } = await import('firebase/firestore');
      
      // 1. Add the new report
      try {
        await addDoc(collection(db, 'vibe_reports'), {
          broadcast_id: selectedBroadcast.id,
          session_uuid: SESSION_ID,
          vibe,
          reported_at: new Date().toISOString(),
          access_vector: ACCESS_VECTOR
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'vibe_reports');
      }
      
      // 2. Aggregate reports from the last 15 minutes
      // We filter by broadcast_id on server and time client-side to avoid index complexity
      const q = query(
        collection(db, 'vibe_reports'),
        where('broadcast_id', '==', selectedBroadcast.id)
      );
      
      let snapshot;
      try {
        snapshot = await getDocs(q);
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'vibe_reports');
        return;
      }
      
      const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
      
      const reports = snapshot.docs
        .map(doc => doc.data())
        .filter(data => new Date(data.reported_at).getTime() > fifteenMinsAgo)
        .map(data => data.vibe as Vibe);
      
      if (reports.length > 0) {
        // Calculate mode
        const counts = reports.reduce((acc, v) => {
          acc[v] = (acc[v] || 0) + 1;
          return acc;
        }, {} as Record<Vibe, number>);
        
        let mostFrequentVibe: Vibe = vibe;
        let maxCount = 0;
        
        (Object.keys(counts) as Vibe[]).forEach(v => {
          if (counts[v] > maxCount) {
            maxCount = counts[v];
            mostFrequentVibe = v;
          }
        });
        
        // 3. Update the broadcast's current_vibe
        try {
          await updateDoc(doc(db, 'broadcasts', selectedBroadcast.id), {
            current_vibe: mostFrequentVibe
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `broadcasts/${selectedBroadcast.id}`);
        }
      }

      // Simulate real-time update feel
      setTimeout(() => {
        setIsReporting(false);
        setSelectedBroadcast(null);
      }, 500);
    } catch (err) {
      console.error("Report error:", err);
      setIsReporting(false);
    }
  };

  const handleShare = async (title: string, text: string, url: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        // Silently handle share cancellation
      }
    } else {
      await navigator.clipboard.writeText(url);
      setHudMessage({ text: "LINK_COPIED_TO_CLIPBOARD", type: 'info' });
    }
  };

  useEffect(() => {
    if (isHome && userProfile && (userProfile.role === 'admin' || userProfile.role === 'partner')) {
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [isHome, userProfile]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-hud-bg text-hud-green p-8 text-center">
        <Loader2 className="animate-spin mb-4" size={48} />
        <div className="text-xl font-bold tracking-widest mb-2">INITIALIZING_SECTOR_HUB</div>
        <div className="text-[10px] opacity-60">ESTABLISHING_SECURE_HANDSHAKE...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-hud-bg text-hud-magenta p-8 text-center">
        <AlertTriangle className="mb-4" size={48} />
        <div className="text-xl font-bold tracking-widest mb-2">SYSTEM_ERROR</div>
        <div className="text-sm border border-hud-magenta p-4 bg-hud-magenta/10">{error}</div>
        <button 
          onClick={() => window.location.reload()}
          className="mt-8 px-6 py-2 border border-hud-magenta hover:bg-hud-magenta hover:text-hud-bg transition-all font-bold"
        >
          REBOOT_SYSTEM
        </button>
      </div>
    );
  }

  if (isHome) {
    return <LandingPage onLoginSuccess={setUserProfile} userProfile={userProfile} />;
  }

  if (isDashboard) {
    if (!user || !userProfile) {
      return <LandingPage onLoginSuccess={setUserProfile} userProfile={userProfile} />;
    }
    
    if (userProfile.role === 'user') {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-hud-bg text-hud-magenta p-8 text-center">
          <AlertTriangle className="mb-4" size={48} />
          <div className="text-xl font-bold tracking-widest mb-2">ACCESS_RESTRICTED</div>
          <div className="text-sm border border-hud-magenta p-4 bg-hud-magenta/10 mb-8">
            YOU_DO_NOT_HAVE_PARTNER_OR_ADMIN_PERMISSIONS
          </div>
          <button 
            onClick={() => window.location.href = '/'}
            className="px-6 py-2 border border-hud-magenta hover:bg-hud-magenta hover:text-hud-bg transition-all font-bold"
          >
            RETURN_TO_HOME
          </button>
        </div>
      );
    }

    return <Dashboard userProfile={userProfile} onLogout={() => auth.signOut()} />;
  }

  return (
    <ErrorBoundary>
      <div key={nodeId} className="h-screen max-w-md mx-auto bg-hud-bg flex flex-col relative overflow-hidden shadow-2xl">
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-50 bg-[length:100%_2px,3px_100%] opacity-30" />
        
        <DepartureBoard 
          nodeName={currentNode?.name || 'UNKNOWN_SECTOR'} 
          currentNode={currentNode}
          broadcasts={broadcasts}
          onSelect={setSelectedBroadcast}
          user={user}
          userProfile={userProfile}
          onLogin={handleLogin}
          isTappedIn={isTappedIn}
          onTapToggle={setIsTappedIn}
          accessVector={ACCESS_VECTOR}
          onShareNode={() => handleShare(
            `Urban Hikers: ${currentNode?.name}`,
            `Check out what's live at ${currentNode?.name}!`,
            window.location.href
          )}
          onShareEvent={(b) => handleShare(
            b.title,
            `Check out this event at ${currentNode?.name}!`,
            `${window.location.origin}/tap/${nodeId}`
          )}
        />

        {/* HUD Notifications */}
        <AnimatePresence>
          {hudMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute top-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 border font-bold text-[10px] tracking-widest shadow-lg ${
                hudMessage.type === 'error' 
                  ? 'bg-hud-magenta/20 border-hud-magenta text-hud-magenta' 
                  : 'bg-hud-green/20 border-hud-green text-hud-green'
              }`}
            >
              {hudMessage.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden Seed Button for Demo */}
        <button 
          onClick={handleSeed}
          disabled={isSeeding}
          className="absolute bottom-2 right-2 text-[8px] text-hud-green/20 hover:text-hud-green/60 transition-colors"
        >
          {isSeeding ? 'SEEDING...' : '[INIT_DB]'}
        </button>

        <AnimatePresence>
          {selectedBroadcast && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="absolute inset-x-0 bottom-0 z-20"
            >
              <div className="p-6 bg-hud-bg border-t border-hud-green/40 shadow-[0_-10px_30px_rgba(0,255,0,0.1)]">
                <div className="flex justify-between items-start mb-6">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] text-hud-green/60 mb-1">SELECTED_EVENT</div>
                    <h3 className="text-lg font-bold hud-glow-green truncate">{selectedBroadcast.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleShare(
                        selectedBroadcast.title,
                        `Check out this event at ${currentNode?.name}!`,
                        `${window.location.origin}/tap/${nodeId}`
                      )}
                      className="flex items-center gap-2 bg-hud-green/10 text-hud-green px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-hud-green/20 transition-colors"
                    >
                      <Share2 size={14} />
                      SHARE_SIGNAL
                    </button>
                    <button 
                      onClick={() => setSelectedBroadcast(null)}
                      className="text-hud-green/40 hover:text-hud-green p-2 shrink-0 font-bold text-[10px] border border-hud-green/20 rounded-xl px-3"
                    >
                      [CLOSE]
                    </button>
                  </div>
                </div>
                
                <VibeCheck onReport={handleVibeReport} isReporting={isReporting} />
                
                <VibeTrend broadcastId={selectedBroadcast.id} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
