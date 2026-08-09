import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { auth, db, finalDbId } from './firebase';
import { signInWithPopup, signInAnonymously, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { useLocation, Routes, Route } from 'react-router-dom';
import { collection, onSnapshot, query, where, addDoc, doc, getDoc, setDoc, getDocs, orderBy, getDocFromServer, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { Node, Broadcast, Vibe, UserProfile, UserRole, Partner, BroadcastType, LocalHub } from './types';
import { BASE_URL } from './constants';
import { DepartureBoard } from './components/DepartureBoard';
import { BroadcastModal } from './components/BroadcastModal';
import { NfcSuccessOverlay } from './components/NfcSuccessOverlay';
import { ConsentModal } from './components/ConsentModal';
import { VibeCheck } from './components/VibeCheck';
import { VibeTrend } from './components/VibeTrend';
import { Dashboard } from './components/Dashboard';
import { LandingPage } from './components/LandingPage';
import { Login } from './components/Login';
import { WalletCard } from './components/WalletCard';
import { CreatorIntakeWindow } from './components/CreatorIntakeWindow';
import { CheckoutSuccess } from './components/CheckoutSuccess';
import { CheckoutCancel } from './components/CheckoutCancel';
import { SponsorForm, SponsorSuccess, SponsorCancelled } from './components/SponsorForm';
import { SignalPage } from './pages/SignalPage';
import { WrapPage } from './pages/WrapPage';
import MuralNodeAdmin from './components/MuralNodeAdmin';
import { PartnerHeader, SignatureWalk, PartnerLogo } from './components/PartnerHeader';
import PartnerOnboarding from './pages/admin/PartnerOnboarding';
import seedData from './seed';
import { getDistance } from './utils/geo';
import { handleFirestoreError, OperationType } from './utils/firebaseErrors';
import { toMs, isNotExpired } from './utils/timeUtils';

import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { LocalPulseLoader, useLoaderLabel } from './components/LocalPulseLoader';
import { Loader2, AlertTriangle, Share2, MapPin, Wallet, X } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_PLATFORM_KEY || '';
const hasValidMapsKey = Boolean(GOOGLE_MAPS_API_KEY) && GOOGLE_MAPS_API_KEY !== 'YOUR_API_KEY';

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


class ErrorBoundary extends React.Component<
  { children: React.ReactNode; section?: string }, 
  { hasError: boolean; errorInfo: string | null }
> {
  static defaultProps = {
    section: 'SYSTEM'
  };

  constructor(props: { children: React.ReactNode; section?: string }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  render() {
    const { section } = this.props;

    if (this.state.hasError) {
      let displayMessage = "A system error has occurred.";
      let technicalDetails = this.state.errorInfo;
      
      try {
        if (this.state.errorInfo && this.state.errorInfo.startsWith('{')) {
          const parsed = JSON.parse(this.state.errorInfo);
          if (parsed.error && (parsed.error.includes('permissions') || parsed.error.includes('PERMISSION_DENIED'))) {
            displayMessage = "Access Denied: You do not have permission to view this data.";
          } else if (parsed.error) {
            displayMessage = parsed.error;
          }
        }
      } catch (e) {
        console.error("ErrorBoundary parse error:", e);
      }

      return (
        <div className={section !== 'SYSTEM'
          ? "flex flex-col items-center justify-center bg-hud-bg text-hud-magenta p-8 text-center border border-hud-magenta/20 m-4 rounded shadow-2xl"
          : "h-screen flex flex-col items-center justify-center bg-hud-bg text-hud-magenta p-8 text-center"
        }>
          <AlertTriangle className="mb-4" size={48} />
          <div className="text-xl font-bold tracking-widest mb-2 uppercase">{section}</div>
          <div className="text-sm border border-hud-magenta p-4 bg-hud-magenta/10 mb-4">{displayMessage}</div>
          <div className="flex gap-4">
            <button 
              onClick={() => this.setState({ hasError: false, errorInfo: null })}
              className="px-6 py-2 border border-hud-magenta hover:bg-hud-magenta hover:text-hud-bg transition-all font-bold text-xs"
            >
              DISMISS
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 border border-hud-magenta hover:bg-hud-magenta hover:text-hud-bg transition-all font-bold text-xs"
            >
              REBOOT_SYSTEM
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function broadcastMatchesHub(
  broadcast: Broadcast,
  currentNodeId: string,
  hubLat: number,
  hubLng: number,
  radiusMeters: number
): boolean {
  // 1. Scope all_nodes → show everywhere
  if (broadcast.scope === 'all_nodes') return true;

  // 2. Check node_ids array — multi-hub broadcasts
  if (
    broadcast.node_ids &&
    broadcast.node_ids.length > 0 &&
    broadcast.node_ids.includes(currentNodeId)
  ) return true;

  // 3. Check single node_id — legacy / single hub
  if ((broadcast.node_id === currentNodeId) || (broadcast.nodeId === currentNodeId)) return true;

  // 4. Geofence fallback — check coordinates
  if (broadcast.latitude && broadcast.longitude) {
    const dist = getDistance(
      hubLat, hubLng,
      broadcast.latitude, broadcast.longitude
    );
    return dist <= radiusMeters;
  }

  return false;
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
  const [confirmedBroadcastId, setConfirmedBroadcastId] = useState<string | null>(null);
  const [selectedBroadcastNode, setSelectedBroadcastNode] = useState<Node | null>(null);
  const [isTappedIn, setIsTappedIn] = useState(true);
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'scanning' | 'error' | 'unsupported'>('idle');
  
  // Explorer Passport & NFC Success States
  const [xp, setXp] = useState<number>(() => {
    return Number(localStorage.getItem('uh_passport_xp') || '250');
  });
  const [nodesVisitedCount, setNodesVisitedCount] = useState<number>(() => {
    return Number(localStorage.getItem('uh_passport_nodes_count') || '14');
  });
  const [badges, setBadges] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('uh_passport_badges');
      return saved ? JSON.parse(saved) : ["Downtown Explorer", "Coffee Hunter"];
    } catch {
      return ["Downtown Explorer", "Coffee Hunter"];
    }
  });
  const [connectionsCount, setConnectionsCount] = useState<number>(() => {
    return Number(localStorage.getItem('uh_passport_connections') || '3');
  });
  const [isNfcOverlayOpen, setIsNfcOverlayOpen] = useState(false);
  const [nfcOverlayNodeName, setNfcOverlayNodeName] = useState('Findlay Market');
  const [nfcOverlayXpAwarded, setNfcOverlayXpAwarded] = useState(20);
  const [nfcOverlayBadgeEarned, setNfcOverlayBadgeEarned] = useState<string | null>(null);

  // Consent Gate State (v1.0)
  const [hasConsented, setHasConsented] = useState<boolean>(() => {
    return localStorage.getItem('uh_consent_v1.0') === 'true';
  });
  const [isConsentModalOpen, setIsConsentModalOpen] = useState(false);
  const [pendingTapVector, setPendingTapVector] = useState<'nfc' | 'qr' | 'direct' | null>(null);

  const [loading, setLoading] = useState(true);
  const [nodeLoading, setNodeLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [hudMessage, setHudMessage] = useState<{ text: string; type: 'error' | 'info' } | null>(null);
  const [signatureWalks, setSignatureWalks] = useState<SignatureWalk[]>([]);
  const location = useLocation();
  const [path, setPath] = useState(location.pathname);
  const [now, setNow] = useState(new Date());

  // Derive view from path state
  const pathParts = path.split('/').filter(Boolean);
  const isDashboard = pathParts.includes('dashboard');
  const isLogin = pathParts.includes('login');
  const isMuralAdmin = pathParts.includes('admin') && pathParts.includes('mural');
  const isSignal = pathParts[0] === 'signal' && pathParts[1];
  const isWrap = pathParts[0] === 'wrap' && pathParts[1];
  const broadcastIdFromSignal = isSignal ? pathParts[1] : null;
  const tapIndex = pathParts.indexOf('tap');
  const creatorIndex = pathParts.indexOf('creator');
  const isCreatorIgnite = creatorIndex !== -1 && pathParts[creatorIndex + 1] === 'ignite';
  const isCheckoutSuccess = pathParts.includes('checkout') && pathParts.includes('success');
  const isCheckoutCancel = pathParts.includes('checkout') && pathParts.includes('cancel');
  const isSponsorIgnite = pathParts.includes('sponsor') && pathParts.includes('ignite');
  const isSponsorSuccess = pathParts.includes('sponsor') && pathParts.includes('success');
  const isSponsorCancelled = pathParts.includes('sponsor') && pathParts.includes('cancelled');
  const isPartnerOnboarding = pathParts.includes('admin') && pathParts.includes('partner-onboarding');
  const rawNodeId = tapIndex !== -1 && pathParts[tapIndex + 1] ? pathParts[tapIndex + 1] : 
                 (isCreatorIgnite && pathParts[creatorIndex + 2] ? pathParts[creatorIndex + 2] : null);
  
  // Use raw ID as-is. Standardize casing only during lookups for maximum compatibility.
  const nodeId = rawNodeId;
  const isHome = path === '/' || path === '';
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
    return 'home';
  });
  const [savedHubs, setSavedHubs] = useState<Node[]>(() => {
    const saved = localStorage.getItem('uh_saved_hubs');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('uh_saved_hubs', JSON.stringify(savedHubs));
  }, [savedHubs]);

  useEffect(() => {
    if (!nodeId) {
      setSignatureWalks([]);
      return;
    }
    const q = query(
      collection(db, 'walks'),
      where('hub_id', '==', nodeId),
      where('active', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const walks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SignatureWalk));
      setSignatureWalks(walks);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'walks');
    });
    return () => unsub();
  }, [nodeId]);

  const hubPartners = useMemo(() => {
    // Hub's list of partner IDs
    // @ts-ignore
    const partnerIds: string[] = currentNode?.partners || [];
    return partnerIds
      .map(id => partnersMap[id])
      .filter((p): p is Partner => !!p)
      .map(p => ({
        id: p.id,
        short_name: p.short_name || p.name,
        logo_url: p.logo_url || null,
        logo_initials: p.logo_initials || p.name.slice(0, 3).toUpperCase()
      })) as PartnerLogo[];
  }, [currentNode, partnersMap]);

  const isAdmin = userProfile?.role === 'admin' || 
                  userProfile?.role === 'super_admin' || 
                  user?.email === 'vannymwamba@gmail.com' || 
                  user?.email?.toLowerCase().endsWith('@urban-hikers.com');

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

  const [localHubs, setLocalHubs] = useState<LocalHub[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'nodes'), (snap) => {
      setNodes(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Node));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'local_hubs'), where('is_active', '==', true)),
      (snap) => {
        const hubs = snap.docs.map(d => {
          const hub = { id: d.id, ...d.data() } as LocalHub;
          if (currentNode && hub.latitude && hub.longitude) {
            const distMeters = getDistance(
              currentNode.latitude,
              currentNode.longitude,
              hub.latitude,
              hub.longitude
            );
            hub.distance_mi = distMeters * 0.000621371;
          }
          return hub;
        });
        // Filter to 3 miles radius from the hub context and sort: premium → paid → free
        const filteredHubs = hubs.filter(h => (h.distance_mi ?? 0) <= 3);
        const tierOrder: Record<string, number> = { premium: 0, paid: 1, free: 2 };
        setLocalHubs(filteredHubs.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]));
      }
    );
    return () => unsub();
  }, [currentNode]);

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
      console.log("AUTH_STATE_CHANGED:", u?.uid || "NO_USER", "IS_ANONYMOUS:", u?.isAnonymous);
      if (!u) {
        try {
          console.log("NO_USER_FOUND: INITIATING_ANONYMOUS_AUTH...");
          const anonRes = await signInAnonymously(auth);
          setUser(anonRes.user);
        } catch (err: any) {
          if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
            console.warn("Anonymous Authentication is disabled in Firebase Console (auth/admin-restricted-operation). Operating in guest session mode.");
          } else {
            console.error("Error signing in anonymously:", err);
          }
          setUser(null);
          setUserProfile(null);
          setLoading(false);
        }
      } else {
        setUser(u);
        try {
          const tokenResult = await u.getIdTokenResult();
          console.log("AUTH_TOKEN_CLAIMS:", tokenResult.claims);
          console.log("AUTH_TOKEN_ROLE_CLAIM:", tokenResult.claims.role);
        } catch (err) {
          console.error("Error getting token result:", err);
        }
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
        const email = user.email?.toLowerCase().trim() || '';
        const isInternal = email.endsWith('@urban-hikers.com');

        // If they are currently a 'user' or 'admin' without a partner link, check if they should be linked
        const currentPartnerId = profile.partnerId || profile.partner_id;
        if ((profile.role as string) === 'user' || (profile.role === 'admin' && !currentPartnerId) || (isInternal && (profile.role as string) === 'user')) {
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
            const needsRoleUpgrade = (profile.role as string) === 'user' && partnerData.role && profile.role !== partnerData.role;
            const needsPartnerLink = currentPartnerId !== partnerId;

            if (needsPartnerLink || needsRoleUpgrade || (isInternal && (profile.role as string) === 'user')) {
              const updates: any = {};
              if (needsPartnerLink) {
                updates.partnerId = partnerId;
              }
              
              if (isInternal && (profile.role as string) === 'user') {
                updates.role = 'admin';
              } else if (needsRoleUpgrade) {
                updates.role = partnerData.role;
              } else if ((profile.role as string) === 'user' && !isInternal) {
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
          } else if (isInternal && (profile.role as string) === 'user') {
            try {
              await updateDoc(profileRef, { role: 'admin' });
            } catch (err) {
              console.error("Error auto-upgrading internal user:", err);
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
            role: (email.endsWith('@urban-hikers.com')) ? 'admin' : (partnerData.role || 'partner'),
            partnerId: partnerId
          };
        } else {
          const isInternal = email.endsWith('@urban-hikers.com');
          profile = {
            uid: user.uid,
            email: user.email!,
            role: (user.email === 'vannymwamba@gmail.com' || isInternal) ? 'admin' : 'user'
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
    const q = query(collection(db, 'partners'), where('active', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        try {
          const map: Record<string, Partner> = {};
          snap.docs.forEach(doc => {
            map[doc.id] = { id: doc.id, ...doc.data() } as Partner;
          });
          setPartnersMap(map);
        } catch (err) {
          console.error("PARTNERS_SNAPSHOT_PROCESSING_ERROR", err);
          setPartnersMap({});
        }
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
    const defaultHub = 'ALPHA_PLAZA_HUB';
    
    if (user) {
      window.history.pushState({}, '', `/tap/${defaultHub}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }

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

  const handleConsentAccepted = useCallback(() => {
    localStorage.setItem('uh_consent_v1.0', 'true');
    setHasConsented(true);
    setIsConsentModalOpen(false);
  }, []);

  const recordTap = useCallback(async (vectorOverride?: 'nfc' | 'qr' | 'direct') => {
    if (!currentNode || !nodeId) return;

    // Check Consent Gate
    const consentStored = localStorage.getItem('uh_consent_v1.0');
    if (!consentStored || consentStored !== 'true') {
      console.log("RECORD_TAP_BLOCKED: CONSENT_REQUIRED");
      setPendingTapVector(vectorOverride || ACCESS_VECTOR);
      setIsConsentModalOpen(true);
      return;
    }
    
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

        // Resolve artist_id directly from the node document
        const artistId = currentNode.artist_id || currentNode.artistId || currentNode.partner_name || null;

        // Ensure user UID is present (trigger anonymous auth if missing)
        let currentUid = auth.currentUser?.uid;
        if (!currentUid) {
          try {
            const anonRes = await signInAnonymously(auth);
            currentUid = anonRes.user.uid;
          } catch (authErr: any) {
            console.warn("Could not acquire anonymous UID for tap (guest session fallback):", authErr?.message || authErr);
          }
        }

        // Compute tap value score based on vector verification, artist attribution, sponsor backing, and trail momentum
        const vectorWeight = vector === 'nfc' ? 1.0 : vector === 'qr' ? 0.8 : 0.5;
        const sponsorBonus = activeSponsor?.partner_id ? 0.5 : 0;
        const artistBonus = artistId ? 0.3 : 0;
        const trailBonus = nodesVisitedCount > 5 ? 0.2 : 0;
        const computedValueScore = Number((vectorWeight + sponsorBonus + artistBonus + trailBonus).toFixed(2));

        console.log(`RECORDING_TAP: NODE=${nodeId} ARTIST=${artistId} UID=${currentUid} VECTOR=${vector} VALUE_SCORE=${computedValueScore} SPONSOR=${activeSponsor?.partner_id || 'NONE'}`);

        const tapPayload = {
          node_id: nodeId,
          artist_id: artistId,
          uid: currentUid || null,
          session_uuid: SESSION_ID,
          access_vector: vector,
          timestamp: serverTimestamp(), // Authoritative server timestamp
          client_timestamp: new Date().toISOString(), // Reference client ISO timestamp
          consent_version: 'v1.0', // Mandatory consent version
          value_score: computedValueScore, // Dynamic engagement value score
          tab: currentTab,
          sponsor_id: activeSponsor?.partner_id || null,
          walkId: new URLSearchParams(window.location.search).get('walkId') ?? null,
          eventTag: new URLSearchParams(window.location.search).get('eventTag') ?? null,
        };

        try {
          await addDoc(collection(db, 'taps'), tapPayload);
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

  useEffect(() => {
    if (hasConsented && pendingTapVector) {
      const vec = pendingTapVector;
      setPendingTapVector(null);
      recordTap(vec);
    }
  }, [hasConsented, pendingTapVector, recordTap]);

  const triggerNfcSuccessAnimation = useCallback((nodeTitle: string) => {
    // Increment local node tap counter for UI purposes
    if (currentNode?.id) {
      const key = `uh_tap_count_${currentNode.id}`;
      const prevCount = Number(localStorage.getItem(key) || '1');
      const nextCount = prevCount + 1;
      localStorage.setItem(key, String(nextCount));
      window.dispatchEvent(new CustomEvent('uh-node-tapped', { detail: { nodeId: currentNode.id, count: nextCount } }));
    }

    // Award XP
    setXp(prev => {
      const nextXp = prev + 25;
      localStorage.setItem('uh_passport_xp', String(nextXp));
      return nextXp;
    });

    // Visited Nodes increase
    setNodesVisitedCount(prev => {
      const nextCount = prev + 1;
      localStorage.setItem('uh_passport_nodes_count', String(nextCount));
      return nextCount;
    });

    // Check if new badges unlocked
    const currentBadges = [...badges];
    let newlyEarned: string | null = null;
    if (nodesVisitedCount >= 14 && !currentBadges.includes("OTR Trailblazer")) {
      newlyEarned = "OTR Trailblazer";
      currentBadges.push("OTR Trailblazer");
      setBadges(currentBadges);
      localStorage.setItem('uh_passport_badges', JSON.stringify(currentBadges));
    } else if (nodesVisitedCount >= 15 && !currentBadges.includes("Hyperlocal Guru")) {
      newlyEarned = "Hyperlocal Guru";
      currentBadges.push("Hyperlocal Guru");
      setBadges(currentBadges);
      localStorage.setItem('uh_passport_badges', JSON.stringify(currentBadges));
    }

    setNfcOverlayBadgeEarned(newlyEarned);
    setNfcOverlayNodeName(nodeTitle);
    setIsNfcOverlayOpen(true);
    setHudMessage({ text: "NFC_TAP_SUCCESSFUL", type: 'info' });
  }, [nodesVisitedCount, badges]);

  const simulateNfcTap = useCallback(() => {
    setIsTappedIn(true);
    recordTap('nfc');
    triggerNfcSuccessAnimation(currentNode?.name || 'Findlay Market');
  }, [currentNode, recordTap, triggerNfcSuccessAnimation]);

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
          triggerNfcSuccessAnimation(currentNode?.name || 'Findlay Market');
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
      const activeNodeId = nodeId || 'ALPHA_PLAZA_HUB';
      console.log(`FETCHING_NODE: ${activeNodeId}`);
      
      // Only set central loading if we don't have a node yet
      if (!currentNode) {
        setLoading(true);
      } else {
        setNodeLoading(true);
      }

      let activeUnsubscribe: (() => void) | null = null;
      let isCancelled = false;
      
      const subscribeToId = (targetId: string, isFallback: boolean = false) => {
        if (isCancelled) return;
        if (activeUnsubscribe) activeUnsubscribe();
        
        const nodeRef = doc(db, 'nodes', targetId);
        activeUnsubscribe = onSnapshot(nodeRef, (nodeSnap) => {
          if (isCancelled) return;
          console.log(`NODE_SNAPSHOT_RECEIVED: ${targetId}, EXISTS: ${nodeSnap.exists()}`);
          if (nodeSnap.exists()) {
            setCurrentNode({ id: nodeSnap.id, ...nodeSnap.data() } as Node);
          } else if (isFallback) {
            console.warn(`NODE_NOT_FOUND_EVEN_WITH_FALLBACK: ${targetId}`);
            setCurrentNode({
              id: targetId,
              name: `SECTOR_${targetId.toUpperCase()}`,
              type: 'street',
              latitude: 39.1092,
              longitude: -84.5125,
              radius_limit: 5000
            });
          }
          setLoading(false);
          setNodeLoading(false);
        }, (err) => {
          if (isCancelled) return;
          console.error(`NODE_SNAPSHOT_ERROR: ${targetId}`, err);
          setLoading(false);
          setNodeLoading(false);
          handleFirestoreError(err, OperationType.GET, `nodes/${targetId}`);
        });
      };

      // 1. Direct Try
      const nodeRef = doc(db, 'nodes', activeNodeId);
      getDoc(nodeRef).then((nodeSnap) => {
        if (isCancelled) return;
        if (nodeSnap.exists()) {
          // Success: exact direct ID match
          subscribeToId(activeNodeId);
        } else {
          // 2. Collection scan for case-insensitive ID or Name-based matching
          getDocs(collection(db, 'nodes')).then((querySnap) => {
            if (isCancelled) return;
            let matchedId: string | null = null;
            const searchLower = activeNodeId.toLowerCase();
            
            // First pass: exact ID match (case-insensitive) or exact Name match (case-insensitive)
            for (const d of querySnap.docs) {
              const dIdLower = d.id.toLowerCase();
              const nNameLower = (d.data().name || '').toLowerCase();
              if (dIdLower === searchLower || nNameLower === searchLower) {
                matchedId = d.id;
                break;
              }
            }
            
            // Second pass: starts-with ID match or starts-with Name match
            if (!matchedId) {
              for (const d of querySnap.docs) {
                const dIdLower = d.id.toLowerCase();
                const nNameLower = (d.data().name || '').toLowerCase();
                if (dIdLower.startsWith(searchLower) || nNameLower.startsWith(searchLower)) {
                  matchedId = d.id;
                  break;
                }
              }
            }
            
            // Third pass: contains ID match or contains Name match
            if (!matchedId) {
              for (const d of querySnap.docs) {
                const dIdLower = d.id.toLowerCase();
                const nNameLower = (d.data().name || '').toLowerCase();
                if (dIdLower.includes(searchLower) || nNameLower.includes(searchLower)) {
                  matchedId = d.id;
                  break;
                }
              }
            }

            if (matchedId) {
              console.log(`RESOLVED_SLUG: "${activeNodeId}" -> REAL_NODE_ID: "${matchedId}"`);
              // Update URL seamlessly for the user
              window.history.replaceState({}, '', `/tap/${matchedId}`);
              subscribeToId(matchedId);
            } else {
              // 3. True fallback to pseudo-node
              subscribeToId(activeNodeId, true);
            }
          }).catch((err) => {
            if (isCancelled) return;
            console.error("COLLECTION_SCAN_FAILED", err);
            subscribeToId(activeNodeId, true);
          });
        }
      }).catch((err) => {
        if (isCancelled) return;
        console.error("DIRECT_GET_DOC_FAILED", err);
        subscribeToId(activeNodeId, true);
      });

      return () => {
        isCancelled = true;
        if (activeUnsubscribe) activeUnsubscribe();
      };
    };

    const unsubscribe = fetchNode();
    return () => unsubscribe();
  }, [nodeId, isDashboard, isHome]);

  // Connection Test - Run once on mount
  useEffect(() => {
    const testConnection = async (retries = 3) => {
      try {
        console.log(`FIREBASE_CONNECTION_TEST: ATTEMPTING to read nodes/connection-test on DB: ${finalDbId}`);
        // Use getDocFromServer to bypass local cache and force a network request
        await getDocFromServer(doc(db, 'nodes', 'connection-test'));
        console.log("FIREBASE_CONNECTION_TEST: SUCCESS");
      } catch (err: any) {
        const errInfo = {
          error: err.message,
          code: err.code,
          dbId: finalDbId,
          auth: auth.currentUser ? { uid: auth.currentUser.uid, email: auth.currentUser.email } : 'ANONYMOUS'
        };
        console.warn("FIREBASE_CONNECTION_TEST: FAILED", JSON.stringify(errInfo, null, 2));
        
        if (retries > 0 && (err.message?.includes('offline') || err.code === 'unavailable')) {
          console.log(`FIREBASE_CONNECTION_TEST: RETRYING in 3s... (${retries} left)`);
          setTimeout(() => testConnection(retries - 1), 3000);
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
    // Optimization: We use targeted queries to reduce payload size and speed up scan-to-display
    const sessionStartTime = Timestamp.fromDate(new Date(Date.now() - 3600000));
    
    const q = query(
      collection(db, 'broadcasts'),
      where('expires_at', '>', sessionStartTime)
      // Note: We'd love to query by node directly, 
      // but scope='all_nodes' broadcasts wouldn't show.
      // For now we keep the city-wide fetch but we'll optimize 
      // by separating it if it becomes a major bottleneck.
    );

    // Speed optimization: Parallel fetch node and broadcasts
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log(`BROADCASTS_SNAPSHOT_RECEIVED: ${snapshot.size} DOCS`);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Broadcast[];
      
      setRawBroadcasts(data);
      
      const civicCount = data.filter(b => b.type === 'civic_event').length;
      console.log(`BROADCASTS_PROCESSED: ${data.length} TOTAL, ${civicCount} CIVIC_EVENTS_FOUND`);
      
      // Removed mandatory setLoading(false) here because node fetch also manages it
    }, (err) => {
      console.error("BROADCASTS_SNAPSHOT_ERROR:", err);
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
          type: BroadcastType.MURAL,
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
      // Default to 8km (approx 5 miles) for a more inclusive local feel in Cincinnati
      const radiusLimit = currentNode.radius_limit || (currentNode as any).radiusLimit || 8046;
      
      const matched = broadcastMatchesHub(
        b,
        currentNode.id,
        currentNode.latitude,
        currentNode.longitude,
        radiusLimit
      );

      const startsAt = b.starts_at || b.startsAt || '';
      
      // Handle startsAt as Timestamp or string
      const startsAtTime = (startsAt && typeof (startsAt as any).toDate === 'function') 
        ? (startsAt as any).toDate().getTime() 
        : (startsAt ? new Date(startsAt).getTime() : 0);
      
      const isWithinWindow = !startsAt || startsAtTime <= (now.getTime() + 24 * 60 * 60 * 1000);
      const isStillValid = isNotExpired(b);

      return matched && isWithinWindow && isStillValid;
    });

    console.log(`FILTERED_BROADCASTS: ${filtered.length} FROM_RAW: ${rawBroadcasts.length}`);
    const sortedBroadcasts = [...filtered].sort((a, b) => {
      const partnerA = partnersMap[a.partner_id || a.partnerId || ''];
      const partnerB = partnersMap[b.partner_id || b.partnerId || ''];
      const aSponsored = !!(partnerA?.logo_url || partnerA?.brand_color);
      const bSponsored = !!(partnerB?.logo_url || partnerB?.brand_color);
      
      if (aSponsored && !bSponsored) return -1;
      if (!aSponsored && bSponsored) return 1;
      
      const getStartTime = (b: Broadcast) => {
        const startsAt = b.starts_at || b.startsAt || 0;
        if (typeof (startsAt as any).toDate === 'function') {
          return (startsAt as any).toDate().getTime();
        }
        return new Date(startsAt).getTime();
      };

      return getStartTime(a) - getStartTime(b);
    });

    setBroadcasts(sortedBroadcasts);
  }, [rawBroadcasts, now, currentNode, partnersMap]);

  const handleVibeReport = async (vibe: Vibe) => {
    if (!selectedBroadcast) return;
    
    setIsReporting(true);
    try {
      
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

  // Update document title dynamically
  useEffect(() => {
    if (selectedBroadcast) {
      document.title = `${selectedBroadcast.title} @ ${currentNode?.name || 'Local Pulse'}`;
    } else if (currentNode) {
      document.title = `${currentNode.name} Hub | Local Pulse`;
    } else {
      document.title = 'Local Pulse | Urban Hikers';
    }
  }, [selectedBroadcast, currentNode]);

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

  const loaderLabel = useLoaderLabel(nodeId ? 'hub' : 'auth');

  if (loading && !currentNode) {
    return (
      <LocalPulseLoader 
        variant="full" 
        label={loaderLabel} 
        onPulseClick={handleTapIntoPulse}
      />
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
          window.location.href = '/tap/ALPHA_PLAZA_HUB';
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
            window.location.href = '/tap/ALPHA_PLAZA_HUB';
            localStorage.setItem('uh_initial_tab', 'wallet');
          }}
        />
      );
    }
    
    if ((userProfile.role as string) === 'user') {
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

    return (
      <ErrorBoundary section="CONTROL_CENTER">
        <Dashboard user={user} userProfile={userProfile} nodes={nodes} onLogout={() => auth.signOut()} />
      </ErrorBoundary>
    );
  }

  if (isCreatorIgnite) {
    return (
      <ErrorBoundary>
        <CreatorIntakeWindow nodeId={nodeId || undefined} />
      </ErrorBoundary>
    );
  }

  if (isCheckoutSuccess) {
    return (
      <ErrorBoundary>
        <CheckoutSuccess />
      </ErrorBoundary>
    );
  }

  if (isCheckoutCancel) {
    return (
      <ErrorBoundary>
        <CheckoutCancel />
      </ErrorBoundary>
    );
  }

  if (isSponsorIgnite) {
    return (
      <ErrorBoundary>
        <SponsorForm />
      </ErrorBoundary>
    );
  }

  if (isSponsorSuccess) {
    return (
      <ErrorBoundary>
        <SponsorSuccess />
      </ErrorBoundary>
    );
  }

  if (isSponsorCancelled) {
    return (
      <ErrorBoundary>
        <SponsorCancelled />
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

  if (isPartnerOnboarding) {
    if (!isAdmin) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-hud-bg text-hud-magenta p-8 text-center">
          <AlertTriangle className="mb-4" size={48} />
          <div className="text-xl font-bold tracking-widest mb-2">ACCESS_RESTRICTED</div>
          <div className="text-sm border border-hud-magenta p-4 bg-hud-magenta/10 mb-8">
            YOU_DO_NOT_HAVE_ADMIN_PERMISSIONS
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
    return (
      <ErrorBoundary>
        <PartnerOnboarding />
      </ErrorBoundary>
    );
  }

  if (isSignal) {
    return (
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
        <ErrorBoundary>
          <Routes>
            <Route path="/signal/:broadcastId" element={<SignalPage />} />
          </Routes>
        </ErrorBoundary>
      </APIProvider>
    );
  }

  if (isWrap) {
    return (
      <ErrorBoundary>
        <Routes>
          <Route path="/wrap/:vendorId" element={<WrapPage />} />
        </Routes>
      </ErrorBoundary>
    );
  }

  if (!hasValidMapsKey && isDashboard) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',fontFamily:'sans-serif', backgroundColor: '#0a0a0a', color: '#fff'}}>
        <div style={{textAlign:'center',maxWidth:520, padding: 40, border: '1px solid #FFE01A', borderRadius: 24}}>
          <h2 style={{ color: '#FFE01A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Google Maps API Key Required</h2>
          <p style={{ opacity: 0.7, marginBottom: 20 }}>The Sector Hubs Network requires a valid Maps API key for geocoding services.</p>
          <p><strong>Step 1:</strong> <a href="https://console.cloud.google.com/google/maps-apis/start" target="_blank" rel="noopener" style={{ color: '#FFE01A' }}>Get an API Key</a></p>
          <p><strong>Step 2:</strong> Add your key as a secret in AI Studio:</p>
          <ul style={{textAlign:'left',lineHeight:'1.8', listStyle: 'none', padding: 0}}>
            <li>• Open <strong>Settings</strong> (⚙️ gear icon, <strong>top-right corner</strong>)</li>
            <li>• Select <strong>Secrets</strong></li>
            <li>• Type <code>GOOGLE_MAPS_PLATFORM_KEY</code> as the name, press <strong>Enter</strong></li>
            <li>• Paste your API key as the value, press <strong>Enter</strong></li>
          </ul>
          <p style={{ marginTop: 20, fontSize: '12px', opacity: 0.5 }}>The app rebuilds automatically after you add the secret.</p>
        </div>
      </div>
    );
  }

  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} version="weekly">
      <ErrorBoundary>
        <div key={nodeId} className="h-screen max-w-md mx-auto bg-hud-bg flex flex-col relative overflow-hidden shadow-2xl">
        {/* Scanline Effect */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] z-50 bg-[length:100%_2px,3px_100%] opacity-30" />
        
        <ErrorBoundary section="DEPARTURE_BOARD">
          <div className="flex flex-col h-full">
            <PartnerHeader 
              walks={signatureWalks} 
              allPartners={hubPartners} 
            />
            <DepartureBoard 
              nodeName={currentNode?.name || 'UNKNOWN_SECTOR'} 
            currentNode={currentNode}
            nodes={nodes}
            broadcasts={broadcasts}
            onSelect={setSelectedBroadcast}
            onConfirm={(id) => setConfirmedBroadcastId(id)}
            user={user}
            userProfile={userProfile}
            onLogin={handleLogin}
            isTappedIn={isTappedIn}
            onTapToggle={setIsTappedIn}
            accessVector={ACCESS_VECTOR}
            xp={xp}
            nodesVisitedCount={nodesVisitedCount}
            badges={badges}
            connectionsCount={connectionsCount}
            onSimulateNfc={simulateNfcTap}
            onShareNode={() => handleShare(
              `Urban Hikers: ${currentNode?.name}`,
              `Check out what's live at ${currentNode?.name}!`,
              window.location.origin + window.location.pathname
            )}
            onShareEvent={(b) => handleShare(
              b.title,
              `Check out this event at ${currentNode?.name}!`,
              `${window.location.origin}/tap/${nodeId}?broadcastId=${b.id}`
            )}
            onManage={(b) => {
              window.history.pushState({}, '', `/dashboard?editBroadcastId=${b.id}`);
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            onSaveToWallet={(node) => (node || currentNode) && toggleSaveHub(node || currentNode!)}
            isSaved={currentNode ? savedHubs.some(h => h.id === currentNode.id) : false}
            activeTab={currentTab}
            onTabChange={setCurrentTab}
            savedHubs={savedHubs}
            partnersMap={partnersMap}
            nfcStatus={nfcStatus}
            localHubs={localHubs}
            loading={loading || nodeLoading}
          />
          </div>
        </ErrorBoundary>

        {/* HUD Notifications */}
        <ErrorBoundary section="HUD_NOTIFICATIONS">
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
        </ErrorBoundary>

        {/* Hidden Seed Button for Demo */}
        <button 
          onClick={handleSeed}
          disabled={isSeeding}
          className="absolute bottom-2 right-2 text-[8px] text-hud-green/20 hover:text-hud-green/60 transition-colors z-[2100]"
        >
          {isSeeding ? 'SEEDING...' : '[INIT_DB]'}
        </button>

        <ErrorBoundary section="BROADCAST_MODAL">
          <BroadcastModal
            broadcast={selectedBroadcast}
            onClose={() => setSelectedBroadcast(null)}
            onShare={handleShare}
            onSaveToWallet={toggleSaveHub}
            isSaved={isSelectedBroadcastNodeSaved}
            node={selectedBroadcastNode}
            onVibeReport={handleVibeReport}
            isReporting={isReporting}
            confirmed={confirmedBroadcastId === selectedBroadcast?.id}
          />
        </ErrorBoundary>

        <ConsentModal
          isOpen={isConsentModalOpen}
          onConsent={handleConsentAccepted}
          onClose={() => setIsConsentModalOpen(false)}
        />

        <NfcSuccessOverlay
          isOpen={isNfcOverlayOpen}
          onClose={() => setIsNfcOverlayOpen(false)}
          nodeName={nfcOverlayNodeName}
          xpAwarded={nfcOverlayXpAwarded}
          badgeEarned={nfcOverlayBadgeEarned}
          onSocialRecord={(metSomeone) => {
            if (metSomeone) {
              setXp(px => {
                const nextXp = px + 10;
                localStorage.setItem('uh_passport_xp', String(nextXp));
                return nextXp;
              });
              setConnectionsCount(pc => {
                const nextCount = pc + 1;
                localStorage.setItem('uh_passport_connections', String(nextCount));
                return nextCount;
              });
            }
          }}
        />
      </div>
    </ErrorBoundary>
    </APIProvider>
  );
}
