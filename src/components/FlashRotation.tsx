import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, ArrowRight } from 'lucide-react';

interface FlashSlot {
  id: string;
  campaign_title: string;
  campaign_type?: string;
  cover_url?: string;
  cta_label?: string;
  cta_url?: string;
  location_label?: string;
  distance_label?: string;
  tier?: string;
  is_civic?: boolean;
  slot_priority?: number;
  starts_at?: string;
  expires_at?: string;
}

interface FlashRotationProps {
  nodeId?: string;
  intervalMs?: number;
  maxSlots?: number;
  onCtaTap?: (slot: FlashSlot) => void;
}

export const FlashRotation: React.FC<FlashRotationProps> = ({
  nodeId,
  intervalMs = 5000,
  maxSlots = 5,
  onCtaTap
}) => {
  const [rawSlots, setRawSlots] = useState<FlashSlot[]>([]);
  const [nowIso, setNowIso] = useState(() => new Date().toISOString());
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'flash_rotation'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetched = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as FlashSlot)
        );
        setRawSlots(fetched);
        setNowIso(new Date().toISOString());
      },
      (err) => {
        console.error('[FlashRotation] Error listening to flash_rotation:', err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Re-evaluate start/expiry window periodically so expiring slots drop out automatically
  useEffect(() => {
    if (rawSlots.length === 0) return;
    const tick = setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 30000);
    return () => clearInterval(tick);
  }, [rawSlots.length]);

  const slots = React.useMemo(() => {
    return rawSlots
      .filter((slot) => {
        const startsOk = !slot.starts_at || slot.starts_at <= nowIso;
        const expiresOk = !slot.expires_at || slot.expires_at > nowIso;
        return startsOk && expiresOk;
      })
      .sort((a, b) => (b.slot_priority ?? 0) - (a.slot_priority ?? 0))
      .slice(0, maxSlots);
  }, [rawSlots, nowIso, maxSlots]);

  useEffect(() => {
    if (slots.length <= 1) {
      setActiveIndex(0);
      return;
    }

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slots.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [slots.length, intervalMs]);

  const safeIndex = slots.length > 0 ? activeIndex % slots.length : 0;
  const activeSlot = slots[safeIndex];

  const recordTapImpression = async (slot: FlashSlot) => {
    if (auth.currentUser) {
      try {
        await addDoc(collection(db, 'impressions'), {
          slot_id: slot.id,
          campaign_title: slot.campaign_title,
          node_id: nodeId || 'global',
          type: 'tap',
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error('Error recording tap:', err);
      }
    }

    if (onCtaTap) onCtaTap(slot);
  };

  // Record impression for current active slot when signed in
  useEffect(() => {
    if (!activeSlot || !auth.currentUser) return;

    const recordImpression = async () => {
      try {
        await addDoc(collection(db, 'impressions'), {
          slot_id: activeSlot.id,
          campaign_title: activeSlot.campaign_title,
          node_id: nodeId || 'global',
          type: 'view',
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error('Error recording impression:', err);
      }
    };

    recordImpression();
  }, [activeSlot?.id, nodeId]);

  if (slots.length === 0 || !activeSlot) return null;

  return (
    <div className="relative h-[220px] w-full overflow-hidden rounded-[20px] border border-[#26262A] bg-[#161618] shadow-lg">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlot.id}
          initial={{ opacity: 0, scale: 1.03 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.45, ease: 'circOut' }}
          className="absolute inset-0 bg-[#0B0B0D]"
        >
          {/* Cover Image or Subtle Gradient Fallback */}
          {activeSlot.cover_url ? (
            <img
              src={activeSlot.cover_url}
              alt={activeSlot.campaign_title}
              className="w-full h-full object-cover opacity-65"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#2a2a30] via-[#19191d] to-[#0B0B0D]" />
          )}

          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />

          {/* Content Overlay */}
          <div className={`absolute inset-0 p-5 flex flex-col justify-end z-10 ${slots.length > 1 ? 'pb-7' : 'pb-5'}`}>
            <div className="flex flex-col gap-1.5 mb-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2 py-0.5 bg-[#FFE01A] text-[#0B0B0D] text-[9px] font-black uppercase tracking-widest rounded shadow-sm inline-flex items-center gap-1">
                  <span className="w-1 h-1 bg-[#0B0B0D] rounded-full animate-pulse" />
                  {activeSlot.tier === 'civic' || activeSlot.is_civic ? 'CIVIC SIGNAL' : 'FLASH SPONSOR'}
                </span>
                {activeSlot.location_label && (
                  <div className="flex items-center gap-1 text-white/70 text-[11px] font-semibold">
                    <MapPin size={11} className="shrink-0" />
                    <span className="truncate max-w-[180px]">{activeSlot.location_label}</span>
                    {activeSlot.distance_label && (
                      <>
                        <span className="opacity-50">·</span>
                        <span>{activeSlot.distance_label}</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <h3 className="text-white text-lg font-black uppercase tracking-tight leading-snug line-clamp-2">
                {activeSlot.campaign_title}
              </h3>
            </div>

            {activeSlot.cta_url ? (
              <a
                href={activeSlot.cta_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => recordTapImpression(activeSlot)}
                className="min-h-[44px] flex items-center justify-between bg-[#FFE01A] text-[#0B0B0D] px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-95 transition-all group"
              >
                <span>{activeSlot.cta_label || 'Explore Offer'}</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </a>
            ) : (
              <button
                type="button"
                onClick={() => recordTapImpression(activeSlot)}
                className="min-h-[44px] flex items-center justify-between bg-[#FFE01A] text-[#0B0B0D] px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:opacity-95 transition-all group cursor-pointer"
              >
                <span>{activeSlot.cta_label || 'Featured Partner'}</span>
                <ArrowRight size={15} className="group-hover:translate-x-1 transition-transform" />
              </button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress Bars (Slots Indicators) */}
      {slots.length > 1 && (
        <div className="absolute bottom-2.5 left-5 right-5 flex gap-1.5 z-20 pointer-events-none">
          {slots.map((slot, i) => (
            <div key={slot.id} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              {i === safeIndex && (
                <motion.div
                  key={`${slot.id}-${safeIndex}`}
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: intervalMs / 1000, ease: 'linear' }}
                  className="h-full bg-[#FFE01A]"
                />
              )}
              {i < safeIndex && <div className="w-full h-full bg-white/45" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
