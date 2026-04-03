import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { useLocation } from 'react-router-dom';
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
import { CreatorIntakeWindow } from './components/CreatorIntakeWindow';
import MuralNodeAdmin from './components/MuralNodeAdmin';
import seedData from './seed';
import { getDistance } from './utils/geo';
import { handleFirestoreError, OperationType } from './utils/firebaseErrors';

import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, AlertTriangle, Share2, MapPin, Wallet, X } from 'lucide-react';

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
  const [rawPois, setRawPois] = useState<Broadcast[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [partnersMap, setPartnersMap] = useState<Record<string, Partner>>({});
  const [selectedBroadcast, setSelectedBroadcast] = useState<Broadcast | null>(null);
  const [selectedBroadcastNode, setSelectedBroadcastNode] = useState<Node | null>(null);
  const [isTappedIn, setIsTappedIn] = useState(true);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'error' | 'unsupported'>('idle');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const location = useLocation();
  const [path, setPath] = useState(location.pathname);
  const [now, setNow] = useState(new Date());
  const [currentTab, setCurrentTab] = useState<'home' | 'feed' | 'explore' | 'wallet' | 'profile'>(() => {
    const initial = localStorage.getItem('uh_initial_tab');
    if (initial === 'wallet') {
      localStorage.removeItem('uh_initial_tab');
      return 'wallet';
    }
    if (initial === 'explore') {
      localStorage.removeItem('uh_initial_tab');
      return 'explore';
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

  const toggleSaveHub = async (node: Node) => {
    setSavedHubs(prev => {
      const isSaved = prev.some(h => h.id === node.id);
      if (isSaved) {
        setHudMessage({ text: "HUB_REMOVED_FROM_WALLET", type: 'info' });
        return prev.filter(h => h.id !== node.id);
      } else {
        setHudMessage({ text: "HUB_SECURED_IN_WALLET", type: 'info' });
        
        // Track interaction
        const activeSponsor = broadcasts.find(b => 
          b.node_id === node.id && 
          b.partner_id && 
          b.partner_id !== 'admin' &&
          new Date(b.expires_at) > new Date()
        );

        addDoc(collection(db, 'interactions'), {
          type: 'wallet_save',
          session_uuid: SESSION_ID,
          access_vector: ACCESS_VECTOR,
          timestamp: new Date().toISOString(),
          node_id: node.id,
          tab: currentTab,
          sponsor_id: activeSponsor?.partner_id || null
        }).catch(err => console.error("Error tracking wallet save:", err));

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
        
        // If they are currently a 'user' or 'admin' without a partner link, check if they should be linked
        const currentPartnerId = profile.partnerId || profile.partner_id;
        if (profile.role === 'user' || (profile.role === 'admin' && !currentPartnerId)) {
          const email = user.email?.toLowerCase().trim();
          if (!email) return;

          const partnerQuery = query(collection(db, 'partners'), where('owner_email', '==', email));
          let partnerSnap;
          try {
            partnerSnap = await getDocs(partnerQuery);
          } catch (err) {
            console.error("Error querying partners:", err);
            // Don't call handleFirestoreError here to avoid spamming if quota is already hit
            return;
          }
          
          if (!partnerSnap.empty) {
            const partnerDoc = partnerSnap.docs[0];
            const partnerData = partnerDoc.data() as Partner;
            const partnerId = partnerDoc.id;
            
            // Only update if partnerId is missing or role needs upgrading
            const needsRoleUpgrade = profile.role === 'user' && partnerData.role && profile.role !== partnerData.role;
            const needsPartnerLink = currentPartnerId !== partnerId;

            if (needsPartnerLink || needsRoleUpgrade) {
              const updates: any = {
                partnerId: partnerId
              };
              if (needsRoleUpgrade) {
                updates.role = partnerData.role;
              } else if (profile.role === 'user') {
                updates.role = 'partner';
              }
              
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

              try {
                await updateDoc(profileRef, updates);
              } catch (err) {
                console.error("Error updating user profile:", err);
              }
              return;
            }
          }
        }
      } else {
        // Profile doesn't exist yet, check if they are a partner first
        const email = user.email?.toLowerCase().trim();
        if (!email) return;

        const partnerQuery = query(collection(db, 'partners'), where('owner_email', '==', email));
        let partnerSnap;
        try {
          partnerSnap = await getDocs(partnerQuery);
        } catch (err) {
          console.error("Error querying partners for new profile:", err);
          return;
        }
        
        if (!partnerSnap.empty) {
          const partnerDoc = partnerSnap.docs[0];
          const partnerData = partnerDoc.data() as Partner;
          const partnerId = partnerDoc.id;
          
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
        try {
          await setDoc(profileRef, profile);
        } catch (err) {
          console.error("Error creating user profile:", err);
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

  const handleLogin = (isPartner = false) => {
    // Save the current path to redirect back after login
    if (nodeId) {
      sessionStorage.setItem('uh_login_redirect', `/tap/${nodeId}`);
    } else if (isHome || isDashboard) {
      sessionStorage.setItem('uh_login_redirect', '/dashboard');
    } else {
      sessionStorage.removeItem('uh_login_redirect');
    }

    if (isPartner) {
      sessionStorage.setItem('uh_login_partner_mode', 'true');
    } else {
      sessionStorage.removeItem('uh_login_partner_mode');
    }

    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleTapIntoPulse = () => {
    // 1. Direct to hub (defaulting to Alpha Plaza)
    const defaultHub = 'otr-alpha-01';
    sessionStorage.setItem('uh_login_redirect', `/tap/${defaultHub}`);
    
    // 2. Direct to login with partner mode
    sessionStorage.setItem('uh_login_partner_mode', 'true');
    
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  const handleCreatorIgnite = () => {
    window.history.pushState({}, '', '/creator/ignite');
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
  const isMuralAdmin = pathParts.includes('admin') && pathParts.includes('mural');
  const tapIndex = pathParts.indexOf('tap');
  const creatorIndex = pathParts.indexOf('creator');
  const isCreatorIgnite = creatorIndex !== -1 && pathParts[creatorIndex + 1] === 'ignite';
  const nodeId = tapIndex !== -1 && pathParts[tapIndex + 1] ? pathParts[tapIndex + 1].toUpperCase() : 
                 (isCreatorIgnite && pathParts[creatorIndex + 2] ? pathParts[creatorIndex + 2].toUpperCase() : null);
  const isHome = path === '/' || path === '';

  useEffect(() => {
    setPath(location.pathname);
  }, [location]);

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    console.log("PATH_STATE_CHANGED:", path, "NODE_ID:", nodeId, "IS_HOME:", isHome, "IS_DASHBOARD:", isDashboard);
  }, [path, nodeId, isHome, isDashboard]);

  useEffect(() => {
    console.log("LOADING_STATE_CHANGED:", loading);
  }, [loading]);

  useEffect(() => {
    console.log("PARTNERS_MAP_UPDATED:", Object.keys(partnersMap).length, "PARTNERS");
  }, [partnersMap]);

  const recordTap = useCallback(async (vectorOverride?: 'nfc' | 'qr' | 'direct') => {
    if (!currentNode || !nodeId) return;
    
    try {
      const vector = vectorOverride || ACCESS_VECTOR;
      const tapKey = `uh_tapped_${nodeId}_${SESSION_ID}_${vector}`;
      const hasTapped = sessionStorage.getItem(tapKey);
      
      if (!hasTapped) {
        const activeSponsor = broadcasts.find(b => 
          b.node_id === nodeId && 
          b.partner_id && 
          b.partner_id !== 'admin' &&
          new Date(b.expires_at) > new Date()
        );

        if (activeSponsor) {
          sessionStorage.setItem(`uh_sponsor_${SESSION_ID}`, activeSponsor.partner_id || activeSponsor.partnerId || '');
        }

        console.log(`RECORDING_TAP: NODE=${nodeId} VECTOR=${vector} SPONSOR=${activeSponsor?.partner_id || 'NONE'}`);

        try {
          await addDoc(collection(db, 'taps'), {
            node_id: nodeId,
            session_uuid: SESSION_ID,
            access_vector: vector,
            timestamp: new Date().toISOString(),
            tab: currentTab,
            sponsor_id: activeSponsor?.partner_id || null
          });
          sessionStorage.setItem(tapKey, 'true');
        } catch (err) {
          console.error("Error adding tap doc:", err);
          // handleFirestoreError(err, OperationType.CREATE, 'taps');
        }
      }
    } catch (err) {
      console.error("Error recording tap:", err);
    }
  }, [currentNode, nodeId, broadcasts, currentTab]);

  // NFC Support
  useEffect(() => {
    if (!('NDEFReader' in window)) {
      setNfcStatus('unsupported');
      return;
    }

    if (isDashboard || isHome || isLogin) return;

    let ndef: any = null;
    const startNFC = async () => {
      try {
        ndef = new (window as any).NDEFReader();
        await ndef.scan();
        setNfcStatus('scanning');
        console.log("NFC_SCAN_STARTED");
        
        ndef.onreading = (event: any) => {
          console.log("NFC_TAG_DETECTED", event);
          setIsTappedIn(true);
          recordTap('nfc');
          setHudMessage({ text: "NFC_TAP_SUCCESSFUL", type: 'info' });
        };

        ndef.onreadingerror = () => {
          console.error("NFC_READ_ERROR: CANNOT_READ_TAG");
          setHudMessage({ text: "NFC_READ_ERROR", type: 'error' });
        };
      } catch (error) {
        console.error("NFC_ERROR: SCAN_FAILED", error);
        setNfcStatus('error');
      }
    };

    // NFC scan() requires a user gesture. 
    // We'll attempt to start it on the first click on the page.
    const handleFirstInteraction = () => {
      if (nfcStatus === 'idle') {
        startNFC();
      }
      window.removeEventListener('click', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction);

    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      if (ndef) ndef.onreading = null;
    };
  }, [isDashboard, isHome, isLogin, nfcStatus, recordTap]);

  useEffect(() => {
    if (!currentNode || !nodeId || isDashboard || isHome) return;
    recordTap();
  }, [currentNode, nodeId, isDashboard, isHome, recordTap]);

  useEffect(() => {
    if (isDashboard || isLogin) return;

    const recordTabView = async () => {
      try {
        const viewKey = `uh_viewed_${currentTab}_${SESSION_ID}_${ACCESS_VECTOR}`;
        const hasViewed = sessionStorage.getItem(viewKey);
        
        if (!hasViewed) {
          await addDoc(collection(db, 'tab_views'), {
            session_uuid: SESSION_ID,
            tab: currentTab,
            access_vector: ACCESS_VECTOR,
            timestamp: new Date().toISOString(),
            sponsor_id: sessionStorage.getItem(`uh_sponsor_${SESSION_ID}`) || null
          });
          sessionStorage.setItem(viewKey, 'true');
          console.log(`TAB_VIEW_RECORDED: ${currentTab} VECTOR: ${ACCESS_VECTOR}`);
        }
      } catch (err) {
        console.error("Error recording tab view:", err);
      }
    };

    recordTabView();
  }, [currentTab, isDashboard, isLogin]);

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
    const testConnection = async (retries = 3) => {
      try {
        console.log(`FIREBASE_CONNECTION_TEST: ATTEMPTING (REMAINING_RETRIES: ${retries})...`);
        // Use getDocFromServer to bypass local cache and force a network request
        await getDocFromServer(doc(db, 'nodes', 'connection-test'));
        console.log("FIREBASE_CONNECTION_TEST: SUCCESS");
      } catch (err: any) {
        console.error("FIREBASE_CONNECTION_TEST: ERROR", err);
        if (retries > 0) {
          console.log("FIREBASE_CONNECTION_TEST: RETRYING_IN_2S...");
          setTimeout(() => testConnection(retries - 1), 2000);
        } else if (err.message?.includes('offline') || err.code === 'unavailable') {
          console.error("FIREBASE_OFFLINE: CHECK_CONFIG_OR_NETWORK");
          setHudMessage({ text: "FIREBASE_OFFLINE: CHECK_CONFIG", type: 'error' });
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
    const sessionStartTime = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago for leniency
    console.log(`FETCHING_BROADCASTS_AFTER: ${sessionStartTime} FOR_NODE: ${currentNode.id}`);
    
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
      
      setRawBroadcasts(data);
      setLoading(false);
    }, (err) => {
      console.error("BROADCASTS_SNAPSHOT_ERROR:", err);
      setLoading(false);
      handleFirestoreError(err, OperationType.LIST, 'broadcasts');
    });

    return () => unsubscribe();
  }, [currentNode]); // Removed 'now' and 'partnersMap' from dependencies

  // Fetch POIs (Murals)
  useEffect(() => {
    if (!currentNode) return;

    console.log(`SUBSCRIBING_TO_POIS_FOR_HUB: ${currentNode.id}`);
    const q = query(
      collection(db, 'pois'),
      where('active', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`POIS_SNAPSHOT_RECEIVED: ${snapshot.size} DOCS`);
      const data = snapshot.docs.map(doc => {
        const poi = doc.data();
        // Map POI to Broadcast structure
        return {
          id: doc.id,
          title: poi.name,
          type: 'civic_mural',
          latitude: poi.latitude,
          longitude: poi.longitude,
          description: poi.description,
          imageUrl: poi.imageUrl,
          venue: poi.artist, // Use venue field for artist name
          address: poi.address,
          expires_at: '2099-12-31T23:59:59Z', // Murals are permanent
          starts_at: poi.createdAt,
          current_vibe: 'chill',
          active: true,
          partner_id: 'admin' // Mark as admin/civic content
        } as Broadcast;
      });
      setRawPois(data);
    }, (err) => {
      console.error("POIS_SNAPSHOT_ERROR:", err);
      handleFirestoreError(err, OperationType.LIST, 'pois');
    });

    return () => unsubscribe();
  }, [currentNode]);

  // Client-side filtering and sorting
  useEffect(() => {
    if ((!rawBroadcasts.length && !rawPois.length) || !currentNode) {
      setBroadcasts([]);
      return;
    }

    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    const nowIso = now.toISOString();

    const allRaw = [...rawBroadcasts, ...rawPois];

    const filtered = allRaw.filter(b => {
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

      const passed = distance <= radiusLimit && isWithinWindow && isNotExpired;
      if (!passed) {
        // console.log(`BROADCAST_FILTERED: ${b.title} | dist: ${distance.toFixed(0)}m | limit: ${radiusLimit}m | window: ${isWithinWindow} | expired: ${!isNotExpired}`);
      }
      return passed;
    });

    console.log(`FILTERED_BROADCASTS: ${filtered.length} FROM_RAW: ${rawBroadcasts.length}`);
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
          access_vector: ACCESS_VECTOR,
          sponsor_id: selectedBroadcast.partner_id || selectedBroadcast.partnerId || null
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
    // Track interaction
    const activeSponsor = broadcasts.find(b => 
      b.node_id === nodeId && 
      b.partner_id && 
      b.partner_id !== 'admin' &&
      new Date(b.expires_at) > new Date()
    );

    addDoc(collection(db, 'interactions'), {
      type: 'share',
      session_uuid: SESSION_ID,
      access_vector: ACCESS_VECTOR,
      timestamp: new Date().toISOString(),
      tab: currentTab,
      node_id: nodeId || null,
      sponsor_id: activeSponsor?.partner_id || null
    }).catch(err => console.error("Error tracking share:", err));

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
      const redirect = sessionStorage.getItem('uh_login_redirect');
      if (redirect) {
        sessionStorage.removeItem('uh_login_redirect');
        sessionStorage.removeItem('uh_login_partner_mode');
        window.history.pushState({}, '', redirect);
      } else {
        window.history.pushState({}, '', '/dashboard');
      }
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
          sessionStorage.removeItem('uh_login_partner_mode');
          
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
        onLogin={() => handleLogin(false)}
        onPartnerLogin={() => handleLogin(true)}
        onTapIntoPulse={handleTapIntoPulse}
        onCreatorIgnite={handleCreatorIgnite}
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
          onLogin={() => handleLogin(false)}
          onPartnerLogin={() => handleLogin(true)}
          onTapIntoPulse={handleTapIntoPulse}
          onCreatorIgnite={handleCreatorIgnite}
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

  if (isCreatorIgnite) {
    return (
      <ErrorBoundary>
        <CreatorIntakeWindow nodeId={nodeId || undefined} />
      </ErrorBoundary>
    );
  }

  if (isMuralAdmin) {
    return (
      <ErrorBoundary>
        <MuralNodeAdmin />
      </ErrorBoundary>
    );
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
          nfcStatus={nfcStatus}
        />

        {/* HUD Notifications */}
        <AnimatePresence>
          {hudMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`absolute top-32 left-1/2 -translate-x-1/2 z-[2100] px-6 py-3 rounded-full font-black text-[10px] tracking-widest shadow-2xl border ${
                hudMessage.type === 'error' 
                  ? 'bg-uh-magenta text-white border-uh-magenta' 
                  : 'bg-uh-black text-uh-yellow border-uh-black'
              }`}
            >
              {hudMessage.text.toUpperCase()}
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
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="absolute inset-x-0 bottom-0 z-[2000] px-4 pb-4"
            >
              <div className="bg-white rounded-[40px] shadow-[0_-20px_60px_rgba(0,0,0,0.15)] max-h-[85vh] overflow-y-auto border border-uh-gray-100">
                {/* Drag Handle */}
                <div className="flex justify-center pt-4 pb-2">
                  <div className="w-12 h-1.5 bg-uh-gray-200 rounded-full" />
                </div>

                <div className="p-8">
                  <div className="flex justify-between items-start mb-8">
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 mb-2 uppercase font-mono">SELECTED_EVENT</div>
                      <h3 className="text-2xl font-black text-uh-black uppercase tracking-tight leading-tight">{selectedBroadcast.title}</h3>
                    </div>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleShare(
                          selectedBroadcast.title,
                          `Check out this event at ${currentNode?.name}!`,
                          `${BASE_URL}/tap/${nodeId}`
                        )}
                        className="flex items-center justify-center w-12 h-12 bg-uh-gray-50 text-uh-black rounded-full hover:bg-uh-gray-100 transition-colors border border-uh-gray-100"
                        title="Share Signal"
                      >
                        <Share2 size={20} />
                      </button>
                      {selectedBroadcastNode && (
                        <button 
                          onClick={() => toggleSaveHub(selectedBroadcastNode)}
                          className={`flex items-center justify-center w-12 h-12 rounded-full transition-all border ${
                            isSelectedBroadcastNodeSaved 
                              ? 'bg-uh-magenta text-white border-uh-magenta shadow-lg shadow-uh-magenta/20' 
                              : 'bg-uh-gray-50 text-uh-black border-uh-gray-100 hover:bg-uh-gray-100'
                          }`}
                          title={isSelectedBroadcastNodeSaved ? "Remove from Wallet" : "Save to Wallet"}
                        >
                          <Wallet size={20} />
                        </button>
                      )}
                      <button 
                        onClick={() => setSelectedBroadcast(null)}
                        className="w-12 h-12 flex items-center justify-center bg-uh-black text-uh-yellow rounded-full shadow-lg"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="mb-10">
                    <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">SIGNAL_INTEL</div>
                    <div className="bg-uh-gray-50 rounded-[32px] p-6 border border-uh-gray-100">
                      <p className="text-[15px] text-uh-gray-800 leading-relaxed font-sans font-medium">
                        {selectedBroadcast.description || "NO_ADDITIONAL_INTEL_AVAILABLE_FOR_THIS_SIGNAL."}
                      </p>
                      {selectedBroadcast.address && (
                        <div className="mt-6 pt-6 border-t border-uh-gray-200 flex items-center gap-3 text-[12px] text-uh-gray-600 font-bold">
                          <MapPin size={16} className="text-uh-yellow" />
                          <span>{selectedBroadcast.address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-10">
                    <div>
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">VIBE_CHECK</div>
                      <VibeCheck onReport={handleVibeReport} isReporting={isReporting} />
                    </div>
                    
                    <div>
                      <div className="text-[10px] font-black tracking-widest text-uh-gray-400 uppercase mb-4 font-mono">VIBE_TREND_ANALYSIS</div>
                      <VibeTrend broadcastId={selectedBroadcast.id} />
                    </div>
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
