import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, ArrowRight } from 'lucide-react';

interface FlashSlot {
  id: string;
  campaign_title: string;
  campaign_type: string;
  cover_url: string;
  cta_label: string;
  cta_url: string;
  location_label: string;
  distance_label?: string;
  tier: string;
  is_civic: boolean;
  slot_priority: number;
}

interface FlashRotationProps {
  nodeId?: string;
  intervalMs?: number;
  maxSlots?: number;
  onCtaTap?: (slot: FlashSlot) => void;
}

export const FlashRotation: React.FC<FlashRotationProps> = ({
  nodeId,
  intervalMs = 3000,
  maxSlots = 5,
  onCtaTap
}) => {
  const [slots, setSlots] = useState<FlashSlot[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const now = new Date().toISOString();
    const q = query(
      collection(db, 'flash_rotation'),
      where('status', '==', 'active'),
      where('starts_at', '<=', now)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allSlots = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as FlashSlot))
        .filter(slot => {
          // Additional client-side expiry check since Firestore can't do two inequality filters on different fields easily without an index
          const expiresAt = (slot as any).expires_at;
          return !expiresAt || expiresAt > now;
        })
        .sort((a, b) => b.slot_priority - a.slot_priority)
        .slice(0, maxSlots);

      setSlots(allSlots);
    });

    return () => unsubscribe();
  }, [maxSlots]);

  useEffect(() => {
    if (slots.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % slots.length);
    }, intervalMs);

    return () => clearInterval(timer);
  }, [slots.length, intervalMs]);

  const handleTap = async (slot: FlashSlot) => {
    // Record impression tap
    try {
      await addDoc(collection(db, 'impressions'), {
        slot_id: slot.id,
        campaign_title: slot.campaign_title,
        node_id: nodeId || 'global',
        type: 'tap',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error("Error recording tap:", err);
    }

    if (onCtaTap) onCtaTap(slot);
    window.open(slot.cta_url, '_blank', 'noopener,noreferrer');
  };

  // Record impression for current active slot
  useEffect(() => {
    if (slots.length === 0) return;
    const currentSlot = slots[activeIndex];
    
    const recordImpression = async () => {
      try {
        await addDoc(collection(db, 'impressions'), {
          slot_id: currentSlot.id,
          campaign_title: currentSlot.campaign_title,
          node_id: nodeId || 'global',
          type: 'view',
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.error("Error recording impression:", err);
      }
    };

    recordImpression();
  }, [activeIndex, slots, nodeId]);

  if (slots.length === 0) return null;

  const activeSlot = slots[activeIndex];

  return (
    <div className="px-6 relative h-[240px] w-full overflow-hidden rounded-[32px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSlot.id}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.6, ease: "circOut" }}
          className="absolute inset-0 bg-uh-black"
        >
          {/* Cover Image */}
          <img 
            src={activeSlot.cover_url} 
            alt={activeSlot.campaign_title}
            className="w-full h-full object-cover opacity-65"
            referrerPolicy="no-referrer"
          />
          
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

          {/* Content Overlay */}
          <div className="absolute inset-0 p-6 flex flex-col justify-end z-10">
            <div className="flex flex-col gap-1 mb-4">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-uh-yellow text-uh-black text-[9px] font-black uppercase tracking-widest rounded shadow-sm flex items-center gap-1">
                  <div className="w-1 h-1 bg-uh-black rounded-full animate-pulse" />
                  {activeSlot.tier === 'civic' ? 'CIVIC_SIGNAL' : 'SPONSORED'}
                </span>
                <div className="flex items-center gap-1 text-white/50 text-[10px] font-bold">
                  <MapPin size={10} />
                  <span>{activeSlot.location_label}</span>
                  {activeSlot.distance_label && (
                    <>
                      <span className="opacity-50">·</span>
                      <span>{activeSlot.distance_label}</span>
                    </>
                  )}
                </div>
              </div>

              <h3 className="text-white text-xl font-black uppercase tracking-tight leading-tight line-clamp-2">
                {activeSlot.campaign_title}
              </h3>
            </div>

            <button
              onClick={() => handleTap(activeSlot)}
              className="flex items-center justify-between bg-uh-yellow text-uh-black px-4 py-3 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[0.98] transition-transform group"
            >
              <span>{activeSlot.cta_label}</span>
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Progress Bars (Slots Indicators) */}
      {slots.length > 1 && (
        <div className="absolute bottom-4 left-6 right-6 flex gap-1 z-20">
          {slots.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              {i === activeIndex && (
                <motion.div
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: intervalMs / 1000, ease: "linear" }}
                  className="h-full bg-uh-yellow"
                />
              )}
              {i < activeIndex && <div className="w-full h-full bg-white/40" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
