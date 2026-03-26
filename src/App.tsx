import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, where, addDoc, doc, getDoc, setDoc, getDocs, orderBy, getDocFromServer, updateDoc } from 'firebase/firestore';
import { Node, Broadcast, Vibe, UserProfile, UserRole, Partner } from './types';
import { BASE_URL } from './constants';
import { DepartureBoard } from './components/DepartureBoard';
import { VibeCheck } from './components/VibeCheck';
import { VibeTrend } from './components/VibeTrend';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';
import { WalletCard } from './components/WalletCard';
import seedData from './seed';
import { getDistance } from './utils/geo';
import { handleFirestoreError, OperationType } from './utils/firebaseErrors';

import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertTriangle, Share2, MapPin, Wallet } from 'lucide-react';

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
  const [rawBroadcasts, setRawBroadcasts] = useState<Broadcast[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [partnersMap, setPartnersMap] = useState<Record<string, Partner>>({});
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [selectedBroadcastNode, setSelectedBroadcastNode] = useState<Node | null>(null);
  const [isTappedIn, setIsTappedIn] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const [path, setPath] = useState(window.location.pathname);
  const [now, setNow] = useState(new Date());
  const [currentTab, setCurrentTab] = useState<'feed' | 'wallet' | 'map' | 'routes'>(() => {
    const initial = localStorage.getItem('uh_initial_tab');
    if (initial === 'wallet') {
      localStorage.removeItem('uh_initial_tab');
      return 'wallet';
    }
    if (initial === 'map') {
      localStorage.removeItem('uh_initial_tab');
      return 'map';
    }
    if (initial === 'routes') {
      localStorage.removeItem('uh_initial_tab');
      return 'routes';
    }
    return 'feed';
  });
  const [savedHubs, setSavedHubs] = useState<Node[]>(() => {
    const saved = localStorage.getItem('uh_saved_hubs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('uh_saved_hubs', JSON.stringify(savedHubs));
  }, [savedHubs]);

  const toggleSaveHub = (node: Node) => {
    setSavedHubs(prev => {
      const isSaved = prev.some(h => h.id === node.id);
      if (isSaved) {
        setHudMessage({ text: "HUB_REMOVED_FROM_WALLET", type: 'info' });
        return prev.filter(h => h.id !== node.id);
      } else {
        setHudMessage({ text: "HUB_SECURED_IN_WALLET", type: 'info' });
        return [...prev, node];
      }
    });
  };

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
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log("AUTH_STATE_CHANGED:", u?.uid || "NO_USER");
      setUser(u);
      if (u) {
        try {
          const tokenResult = await u.getIdTokenResult();
          console.log("AUTH_TOKEN_CLAIMS:", tokenResult.claims);
          console.log("AUTH_TOKEN_ROLE_CLAIM:", tokenResult.claims.role);
        } catch (err) {
          console.error("Error getting token result:", err);
        }
      }
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
      console.log("USER_PROFILE_SNAPSHOT_RECEIVED, EXISTS:", docSnap.exists());
      let profile: UserProfile | null = null;

      if (docSnap.exists()) {
        profile = docSnap.data() as UserProfile;
        
        // If they are currently a 'user' or 'admin', check if they should be linked to a 'partner'
        if (profile.role === 'user' || profile.role === 'admin') {
          const partnerQuery = query(collection(db, 'partners'), where('owner_email', '==', user.email?.toLowerCase().trim()));
          let partnerSnap;
          try {
            partnerSnap = await getDocs(partnerQuery);
          } catch (err) {
            setLoading(false);
            handleFirestoreError(err, OperationType.LIST, 'partners');
            return;
          }
          
          if (!partnerSnap.empty) {
            const partnerDoc = partnerSnap.docs[0];
            const partnerData = partnerDoc.data() as Partner;
            const partnerId = partnerDoc.id;
            
            // Only update if partnerId is missing or role needs upgrading
            if ((profile.partnerId || profile.partner_id) !== partnerId || (profile.role === 'user' && partnerData.role)) {
              const updatedProfile: UserProfile = {
                ...profile,
                role: profile.role === 'admin' ? 'admin' : (partnerData.role || 'partner'),
                partnerId: partnerId
              };
              
              // Ensure partner has associated_owner_uid for storage rules
              if (partnerData.associated_owner_uid !== user.uid) {
                try {
                  await updateDoc(doc(db, 'partners', partnerId), {
                    associated_owner_uid: user.uid
                  });
                } catch (err) {
                  console.error("Error updating partner owner UID:", err);
                }
              }

              // This will trigger the snapshot listener again
              try {
                await setDoc(profileRef, updatedProfile);
              } catch (err) {
                setLoading(false);
                handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
              }
              return;
            }
          }
        }
      } else {
        // Profile doesn't exist yet, check if they are a partner first
        const partnerQuery = query(collection(db, 'partners'), where('owner_email', '==', user.email?.toLowerCase().trim()));
        let partnerSnap;
        try {
          partnerSnap = await getDocs(partnerQuery);
        } catch (err) {
          setLoading(false);
          handleFirestoreError(err, OperationType.LIST, 'partners');
          return;
        }
        
        if (!partnerSnap.empty) {
          const partnerDoc = partnerSnap.docs[0];
          const partnerData = partnerDoc.data() as Partner;
          const partnerId = partnerDoc.id;
          
          // Ensure partner has associated_owner_uid for storage rules
          if (partnerData.associated_owner_uid !== user.uid) {
            try {
              await updateDoc(doc(db, 'partners', partnerId), {
                associated_owner_uid: user.uid
              });
            } catch (err) {
              console.error("Error updating partner owner UID:", err);
            }
          }

          profile = {
            uid: user.uid,
            email: user.email!,
            role: partnerData.role || 'partner',
            partnerId: partnerId
          };
        } else {
          profile = {
            uid: user.uid,
            email: user.email!,
            role: user.email === 'vannymwamba@gmail.com' ? 'super_admin' : 'user'
          };
        }
        // Create the profile
        try {
          await setDoc(profileRef, profile);
        } catch (err) {
          setLoading(false);
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
        }
      }

      setUserProfile(profile);
      setLoading(false);
    }, (err) => {
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    });

    return () => unsubProfile();
  }, [user]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'partners'),
      (snap) => {
        const map: Record<string, Partner> = {};
        snap.docs.forEach(doc => {
          map[doc.id] = { id: doc.id, ...doc.data() } as Partner;
        });
        setPartnersMap(map);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'partners');
      }
    );
    return () => unsub();
  }, []);

  const handleLogin = () => {
    // Save the current path to redirect back after login
    if (nodeId) {
      sessionStorage.setItem('uh_login_redirect', `/tap/${nodeId}`);
    } else if (isHome || isDashboard) {
      sessionStorage.setItem('uh_login_redirect', '/dashboard');
    } else {
      sessionStorage.removeItem('uh_login_redirect');
    }
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
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
  const nodeId = tapIndex !== -1 && pathParts[tapIndex + 1] ? pathParts[tapIndex + 1].toUpperCase() : null;
  const isHome = path === '/' || path === '';

  useEffect(() => {
    console.log("PATH_STATE_CHANGED:", path, "NODE_ID:", nodeId, "IS_HOME:", isHome, "IS_DASHBOARD:", isDashboard);
  }, [path, nodeId, isHome, isDashboard]);

  useEffect(() => {
    console.log("LOADING_STATE_CHANGED:", loading);
  }, [loading]);

  useEffect(() => {
    console.log("PARTNERS_MAP_UPDATED:", Object.keys(partnersMap).length, "PARTNERS");
  }, [partnersMap]);

  useEffect(() => {
    if (!currentNode || !nodeId || isDashboard || isHome) return;

    const recordTap = async () => {
      try {
        // We use a session-based approach to avoid double-counting 
        // rapid refreshes, but still track unique visits.
        const tapKey = `uh_tapped_${nodeId}_${SESSION_ID}`;
        const hasTapped = sessionStorage.getItem(tapKey);
        
        if (!hasTapped) {
          // Find if there's an active sponsored broadcast at this node
          const activeSponsor = broadcasts.find(b => 
            b.node_id === nodeId && 
            b.partner_id && 
            b.partner_id !== 'admin' &&
            new Date(b.expires_at) > new Date()
          );

          try {
            await addDoc(collection(db, 'taps'), {
              node_id: nodeId,
              session_uuid: SESSION_ID,
              access_vector: ACCESS_VECTOR,
              timestamp: new Date().toISOString(),
              tab: currentTab,
              sponsor_id: activeSponsor?.partner_id || null
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
  }, [currentNode, nodeId, isDashboard, broadcasts, currentTab]);

  useEffect(() => {
    if (isDashboard || isHome || isLogin) return;

    const recordTabView = async () => {
      try {
        await addDoc(collection(db, 'tab_views'), {
          session_uuid: SESSION_ID,
          tab: currentTab,
          timestamp: new Date().toISOString()
        });
        console.log(`TAB_VIEW_RECORDED: ${currentTab}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tab_views');
      }
    };

    recordTabView();
  }, [currentTab, isDashboard, isHome]);

  useEffect(() => {
    if (isDashboard || isHome) {
      console.log("FETCH_NODE_SKIPPED: DASHBOARD_OR_HOME");
      setLoading(false);
      return;
    }
    const fetchNode = () => {
      const activeNodeId = nodeId || 'OTR-ALPHA-01';
      console.log(`FETCHING_NODE: ${activeNodeId}`);
      setLoading(true);
      const nodeRef = doc(db, 'nodes', activeNodeId);
      
      // Use onSnapshot to get cached data immediately and then live updates
      const unsubscribe = onSnapshot(nodeRef, (nodeSnap) => {
        console.log(`NODE_SNAPSHOT_RECEIVED: ${activeNodeId}, EXISTS: ${nodeSnap.exists()}`);
        if (nodeSnap.exists()) {
          setCurrentNode({ id: nodeSnap.id, ...nodeSnap.data() } as Node);
        } else {
          // Fallback for demo if node doesn't exist
          console.warn(`NODE_NOT_FOUND: ${activeNodeId}, USING_FALLBACK`);
          setCurrentNode({
            id: activeNodeId,
            name: `SECTOR_${activeNodeId.toUpperCase()}`,
            type: 'street',
            latitude: 39.1092, // Default to Alpha Plaza coordinates instead of 0,0
            longitude: -84.5125,
            radius_limit: 5000
          });
        }
        setLoading(false);
      }, (err) => {
        console.error(`NODE_SNAPSHOT_ERROR: ${activeNodeId}`, err);
        setLoading(false);
        handleFirestoreError(err, OperationType.GET, `nodes/${activeNodeId}`);
      });

      return unsubscribe;
    };

    const unsubscribe = fetchNode();
    return () => unsubscribe();
  }, [nodeId, isDashboard, isHome]);

  // Connection Test - Run once on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'nodes', 'connection-test'));
        console.log("FIREBASE_CONNECTION_TEST: SUCCESS");
      } catch (err) {
        if (err instanceof Error && err.message.includes('offline')) {
          console.error("FIREBASE_OFFLINE: CHECK_CONFIG");
        }
      }
    };
    testConnection();
  }, []);

  useEffect(() => {
    if (!currentNode) {
      console.log("BROADCASTS_EFFECT_SKIPPED: NO_CURRENT_NODE");
      return;
    }

    console.log(`SUBSCRIBING_TO_BROADCASTS_FOR_NODE: ${currentNode.id}`);
    
    // Real-time subscription to broadcasts
    // We use a stable query (broadcasts expiring after the app started)
    // and filter client-side to save quota.
    const sessionStartTime = new Date().toISOString();
    
    const q = query(
      collection(db, 'broadcasts'),
      where('expires_at', '>', sessionStartTime),
      orderBy('expires_at')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`BROADCASTS_SNAPSHOT_RECEIVED: ${snapshot.size} DOCS`);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Broadcast[];
      
      // We'll store the raw data and filter in a separate effect/memo
      // to avoid re-subscribing when 'now' changes.
      setRawBroadcasts(data);
      setLoading(false);
    }, (err) => {
      console.error("BROADCASTS_SNAPSHOT_ERROR:", err);
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'broadcasts');
    });

    return () => unsubscribe();
  }, [currentNode]); // Removed 'now' and 'partnersMap' from dependencies

  // Client-side filtering and sorting
  useEffect(() => {
    if (!rawBroadcasts.length || !currentNode) {
      setBroadcasts([]);
      return;
    }

    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    const filtered = rawBroadcasts.filter(b => {
      const radiusLimit = currentNode.radius_limit || (currentNode as any).radiusLimit || 5000;
      
      const distance = getDistance(
        currentNode.latitude, 
        currentNode.longitude, 
        b.latitude, 
        b.longitude
      );

      const startsAt = b.starts_at || b.startsAt || '';
      const expiresAt = b.expires_at || b.expiresAt || '';
      
      const isWithinWindow = !startsAt || startsAt <= twentyFourHoursFromNow;
      const isNotExpired = expiresAt > nowIso;

      return distance <= radiusLimit && isWithinWindow && isNotExpired;
    });

    const sortedBroadcasts = [...filtered].sort((a, b) => {
      const partnerA = partnersMap[a.partner_id || a.partnerId || ''];
      const partnerB = partnersMap[b.partner_id || b.partnerId || ''];
      const aSponsored = !!(partnerA?.logo_url || partnerA?.brand_color);
      const bSponsored = !!(partnerB?.logo_url || partnerB?.brand_color);
      
      if (aSponsored && !bSponsored) return -1;
      if (!aSponsored && bSponsored) return 1;
      const aStart = new Date(a.starts_at || a.startsAt || 0).getTime();
      const bStart = new Date(b.starts_at || b.startsAt || 0).getTime();
      return aStart - bStart;
    });

    setBroadcasts(sortedBroadcasts);
  }, [rawBroadcasts, now, currentNode, partnersMap]);

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
    if (!userProfile) return;
    const isPartnerRole = ['partner', 'partner_admin', 'partner_viewer', 'partner_content_editor'].includes(userProfile.role);
    const isSystemAdmin = userProfile.role === 'admin' || userProfile.role === 'super_admin' || userProfile.email === 'vannymwamba@gmail.com';
    if ((isHome || isLogin) && (isSystemAdmin || isPartnerRole)) {
      window.history.pushState({}, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [isHome, isLogin, userProfile]);

  useEffect(() => {
    if (!selectedBroadcast) {
      setSelectedBroadcastNode(null);
      return;
    }

    const nodeId = selectedBroadcast.node_id || selectedBroadcast.nodeId;
    if (!nodeId) return;

    if (currentNode && currentNode.id === nodeId) {
      setSelectedBroadcastNode(currentNode);
      return;
    }

    const fetchNode = async () => {
      try {
        const nodeRef = doc(db, 'nodes', nodeId);
        const nodeSnap = await getDoc(nodeRef);
        if (nodeSnap.exists()) {
          setSelectedBroadcastNode({ id: nodeSnap.id, ...nodeSnap.data() } as Node);
        }
      } catch (err) {
        console.error("Error fetching broadcast node:", err);
      }
    };

    fetchNode();
  }, [selectedBroadcast, currentNode]);

  const isSelectedBroadcastNodeSaved = selectedBroadcastNode 
    ? savedHubs.some(h => h.id === selectedBroadcastNode.id)
    : false;

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

  if (isLogin) {
    return (
      <Login 
        onLoginSuccess={(profile) => {
          setUserProfile(profile);
          
          const redirect = sessionStorage.getItem('uh_login_redirect');
          sessionStorage.removeItem('uh_login_redirect');
          
          const isPartnerRole = ['partner', 'partner_admin', 'partner_viewer', 'partner_content_editor'].includes(profile.role);
          const isSystemAdmin = profile.role === 'admin' || profile.role === 'super_admin' || profile.email === 'vannymwamba@gmail.com';
          
          if (redirect && redirect.startsWith('/tap/')) {
            // Return to the broadcast screen if that's where they came from
            window.history.pushState({}, '', redirect);
          } else if (isPartnerRole || isSystemAdmin) {
            // Partners and admins always go to dashboard if not from a specific hub
            window.history.pushState({}, '', '/dashboard');
          } else {
            // Regular hikers go to home
            window.history.pushState({}, '', '/');
          }
          
          window.dispatchEvent(new PopStateEvent('popstate'));
        }} 
      />
    );
  }

  if (isHome) {
    return (
      <LandingPage 
        onLoginSuccess={setUserProfile} 
        onLogin={handleLogin}
        userProfile={userProfile}
        onOpenWallet={() => {
          // Redirect to a default hub to show the wallet
          window.location.href = '/tap/otr-alpha-01';
          // We can't easily set the tab across page loads without a query param or localStorage
          localStorage.setItem('uh_initial_tab', 'wallet');
        }}
      />
    );
  }

  if (isDashboard) {
    if (!user || !userProfile) {
      return (
        <LandingPage 
          onLoginSuccess={setUserProfile} 
          onLogin={handleLogin}
          userProfile={userProfile}
          onOpenWallet={() => {
            window.location.href = '/tap/otr-alpha-01';
            localStorage.setItem('uh_initial_tab', 'wallet');
          }}
        />
      );
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
            `${BASE_URL}/tap/${nodeId}`
          )}
          onSaveToWallet={(node) => (node || currentNode) && toggleSaveHub(node || currentNode!)}
          isSaved={currentNode ? savedHubs.some(h => h.id === currentNode.id) : false}
          activeTab={currentTab}
          onTabChange={setCurrentTab}
          savedHubs={savedHubs}
          partnersMap={partnersMap}
        />

        {/* HUD Notifications */}
        <AnimatePresence>
          {hudMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute top-24 left-1/2 -translate-x-1/2 z-[2100] px-4 py-2 border font-bold text-[10px] tracking-widest shadow-lg ${
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
          className="absolute bottom-2 right-2 text-[8px] text-hud-green/20 hover:text-hud-green/60 transition-colors z-[2100]"
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
              className="absolute inset-x-0 bottom-0 z-[2000]"
            >
              <div className="p-6 bg-hud-bg border-t border-hud-green/40 shadow-[0_-10px_30px_rgba(0,255,0,0.1)] max-h-[85vh] overflow-y-auto">
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
                        `${BASE_URL}/tap/${nodeId}`
                      )}
                      className="flex items-center justify-center w-10 h-10 bg-hud-green/10 text-hud-green rounded-xl hover:bg-hud-green/20 transition-colors"
                      title="Share Signal"
                    >
                      <Share2 size={18} />
                    </button>
                    {selectedBroadcastNode && (
                      <button 
                        onClick={() => toggleSaveHub(selectedBroadcastNode)}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors ${
                          isSelectedBroadcastNodeSaved 
                            ? 'bg-hud-magenta/20 text-hud-magenta border border-hud-magenta/40' 
                            : 'bg-hud-green/10 text-hud-green hover:bg-hud-green/20'
                        }`}
                        title={isSelectedBroadcastNodeSaved ? "Remove from Wallet" : "Save to Wallet"}
                      >
                        <Wallet size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => setSelectedBroadcast(null)}
                      className="text-hud-green/40 hover:text-hud-green p-2 shrink-0 font-bold text-[10px] border border-hud-green/20 rounded-xl px-3"
                    >
                      [CLOSE]
                    </button>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="text-[10px] font-black tracking-[0.2em] text-hud-green/40 uppercase mb-2">SIGNAL_INTEL</div>
                  <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                    <p className="text-[13px] text-white/80 leading-relaxed font-sans">
                      {selectedBroadcast.description || "NO_ADDITIONAL_INTEL_AVAILABLE_FOR_THIS_SIGNAL."}
                    </p>
                    {selectedBroadcast.address && (
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-[11px] text-white/40">
                        <MapPin size={12} className="text-hud-yellow" />
                        <span>{selectedBroadcast.address}</span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <div className="text-[10px] font-black tracking-[0.2em] text-hud-green/40 uppercase mb-3">VIBE_CHECK</div>
                    <VibeCheck onReport={handleVibeReport} isReporting={isReporting} />
                  </div>
                  
                  <div>
                    <div className="text-[10px] font-black tracking-[0.2em] text-hud-green/40 uppercase mb-3">VIBE_TREND_ANALYSIS</div>
                    <VibeTrend broadcastId={selectedBroadcast.id} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ErrorBoundary>
  );
}
