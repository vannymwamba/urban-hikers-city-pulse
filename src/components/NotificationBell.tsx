import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Bell,
  X,
  MapPin,
  Tag,
  Search,
  Activity,
  Radio,
  CheckCircle2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { AppNotification, Broadcast, Node } from '../types';

interface NotificationBellProps {
  uid: string | null | undefined;
  isAdmin?: boolean;
  nodes?: Node[];
  broadcasts?: Broadcast[];
  onOpenNode?: (nodeId: string) => void;
  onNavigate?: (path: string) => void;
}

const CLEARED_STORAGE_KEY = 'uh_notif_cleared_ids_v1';
const WATERMARK_STORAGE_KEY = 'uh_notif_watermark_ms';
const MAX_CLEARED_IDS = 250;

function loadClearedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(CLEARED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
  } catch {
    // Ignore storage read issues
  }
  return new Set();
}

function saveClearedIds(ids: Set<string>) {
  try {
    const arr = Array.from(ids).slice(-MAX_CLEARED_IDS);
    localStorage.setItem(CLEARED_STORAGE_KEY, JSON.stringify(arr));
  } catch {
    // Ignore storage write issues
  }
}

function initWatermarkMs(): { watermarkMs: number; isFirstSession: boolean } {
  try {
    const existing = localStorage.getItem(WATERMARK_STORAGE_KEY);
    if (existing) {
      const parsed = Number(existing);
      if (Number.isFinite(parsed) && parsed > 0) {
        return { watermarkMs: parsed, isFirstSession: false };
      }
    }
    const legacy = localStorage.getItem('last_visit_timestamp');
    if (legacy) {
      const parsed = Number(legacy);
      if (Number.isFinite(parsed) && parsed > 0) {
        localStorage.setItem(WATERMARK_STORAGE_KEY, String(parsed));
        return { watermarkMs: parsed, isFirstSession: false };
      }
    }
    const now = Date.now();
    localStorage.setItem(WATERMARK_STORAGE_KEY, String(now));
    return { watermarkMs: now, isFirstSession: true };
  } catch {
    return { watermarkMs: Date.now(), isFirstSession: true };
  }
}

function parseTimestampMs(value: any): number {
  if (!value) return Date.now();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value?.toMillis === 'function') {
    const ms = value.toMillis();
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof value?.toDate === 'function') {
    const ms = value.toDate().getTime();
    if (Number.isFinite(ms)) return ms;
  }
  if (typeof value?.seconds === 'number') {
    return value.seconds * 1000 + Math.floor((value.nanoseconds || 0) / 1e6);
  }
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (Number.isFinite(ms)) return ms;
  }
  return Date.now();
}

function timeAgo(msOrValue: any): string {
  const ms = parseTimestampMs(msOrValue);
  const diffMin = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

function getNotificationMeta(notification: AppNotification) {
  switch (notification.type) {
    case 'proposal_approved':
      return {
        Icon: MapPin,
        label: 'Spot Live',
        pillClass: 'bg-[#F2C94C]/20 text-[#F2C94C] border-[#F2C94C]/30',
        iconClass: 'bg-[#F2C94C]/15 text-[#F2C94C] border-[#F2C94C]/30',
        cta: 'Open hub →',
      };
    case 'proposal_submitted':
      return {
        Icon: CheckCircle2,
        label: 'Spot Suggested',
        pillClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        iconClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
        cta: '',
      };
    case 'proposal_pending':
      return {
        Icon: Sparkles,
        label: 'New Proposal',
        pillClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        iconClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
        cta: 'Review in Dashboard →',
      };
    case 'lost_found':
      if (notification.subtype === 'found') {
        return {
          Icon: Search,
          label: 'Found Item',
          pillClass: 'bg-[#F2C94C]/20 text-[#F2C94C] border-[#F2C94C]/30',
          iconClass: 'bg-[#F2C94C]/15 text-[#F2C94C] border-[#F2C94C]/30',
          cta: 'View in Lost & Found →',
        };
      }
      return {
        Icon: Tag,
        label: 'Lost Item',
        pillClass: 'bg-[#E24A3B]/20 text-[#FF8577] border-[#E24A3B]/30',
        iconClass: 'bg-[#E24A3B]/15 text-[#FF8577] border-[#E24A3B]/30',
        cta: 'View in Lost & Found →',
      };
    case 'vibe_report':
      return {
        Icon: Activity,
        label: 'Vibe Check',
        pillClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
        iconClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
        cta: 'View signal →',
      };
    case 'broadcast':
    default:
      return {
        Icon: Radio,
        label: 'Live Signal',
        pillClass: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
        iconClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
        cta: 'Open signal →',
      };
  }
}

export function NotificationBell({
  uid,
  isAdmin = false,
  nodes = [],
  broadcasts = [],
  onOpenNode,
  onNavigate,
}: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => loadClearedIds());
  const [inboxItems, setInboxItems] = useState<AppNotification[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<AppNotification[]>([]);
  const [vibeItems, setVibeItems] = useState<AppNotification[]>([]);
  const [broadcastItems, setBroadcastItems] = useState<AppNotification[]>([]);
  const [proposalItems, setProposalItems] = useState<AppNotification[]>([]);
  const [localItems, setLocalItems] = useState<AppNotification[]>([]);
  const [liveToast, setLiveToast] = useState<AppNotification | null>(null);

  const initialSessionRef = useRef<{ watermarkMs: number; isFirstSession: boolean } | null>(null);
  if (!initialSessionRef.current) {
    initialSessionRef.current = initWatermarkMs();
  }

  const clearedIdsRef = useRef<Set<string>>(clearedIds);
  clearedIdsRef.current = clearedIds;

  const isOpenRef = useRef<boolean>(isOpen);
  isOpenRef.current = isOpen;

  const viewedKeysRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);

  const nodeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    nodes.forEach((n) => {
      if (n.id && n.name) map.set(n.id, n.name);
    });
    return map;
  }, [nodes]);

  const broadcastTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    broadcasts.forEach((b) => {
      if (b.id && b.title) map.set(b.id, b.title);
    });
    return map;
  }, [broadcasts]);

  const nodeNameMapRef = useRef(nodeNameMap);
  nodeNameMapRef.current = nodeNameMap;

  const broadcastTitleMapRef = useRef(broadcastTitleMap);
  broadcastTitleMapRef.current = broadcastTitleMap;

  const triggerToast = useCallback((item: AppNotification) => {
    if (isOpenRef.current) return;
    if (item.key && clearedIdsRef.current.has(item.key)) return;
    setLiveToast(item);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setLiveToast((current) => (current?.key === item.key ? null : current));
    }, 4800);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  // 1. Personal inbox listener: users/{uid}/notifications
  useEffect(() => {
    if (!uid) {
      setInboxItems([]);
      return;
    }

    let initialized = false;
    const seenDocIds = new Set<string>();

    const q = query(
      collection(db, 'users', uid, 'notifications'),
      orderBy('created_at', 'desc'),
      limit(25)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let newestLive: AppNotification | null = null;

        if (initialized) {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && !seenDocIds.has(change.doc.id)) {
              const raw = change.doc.data({ serverTimestamps: 'estimate' });
              if (!raw.read) {
                const key = `inbox:${change.doc.id}`;
                if (!clearedIdsRef.current.has(key)) {
                  newestLive = {
                    id: change.doc.id,
                    key,
                    type: raw.type || 'proposal_approved',
                    title: raw.title || 'Update on your spot',
                    body: raw.body || '',
                    read: Boolean(raw.read),
                    created_at: raw.created_at,
                    created_ms: parseTimestampMs(raw.created_at),
                    node_id: raw.node_id,
                    proposal_id: raw.proposal_id,
                    broadcast_id: raw.broadcast_id,
                    route_path: raw.route_path || (raw.node_id ? `/tap/${raw.node_id}` : undefined),
                    source: 'inbox',
                  };
                }
              }
            }
          });
        }

        const nextItems: AppNotification[] = [];
        snap.docs.forEach((d) => {
          seenDocIds.add(d.id);
          const raw = d.data({ serverTimestamps: 'estimate' });
          if (raw.read) return;
          const key = `inbox:${d.id}`;
          nextItems.push({
            id: d.id,
            key,
            type: raw.type || 'proposal_approved',
            title: raw.title || 'Update on your spot',
            body: raw.body || '',
            read: false,
            created_at: raw.created_at,
            created_ms: parseTimestampMs(raw.created_at),
            node_id: raw.node_id,
            proposal_id: raw.proposal_id,
            broadcast_id: raw.broadcast_id,
            route_path: raw.route_path || (raw.node_id ? `/tap/${raw.node_id}` : undefined),
            source: 'inbox',
          });
        });

        initialized = true;
        setInboxItems(nextItems);
        if (newestLive) triggerToast(newestLive);
      },
      (err) => console.warn('Notification inbox sync error:', err)
    );

    return () => unsubscribe();
  }, [uid, triggerToast]);

  // 2. Real-time Lost & Found activity listener
  useEffect(() => {
    const { watermarkMs, isFirstSession } = initialSessionRef.current!;
    let initialized = false;
    const baselineIds = new Set<string>();
    const liveAddedIds = new Set<string>();

    const q = query(collection(db, 'lost_found'), orderBy('reportedAt', 'desc'), limit(12));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let newestLive: AppNotification | null = null;

        if (!initialized) {
          snap.docs.forEach((d) => baselineIds.add(d.id));
        } else {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && !baselineIds.has(change.doc.id)) {
              liveAddedIds.add(change.doc.id);
            }
          });
        }

        const items: AppNotification[] = [];
        snap.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          if (data.status && data.status !== 'open') return;
          const createdMs = parseTimestampMs(data.reportedAt);
          const isLiveNew = liveAddedIds.has(d.id);
          const isRecentSinceLastVisit = !isFirstSession && createdMs > watermarkMs;

          if (!isLiveNew && !isRecentSinceLastVisit) return;

          const key = `lf:${d.id}`;
          const isFound = data.type === 'found';
          const resolvedLocation =
            (data.node_id && nodeNameMapRef.current.get(data.node_id)) ||
            (data.location && data.location !== 'Reported at this node' ? data.location : '') ||
            'Community Hub';
          const desc = (data.description || 'Community item report').trim();

          const item: AppNotification = {
            id: d.id,
            key,
            type: 'lost_found',
            subtype: isFound ? 'found' : 'lost',
            title: isFound ? 'Found item reported nearby' : 'Lost item reported nearby',
            body: `${desc} · ${resolvedLocation}`,
            read: false,
            created_at: data.reportedAt,
            created_ms: isLiveNew ? Math.max(createdMs, Date.now() - 1000) : createdMs,
            node_id: data.node_id,
            route_path: '/lost-and-found',
            source: 'activity',
          };

          items.push(item);
          if (initialized && isLiveNew && !newestLive) {
            newestLive = item;
          }
        });

        initialized = true;
        setLostFoundItems(items);
        if (newestLive) triggerToast(newestLive);
      },
      (err) => console.warn('Lost & Found notification listener warning:', err)
    );

    return () => unsubscribe();
  }, [triggerToast]);

  // 3. Real-time Vibe Check activity listener (uses actual `reported_at` field)
  useEffect(() => {
    const { watermarkMs, isFirstSession } = initialSessionRef.current!;
    let initialized = false;
    const baselineIds = new Set<string>();
    const liveAddedIds = new Set<string>();

    const q = query(collection(db, 'vibe_reports'), orderBy('reported_at', 'desc'), limit(12));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let newestLive: AppNotification | null = null;

        if (!initialized) {
          snap.docs.forEach((d) => baselineIds.add(d.id));
        } else {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && !baselineIds.has(change.doc.id)) {
              liveAddedIds.add(change.doc.id);
            }
          });
        }

        const items: AppNotification[] = [];
        snap.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          const createdMs = parseTimestampMs(data.reported_at || data.reportedAt);
          const isLiveNew = liveAddedIds.has(d.id);
          const isRecentSinceLastVisit = !isFirstSession && createdMs > watermarkMs;

          if (!isLiveNew && !isRecentSinceLastVisit) return;

          const key = `vibe:${d.id}`;
          const vibeStr = String(data.vibe || 'buzzing');
          const signalTitle =
            data.broadcast_id && broadcastTitleMapRef.current.get(data.broadcast_id);

          const item: AppNotification = {
            id: d.id,
            key,
            type: 'vibe_report',
            subtype: vibeStr,
            title: `Crowd vibe check: ${vibeStr.toUpperCase()}`,
            body: signalTitle
              ? `"${signalTitle}" was just rated ${vibeStr}.`
              : `A live spot nearby was just rated ${vibeStr}.`,
            read: false,
            created_at: data.reported_at || data.reportedAt,
            created_ms: isLiveNew ? Math.max(createdMs, Date.now() - 1000) : createdMs,
            broadcast_id: data.broadcast_id,
            route_path: data.broadcast_id ? `/signal/${data.broadcast_id}` : undefined,
            source: 'activity',
          };

          items.push(item);
          if (initialized && isLiveNew && !newestLive) {
            newestLive = item;
          }
        });

        initialized = true;
        setVibeItems(items);
        if (newestLive) triggerToast(newestLive);
      },
      (err) => console.warn('Vibe notification listener warning:', err)
    );

    return () => unsubscribe();
  }, [triggerToast]);

  // 4. Real-time Broadcast / Live Signal listener
  useEffect(() => {
    const { watermarkMs, isFirstSession } = initialSessionRef.current!;
    let initialized = false;
    const baselineIds = new Set<string>();
    const liveAddedIds = new Set<string>();

    const q = query(collection(db, 'broadcasts'), orderBy('created_at', 'desc'), limit(12));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let newestLive: AppNotification | null = null;

        if (!initialized) {
          snap.docs.forEach((d) => baselineIds.add(d.id));
        } else {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && !baselineIds.has(change.doc.id)) {
              liveAddedIds.add(change.doc.id);
            }
          });
        }

        const items: AppNotification[] = [];
        snap.docs.forEach((d) => {
          const data = d.data({ serverTimestamps: 'estimate' });
          if (data.active === false) return;
          const createdMs = parseTimestampMs(data.created_at || data.starts_at);
          const isLiveNew = liveAddedIds.has(d.id);
          const isRecentSinceLastVisit = !isFirstSession && createdMs > watermarkMs;

          if (!isLiveNew && !isRecentSinceLastVisit) return;

          const key = `broadcast:${d.id}`;
          const signalTitle = (data.title || 'Community Signal').trim();
          const detail =
            data.deal_description ||
            data.description ||
            data.venue ||
            data.address ||
            'Tap to check out what is happening nearby.';

          const item: AppNotification = {
            id: d.id,
            key,
            type: 'broadcast',
            title: `New live signal: ${signalTitle}`,
            body: String(detail),
            read: false,
            created_at: data.created_at || data.starts_at,
            created_ms: isLiveNew ? Math.max(createdMs, Date.now() - 1000) : createdMs,
            broadcast_id: d.id,
            node_id: data.node_id || data.nodeId,
            route_path: `/signal/${d.id}`,
            source: 'activity',
          };

          items.push(item);
          if (initialized && isLiveNew && !newestLive) {
            newestLive = item;
          }
        });

        initialized = true;
        setBroadcastItems(items);
        if (newestLive) triggerToast(newestLive);
      },
      (err) => console.warn('Broadcast notification listener warning:', err)
    );

    return () => unsubscribe();
  }, [triggerToast]);

  // 5. Admin Pending Spot Proposals listener (single-field query, no composite index needed)
  useEffect(() => {
    if (!uid || !isAdmin) {
      setProposalItems([]);
      return;
    }

    let initialized = false;
    const seenIds = new Set<string>();

    const q = query(collection(db, 'node_proposals'), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        let newestLive: AppNotification | null = null;

        if (initialized) {
          snap.docChanges().forEach((change) => {
            if (change.type === 'added' && !seenIds.has(change.doc.id)) {
              const raw = change.doc.data({ serverTimestamps: 'estimate' });
              const key = `proposal:${change.doc.id}`;
              if (!clearedIdsRef.current.has(key)) {
                newestLive = {
                  id: change.doc.id,
                  key,
                  type: 'proposal_pending',
                  title: `Spot suggestion: ${raw.name || 'New Spot'}`,
                  body: `${raw.reason || 'Awaiting admin review'}${raw.address ? ` · ${raw.address}` : ''}`,
                  read: false,
                  created_at: raw.created_at,
                  created_ms: parseTimestampMs(raw.created_at),
                  proposal_id: change.doc.id,
                  route_path: '/dashboard?tab=proposals',
                  source: 'activity',
                };
              }
            }
          });
        }

        const items: AppNotification[] = [];
        snap.docs.forEach((d) => {
          seenIds.add(d.id);
          const raw = d.data({ serverTimestamps: 'estimate' });
          const createdMs = parseTimestampMs(raw.created_at);
          items.push({
            id: d.id,
            key: `proposal:${d.id}`,
            type: 'proposal_pending',
            title: `Spot suggestion: ${raw.name || 'New Spot'}`,
            body: `${raw.reason || 'Awaiting admin review'}${raw.address ? ` · ${raw.address}` : ''}`,
            read: false,
            created_at: raw.created_at,
            created_ms: createdMs,
            proposal_id: d.id,
            route_path: '/dashboard?tab=proposals',
            source: 'activity',
          });
        });

        initialized = true;
        setProposalItems(items);
        if (newestLive) triggerToast(newestLive);
      },
      () => {
        // Silently ignore if auth token is not admin-verified in Firestore rules
        setProposalItems([]);
      }
    );

    return () => unsubscribe();
  }, [uid, isAdmin, triggerToast]);

  // 6. Local immediate activity confirmation event listener
  useEffect(() => {
    const handleLocalActivity = (event: Event) => {
      const custom = event as CustomEvent<Partial<AppNotification>>;
      const detail = custom.detail;
      if (!detail || !detail.title) return;
      const now = Date.now();
      const key =
        detail.key || `local:${now}-${Math.random().toString(36).slice(2, 8)}`;
      const item: AppNotification = {
        id: detail.id || key,
        key,
        type: detail.type || 'proposal_submitted',
        subtype: detail.subtype,
        title: detail.title,
        body: detail.body || '',
        read: false,
        created_at: now,
        created_ms: now,
        node_id: detail.node_id,
        proposal_id: detail.proposal_id,
        broadcast_id: detail.broadcast_id,
        route_path: detail.route_path,
        source: 'local',
      };
      setLocalItems((prev) => [item, ...prev]);
      triggerToast(item);
    };

    window.addEventListener('uh-activity-notification', handleLocalActivity);
    return () => window.removeEventListener('uh-activity-notification', handleLocalActivity);
  }, [triggerToast]);

  // Enrich dynamic titles/locations when nodes or broadcasts load after initial snapshot
  const visibleNotifications = useMemo(() => {
    const combined = [
      ...localItems,
      ...inboxItems,
      ...proposalItems,
      ...lostFoundItems.map((item) => {
        if (item.node_id && nodeNameMap.has(item.node_id) && item.body.endsWith(' · Community Hub')) {
          const prefix = item.body.slice(0, -' · Community Hub'.length);
          return {
            ...item,
            body: `${prefix} · ${nodeNameMap.get(item.node_id)}`,
          };
        }
        return item;
      }),
      ...vibeItems.map((item) => {
        if (item.broadcast_id && broadcastTitleMap.has(item.broadcast_id)) {
          const title = broadcastTitleMap.get(item.broadcast_id)!;
          const vibeStr = item.subtype || 'buzzing';
          return {
            ...item,
            body: `"${title}" was just rated ${vibeStr}.`,
          };
        }
        return item;
      }),
      ...broadcastItems,
    ];

    const deduped = new Map<string, AppNotification>();
    combined.forEach((item) => {
      const key = item.key || `${item.source || 'item'}:${item.id}`;
      if (clearedIds.has(key)) return;
      if (!deduped.has(key)) {
        deduped.set(key, { ...item, key });
      }
    });

    return Array.from(deduped.values()).sort(
      (a, b) => (b.created_ms ?? parseTimestampMs(b.created_at)) - (a.created_ms ?? parseTimestampMs(a.created_at))
    );
  }, [
    localItems,
    inboxItems,
    proposalItems,
    lostFoundItems,
    vibeItems,
    broadcastItems,
    nodeNameMap,
    broadcastTitleMap,
    clearedIds,
  ]);

  // Track every notification shown while the drawer is open so closing clears viewed items
  useEffect(() => {
    if (!isOpen) return;
    visibleNotifications.forEach((item) => {
      if (item.key) {
        viewedKeysRef.current.add(item.key);
      }
    });
  }, [isOpen, visibleNotifications]);

  const clearNotifications = useCallback(
    (itemsToClear: AppNotification[]) => {
      if (itemsToClear.length === 0) return;

      const keysToClear = itemsToClear
        .map((item) => item.key || (item.id ? `${item.source || 'item'}:${item.id}` : ''))
        .filter(Boolean);

      if (keysToClear.length > 0) {
        setClearedIds((prev) => {
          const next = new Set(prev);
          keysToClear.forEach((k) => next.add(k));
          saveClearedIds(next);
          return next;
        });
      }

      const now = Date.now();
      try {
        localStorage.setItem(WATERMARK_STORAGE_KEY, String(now));
        localStorage.setItem('last_visit_timestamp', String(now));
      } catch {
        // Ignore storage write issues
      }

      const keySet = new Set(keysToClear);
      setLocalItems((prev) => prev.filter((item) => !item.key || !keySet.has(item.key)));
      setLiveToast((current) => (current?.key && keySet.has(current.key) ? null : current));

      if (uid) {
        itemsToClear.forEach((item) => {
          if (item.source === 'inbox' && item.id) {
            const notifRef = doc(db, 'users', uid, 'notifications', item.id);
            deleteDoc(notifRef).catch(() => {
              updateDoc(notifRef, { read: true }).catch(() => {});
            });
          }
        });
      }
    },
    [uid]
  );

  // Closing the sheet automatically clears all notifications that were viewed while open
  const handleCloseSheet = useCallback(() => {
    const viewedKeys = viewedKeysRef.current;
    if (viewedKeys.size > 0) {
      const viewedItems = visibleNotifications.filter(
        (item) => item.key && viewedKeys.has(item.key)
      );
      clearNotifications(viewedItems);
      viewedKeysRef.current = new Set();
    }
    setIsOpen(false);
  }, [visibleNotifications, clearNotifications]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCloseSheet();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, handleCloseSheet]);

  const handleOpenSheet = () => {
    setLiveToast(null);
    setIsOpen(true);
  };

  const navigateForNotification = (notification: AppNotification) => {
    if (notification.type === 'proposal_approved' && notification.node_id && onOpenNode) {
      onOpenNode(notification.node_id);
      return;
    }
    if (notification.route_path && onNavigate) {
      onNavigate(notification.route_path);
      return;
    }
    if (notification.node_id && onOpenNode) {
      onOpenNode(notification.node_id);
    }
  };

  const handleTapNotification = (notification: AppNotification) => {
    // Clear all currently viewed notifications (including the tapped one) since the drawer was viewed
    const viewedKeys = viewedKeysRef.current;
    const itemsToClear =
      viewedKeys.size > 0
        ? visibleNotifications.filter(
            (item) => item.key === notification.key || (item.key && viewedKeys.has(item.key))
          )
        : [notification];

    clearNotifications(itemsToClear);
    viewedKeysRef.current = new Set();
    setIsOpen(false);
    navigateForNotification(notification);
  };

  const handleTapToast = (notification: AppNotification) => {
    clearNotifications([notification]);
    setLiveToast(null);
    navigateForNotification(notification);
  };

  const unreadCount = visibleNotifications.length;

  return (
    <>
      {/* Live activity arrival toast when drawer is closed */}
      {liveToast && !isOpen && (() => {
        const meta = getNotificationMeta(liveToast);
        const ToastIcon = meta.Icon;
        return (
          <div className="fixed top-4 left-4 right-16 max-w-md mx-auto z-[115] animate-in slide-in-from-top-2 fade-in duration-200">
            <div className="bg-[#18181B]/95 backdrop-blur-md border border-[#F2C94C]/40 rounded-2xl p-3.5 shadow-2xl flex items-start gap-3">
              <button
                type="button"
                onClick={() => handleTapToast(liveToast)}
                className="flex items-start gap-3 flex-1 min-w-0 text-left"
              >
                <div
                  className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${meta.iconClass}`}
                >
                  <ToastIcon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${meta.pillClass}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-[#8A928B]">just now</span>
                  </div>
                  <p className="text-[13px] font-bold text-white leading-snug break-words">
                    {liveToast.title}
                  </p>
                  {liveToast.body && (
                    <p className="text-[12px] text-[#B4B6BE] leading-snug mt-0.5 line-clamp-2 break-words">
                      {liveToast.body}
                    </p>
                  )}
                </div>
              </button>
              <button
                type="button"
                aria-label="Hide alert preview"
                onClick={() => setLiveToast(null)}
                className="p-1.5 rounded-full text-[#8A928B] hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        );
      })()}

      {/* Persistent top-right Notification Bell */}
      <button
        type="button"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} new)` : 'Notifications'}
        onClick={handleOpenSheet}
        className="fixed top-16 right-4 z-30 w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
        style={{ top: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#F2C94C] text-black text-[10px] font-bold flex items-center justify-center shadow">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Sheet */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] animate-in fade-in duration-200"
            onClick={handleCloseSheet}
          />
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#1A1A1A] border-t border-white/10 rounded-t-3xl z-[130] animate-in slide-in-from-bottom duration-300 pb-24 max-h-[75vh] flex flex-col">
            <div className="p-6 pb-3 flex justify-between items-start gap-3 border-b border-white/5">
              <div>
                <h2 className="text-xl font-bold text-white">Notifications</h2>
                <p className="text-[11px] text-[#8A928B] mt-0.5">
                  {unreadCount > 0
                    ? 'Viewed alerts clear automatically when you close this panel.'
                    : 'Live alerts appear here as activity happens.'}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearNotifications(visibleNotifications);
                      viewedKeysRef.current = new Set();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-[#F2C94C] uppercase tracking-wide flex items-center gap-1 transition-colors"
                  >
                    <Trash2 size={12} />
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  aria-label="Close notifications"
                  onClick={handleCloseSheet}
                  className="p-2 bg-white/5 rounded-full text-[#8A928B] hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              {visibleNotifications.length === 0 ? (
                <div className="flex flex-col items-center text-center py-10 text-[#8A928B]">
                  <Bell size={28} className="mb-3 opacity-40" />
                  <p className="text-sm font-medium text-white/80">All caught up</p>
                  <p className="text-xs text-[#8A928B] mt-1 max-w-xs">
                    New spot approvals, Lost &amp; Found reports, crowd vibe checks, and live signals will show up here in real time.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {visibleNotifications.map((notification) => {
                    const meta = getNotificationMeta(notification);
                    const ItemIcon = meta.Icon;
                    const isNavigable = Boolean(notification.node_id || notification.route_path);

                    return (
                      <div
                        key={notification.key || notification.id}
                        className="rounded-2xl border bg-[#F2C94C]/[0.07] border-[#F2C94C]/25 text-white p-4 transition-colors hover:bg-[#F2C94C]/[0.11]"
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            disabled={!isNavigable}
                            onClick={() => handleTapNotification(notification)}
                            className={`flex items-start gap-3 flex-1 min-w-0 text-left ${
                              isNavigable ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <div
                              className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${meta.iconClass}`}
                            >
                              <ItemIcon size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2 mb-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider border ${meta.pillClass}`}
                                >
                                  {meta.label}
                                </span>
                                <span className="text-[11px] text-[#8A928B]">
                                  {timeAgo(notification.created_ms ?? notification.created_at)}
                                </span>
                              </div>
                              <div className="font-bold text-[14px] leading-snug text-white break-words">
                                {notification.title}
                              </div>
                              {notification.body && (
                                <p className="text-[13px] mt-1 leading-relaxed text-[#C2C4CC] break-words">
                                  {notification.body}
                                </p>
                              )}
                              {isNavigable && meta.cta && (
                                <span className="inline-block text-[11px] font-bold text-[#F2C94C] mt-2">
                                  {meta.cta}
                                </span>
                              )}
                            </div>
                          </button>

                          <button
                            type="button"
                            aria-label="Clear notification"
                            onClick={() => clearNotifications([notification])}
                            className="p-1.5 rounded-lg text-[#8A928B] hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            title="Clear notification"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
