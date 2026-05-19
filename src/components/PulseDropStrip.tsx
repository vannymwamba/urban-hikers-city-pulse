import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  collection, doc, getDoc, setDoc,
  updateDoc, arrayUnion, Timestamp, increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { Broadcast } from '../types';

// ─── Rarity config ────────────────────────────────────────────────────────────

export type RarityTier = 'common' | 'rare' | 'ultra';

export interface RarityConfig {
  tier:    RarityTier;
  label:   string;
  color:   string;  // text + dot
  bg:      string;  // badge background
  border:  string;  // badge border
  pips:    number;  // lit pips out of 6
}

export const RARITY_MAP: Record<RarityTier, RarityConfig> = {
  common: {
    tier:   'common',
    label:  'COMMON',
    color:  '#639922',
    bg:     '#0a1400',
    border: '#3B6D11',
    pips:   2,
  },
  rare: {
    tier:   'rare',
    label:  'RARE',
    color:  '#BA7517',
    bg:     '#1a0e00',
    border: '#BA7517',
    pips:   4,
  },
  ultra: {
    tier:   'ultra',
    label:  'ULTRA RARE',
    color:  '#D4537E',
    bg:     '#1a0010',
    border: '#D4537E',
    pips:   6,
  },
};

/** Derive rarity tier from rarity_weight (1–10, set during AI enrichment) */
export function rarityFromWeight(weight: number | undefined): RarityTier {
  if (!weight || weight >= 7) return 'common';
  if (weight >= 4)             return 'rare';
  return 'ultra';
}

/** Card-level rarity badge — drop into BroadcastCard.tsx top-right corner */
export const RarityBadge: React.FC<{ weight?: number; className?: string }> = ({
  weight,
  className = '',
}) => {
  if (!weight) return null;
  const cfg = RARITY_MAP[rarityFromWeight(weight)];
  return (
    <div
      className={className}
      style={{
        display:       'inline-flex',
        alignItems:    'center',
        gap:           4,
        padding:       '3px 9px',
        borderRadius:  99,
        border:        `0.5px solid ${cfg.border}`,
        background:    cfg.bg,
        fontSize:      9,
        fontWeight:    700,
        color:         cfg.color,
        letterSpacing: '0.1em',
        fontFamily:    "'Space Mono', monospace",
        textTransform: 'uppercase',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.tier === 'ultra' ? 'ULTRA' : cfg.label}
    </div>
  );
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_DROPS_PER_DAY = 7;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function weightedRandom(broadcasts: Broadcast[]): Broadcast | null {
  const eligible = broadcasts.filter(
    b => b.drop_eligible !== false && b.rarity_weight !== undefined
  );
  if (!eligible.length) return broadcasts[Math.floor(Math.random() * broadcasts.length)] ?? null;

  // Lower rarity_weight = rarer = less probable in pool
  // Pull probability: common (7–10) = 7 tickets, rare (4–6) = 3, ultra (1–3) = 1
  const tickets: Broadcast[] = [];
  for (const b of eligible) {
    const w = b.rarity_weight ?? 8;
    const count = w >= 7 ? 7 : w >= 4 ? 3 : 1;
    for (let i = 0; i < count; i++) tickets.push(b);
  }

  return tickets[Math.floor(Math.random() * tickets.length)];
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PulseDropStripProps {
  userId:        string | null;
  nodeId:        string | null;
  broadcasts:    Broadcast[];
  onRevealSaved: (broadcast: Broadcast) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const PulseDropStrip: React.FC<PulseDropStripProps> = ({
  userId,
  nodeId,
  broadcasts,
  onRevealSaved,
}) => {
  const [dropsUsed,   setDropsUsed]   = useState(0);
  const [streak,      setStreak]      = useState(0);
  const [revealed,    setRevealed]    = useState<Broadcast | null>(null);
  const [shaking,     setShaking]     = useState(false);
  const [loading,     setLoading]     = useState(true);
  const [justSaved,   setJustSaved]   = useState(false);

  const dropsLeft = MAX_DROPS_PER_DAY - dropsUsed;
  const dropDocRef = userId
    ? doc(db, 'users', userId, 'pulse_drops', todayKey())
    : null;

  // ── Load today's drop state ─────────────────────────────────────────────
  useEffect(() => {
    if (!dropDocRef) { setLoading(false); return; }
    getDoc(dropDocRef).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setDropsUsed(data.used ?? 0);
        setStreak(data.streak ?? 0);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [userId]);

  // ── Trigger a drop ──────────────────────────────────────────────────────
  const handleDrop = useCallback(async () => {
    if (dropsLeft <= 0 || shaking || revealed) return;

    setShaking(true);
    setTimeout(() => setShaking(false), 520);

    const chosen = weightedRandom(broadcasts);
    if (!chosen) return;

    // Persist to Firestore
    if (dropDocRef) {
      try {
        const snap = await getDoc(dropDocRef);
        if (snap.exists()) {
          await updateDoc(dropDocRef, { used: increment(1) });
        } else {
          await setDoc(dropDocRef, {
            used:      1,
            saved:     [],
            streak:    streak + 1,
            node_id:   nodeId,
            created_at: Timestamp.now(),
          });
          setStreak(s => s + 1);
        }
      } catch (err) {
        console.warn('[PulseDropStrip] Firestore write failed:', err);
      }
    }

    setDropsUsed(u => u + 1);
    setTimeout(() => setRevealed(chosen), 300);
  }, [dropsLeft, shaking, revealed, broadcasts, dropDocRef, nodeId, streak]);

  // ── Save reveal to wallet ───────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!revealed) return;
    if (dropDocRef) {
      try {
        await updateDoc(dropDocRef, { saved: arrayUnion(revealed.id) });
      } catch (err) {
        console.warn('[PulseDropStrip] Save failed:', err);
      }
    }
    setJustSaved(true);
    onRevealSaved(revealed);
    setTimeout(() => {
      setRevealed(null);
      setJustSaved(false);
    }, 800);
  }, [revealed, dropDocRef, onRevealSaved]);

  const handleSkip = useCallback(() => setRevealed(null), []);

  if (loading) return null;

  const revealedRarity = revealed
    ? RARITY_MAP[rarityFromWeight(revealed.rarity_weight)]
    : null;

  return (
    <>
      {/* ── STRIP ─────────────────────────────────────────────────────── */}
      <div style={{
        background:    '#0f0f0f',
        borderTop:     '0.5px solid #1a1a1a',
        borderBottom:  '0.5px solid #1a1a1a',
        padding:       '12px 16px',
        display:       'flex',
        alignItems:    'center',
        gap:           12,
      }}>

        {/* Capsule button */}
        <motion.button
          onClick={handleDrop}
          disabled={dropsLeft <= 0 || !!revealed}
          animate={shaking ? {
            rotate:    [0, -8, 8, -5, 5, 0],
            scale:     [1, 1.06, 1.06, 1.03, 1.03, 1],
            transition: { duration: 0.5 }
          } : {}}
          style={{
            width:           44,
            height:          44,
            borderRadius:    12,
            background:      dropsLeft > 0 ? '#FFE01A' : '#222',
            border:          'none',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            cursor:          dropsLeft > 0 && !revealed ? 'pointer' : 'not-allowed',
            flexShrink:      0,
          }}
          aria-label="Open a Pulse Drop"
        >
          {/* NFC ring icon */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
            stroke={dropsLeft > 0 ? '#0a0a0a' : '#444'}
            strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" fill={dropsLeft > 0 ? '#0a0a0a' : '#444'} stroke="none" />
            <path d="M6.3 17.7a8 8 0 0 1 0-11.3M9.2 14.8a4 4 0 0 1 0-5.6M14.8 9.2a4 4 0 0 1 0 5.6M17.7 6.3a8 8 0 0 1 0 11.3" />
          </svg>
        </motion.button>

        {/* Info column */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize:      9,
            color:         '#FFE01A',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom:  3,
            fontFamily:    "'Space Mono', monospace",
          }}>
            PULSE DROP
          </div>
          <div style={{
            fontSize:      10,
            color:         '#888',
            letterSpacing: '0.04em',
            fontFamily:    "'Space Mono', monospace",
            marginBottom:  6,
          }}>
            {dropsLeft > 0
              ? revealed
                ? 'Signal revealed — save or skip'
                : `${dropsLeft} drop${dropsLeft !== 1 ? 's' : ''} remaining`
              : 'No drops left today — resets at midnight'}
          </div>

          {/* Pip row */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {Array.from({ length: MAX_DROPS_PER_DAY }).map((_, i) => (
              <div key={i} style={{
                width:        6,
                height:       6,
                borderRadius: '50%',
                background:   i < dropsLeft ? '#FFE01A' : '#2a2a2a',
                transition:   'background 0.3s',
              }} />
            ))}
          </div>
        </div>

        {/* Streak pill */}
        {streak > 0 && (
          <div style={{
            background:    '#1a1a0a',
            border:        '0.5px solid #3a3000',
            borderRadius:  99,
            padding:       '3px 10px',
            fontSize:      9,
            color:         '#FFE01A',
            letterSpacing: '0.06em',
            fontFamily:    "'Space Mono', monospace",
            flexShrink:    0,
          }}>
            {streak}D STREAK
          </div>
        )}
      </div>

      {/* ── REVEAL PANEL ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {revealed && revealedRarity && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{   opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              margin:     '0 12px 12px',
              background: '#0d0d0d',
              border:     `0.5px solid ${revealedRarity.border}`,
              borderRadius: 16,
              padding:    14,
            }}>
              {/* Rarity row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: revealedRarity.color, display: 'inline-block'
                }} />
                <span style={{
                  fontSize:      9,
                  color:         revealedRarity.color,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  fontFamily:    "'Space Mono', monospace",
                }}>
                  {revealedRarity.label}
                  {revealedRarity.tier === 'ultra' && ' · ACT NOW'}
                </span>
              </div>

              {/* Card */}
              <div style={{ background: '#111', borderRadius: 12, padding: 12, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                  {/* Icon badge */}
                  <div style={{
                    width:          40,
                    height:         40,
                    borderRadius:   8,
                    background:     revealedRarity.bg,
                    border:         `0.5px solid ${revealedRarity.border}`,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    fontSize:       20,
                    flexShrink:     0,
                  }}>
                    {revealed.type === 'walking_event' ? '🚶' :
                     revealed.type === 'live_event'    ? '🎵' :
                     revealed.type === 'civic_event'   ? '🏛️' :
                     revealed.type === 'flash_deal'    ? '⚡' :
                     revealed.type === 'mural'         ? '🎨' :
                     revealed.type === 'food_truck'    ? '🍜' : '📍'}
                  </div>

                  <div>
                    <div style={{
                      fontSize:      13,
                      fontWeight:    700,
                      color:         '#fff',
                      textTransform: 'uppercase',
                      letterSpacing: '-0.01em',
                      lineHeight:    1.2,
                      marginBottom:  3,
                      fontFamily:    "'Space Mono', monospace",
                    }}>
                      {revealed.title}
                    </div>
                    <div style={{
                      fontSize:      10,
                      color:         '#666',
                      letterSpacing: '0.04em',
                      fontFamily:    "'Space Mono', monospace",
                    }}>
                      {revealed.venue || 'Nearby'}
                    </div>
                  </div>
                </div>

                {/* Distance */}
                <div style={{
                  display:    'flex',
                  alignItems: 'center',
                  gap:        5,
                  fontSize:   10,
                  color:      '#555',
                  fontFamily: "'Space Mono', monospace",
                  marginBottom: 10,
                }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#1D9E75', display: 'inline-block' }} />
                  {'Cincinnati, OH'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button
                    onClick={handleSave}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      flex:          1,
                      background:    justSaved ? '#1D9E75' : '#FFE01A',
                      color:         '#0a0a0a',
                      border:        'none',
                      borderRadius:  8,
                      padding:       '9px 0',
                      fontSize:      10,
                      fontWeight:    700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      cursor:        'pointer',
                      fontFamily:    "'Space Mono', monospace",
                      transition:    'background 0.2s',
                    }}
                  >
                    {justSaved ? 'SAVED ✓' : 'SAVE TO WALLET'}
                  </motion.button>

                  <motion.button
                    onClick={handleSkip}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      flex:          1,
                      background:    'transparent',
                      color:         '#555',
                      border:        '0.5px solid #333',
                      borderRadius:  8,
                      padding:       '9px 0',
                      fontSize:      10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      cursor:        'pointer',
                      fontFamily:    "'Space Mono', monospace",
                    }}
                  >
                    SKIP
                  </motion.button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default PulseDropStrip;
