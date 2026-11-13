import React, { useState, useEffect } from 'react';
import { Trophy, Footprints } from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { LeaderboardEntry } from '../types';

interface LeaderboardSectionProps {
  currentUid?: string;
  currentUserEmail?: string | null;
  userTapsCount: number;
  userPlacesCount: number;
  userMilesCount: number;
  accentColor?: string;
}

function maskDisplayName(email?: string | null, uid?: string): string {
  if (email && email.includes('@')) {
    const [namePart] = email.split('@');
    if (namePart.length <= 3) return `${namePart}*`;
    const capitalized = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    return `${capitalized.slice(0, Math.max(3, capitalized.length - 2))}***`;
  }
  if (uid) {
    const clean = uid.replace(/[^a-zA-Z0-9]/g, '');
    const shortCode = clean.slice(-4).toUpperCase();
    return `Explorer #${shortCode || '729'}`;
  }
  return 'Urban Hiker';
}

export const LeaderboardSection: React.FC<LeaderboardSectionProps> = ({
  currentUid,
  currentUserEmail,
  userTapsCount,
  userPlacesCount,
  userMilesCount,
  accentColor = '#FFE01A',
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Sync current user's entry to Firestore if they have real recorded taps and a valid UID
  useEffect(() => {
    if (!currentUid || userTapsCount <= 0) return;

    const userEntry: LeaderboardEntry = {
      uid: currentUid,
      display_name: maskDisplayName(currentUserEmail, currentUid),
      taps_count: userTapsCount,
      places_count: userPlacesCount,
      miles_count: Number(userMilesCount) || 0,
      last_tapped_at: new Date().toISOString(),
    };

    const userDocRef = doc(db, 'leaderboard', currentUid);
    setDoc(userDocRef, userEntry, { merge: true }).catch((err) => {
      console.warn('Leaderboard sync error (non-fatal):', err);
    });
  }, [currentUid, currentUserEmail, userTapsCount, userPlacesCount, userMilesCount]);

  // Listen to real top entries from Firestore ranked by total recorded NFC taps
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'leaderboard'),
        orderBy('taps_count', 'desc'),
        limit(25)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const remoteEntries = snap.docs.map((d) => ({
              uid: d.id,
              ...d.data(),
            })) as LeaderboardEntry[];

            // Filter strictly to entries with at least 1 real recorded tap
            const realOnly = remoteEntries.filter((e) => (e.taps_count || 0) > 0);
            setEntries(realOnly);
          } else {
            setEntries([]);
          }
          setLoading(false);
        },
        (err) => {
          console.warn('Leaderboard real-time listener error:', err);
          setEntries([]);
          setLoading(false);
        }
      );

      return () => unsub();
    } catch {
      setEntries([]);
      setLoading(false);
    }
  }, []);

  // Compute leaderboard with current user's real stats included if user has recorded taps
  const displayList = React.useMemo(() => {
    let list = [...entries];

    if (currentUid && userTapsCount > 0) {
      const idx = list.findIndex((e) => e.uid === currentUid);
      const myEntry: LeaderboardEntry = {
        uid: currentUid,
        display_name: maskDisplayName(currentUserEmail, currentUid),
        taps_count: userTapsCount,
        places_count: userPlacesCount,
        miles_count: userMilesCount,
        is_current_user: true,
      };

      if (idx >= 0) {
        list[idx] = { ...list[idx], ...myEntry };
      } else {
        list.push(myEntry);
      }
    }

    return list
      .filter((e) => (e.taps_count || 0) > 0)
      .sort((a, b) => b.taps_count - a.taps_count);
  }, [entries, currentUid, currentUserEmail, userTapsCount, userPlacesCount, userMilesCount]);

  // Current user's ranking
  const myRank = currentUid && userTapsCount > 0
    ? displayList.findIndex((e) => e.uid === currentUid) + 1
    : 0;

  return (
    <div className="flex flex-col gap-3 px-4 mt-8 pb-10">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#FFE01A]/10 border border-[#FFE01A]/30 flex items-center justify-center text-[#FFE01A]">
            <Trophy size={15} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold tracking-[0.18em] text-[#FFE01A] uppercase block">
              LEADERBOARD
            </span>
            <h3 className="text-[19px] font-black text-white uppercase tracking-tight leading-none mt-0.5">
              Most Taps
            </h3>
          </div>
        </div>

        {displayList.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.05] border border-white/10 text-[10px] font-mono font-bold text-[#A3A3AA] uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] animate-pulse" />
            <span>Live Rankings</span>
          </div>
        )}
      </div>

      <p className="text-xs text-[#8E95A5] leading-relaxed">
        Hikers and urban explorers ranked by total NFC taps recorded at murals, historic landmarks, and partner hubs.
      </p>

      {/* Leaderboard Content */}
      {loading ? (
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-6 text-center text-xs text-[#8E95A5] font-mono">
          Loading rankings…
        </div>
      ) : displayList.length === 0 ? (
        /* Empty State: exactly as requested */
        <div className="bg-[#141417] border border-white/10 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-2.5 shadow-xl">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] border border-white/10 flex items-center justify-center text-[#8E95A5]">
            <Footprints size={22} className="opacity-60" />
          </div>
          <p className="text-sm font-semibold text-white">
            No taps yet. Be the first to explore.
          </p>
        </div>
      ) : (
        /* Real entries table */
        <div className="bg-[#141417] border border-white/10 rounded-2xl divide-y divide-white/[0.06] overflow-hidden mt-1 shadow-xl">
          {displayList.slice(0, 15).map((entry, index) => {
            const rank = index + 1;
            const isMe = entry.uid === currentUid;

            let rankBadge = (
              <span className="font-mono text-xs font-bold text-[#8E95A5] tabular-nums">
                #{rank}
              </span>
            );

            if (rank === 1) {
              rankBadge = (
                <span className="w-6 h-6 rounded-full bg-[#FFE01A] text-black font-black text-xs flex items-center justify-center shadow-md">
                  1
                </span>
              );
            } else if (rank === 2) {
              rankBadge = (
                <span className="w-6 h-6 rounded-full bg-[#E2E8F0] text-black font-black text-xs flex items-center justify-center shadow-md">
                  2
                </span>
              );
            } else if (rank === 3) {
              rankBadge = (
                <span className="w-6 h-6 rounded-full bg-[#CD7F32] text-white font-black text-xs flex items-center justify-center shadow-md">
                  3
                </span>
              );
            }

            return (
              <div
                key={entry.uid || index}
                className={`px-4 py-3.5 flex items-center justify-between gap-3 transition-colors ${
                  isMe
                    ? 'bg-[#FFE01A]/10 border-l-2 border-[#FFE01A]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-6 flex items-center justify-center shrink-0">
                    {rankBadge}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-bold truncate ${
                          isMe ? 'text-[#FFE01A]' : 'text-white'
                        }`}
                      >
                        {entry.display_name}
                      </span>
                      {isMe && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-black uppercase bg-[#FFE01A] text-black tracking-wider">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[#8E95A5] mt-0.5">
                      <span>{entry.places_count} places</span>
                      <span>•</span>
                      <span>{Number(entry.miles_count || 0).toFixed(1)} mi</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 bg-white/[0.04] px-3 py-1.5 rounded-xl border border-white/5">
                  <Footprints size={13} className={isMe ? 'text-[#FFE01A]' : 'text-[#8E95A5]'} />
                  <span className="font-mono text-sm font-black text-white tabular-nums">
                    {entry.taps_count}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#8E95A5] uppercase">
                    TAPS
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Your Ranking Callout Footer (only shown if user has real taps recorded) */}
      {currentUid && userTapsCount > 0 && myRank > 0 && (
        <div className="bg-[#1C1C21] border border-[#FFE01A]/20 rounded-xl p-3 flex items-center justify-between mt-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-[#FFE01A]/20 border border-[#FFE01A]/40 flex items-center justify-center text-[#FFE01A] font-bold text-xs font-mono">
              #{myRank}
            </div>
            <div>
              <span className="text-[11px] font-bold text-white block">
                You are ranked #{myRank} in the city
              </span>
              <span className="text-[10px] text-[#8E95A5]">
                {userTapsCount} total taps · {userPlacesCount} locations visited
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className="text-[10px] font-mono font-bold text-[#FFE01A] uppercase tracking-wider block">
              {myRank === 1 ? 'LEAD EXPLORER' : 'KEEP TAPPING'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
