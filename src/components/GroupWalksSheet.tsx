import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Users, X } from 'lucide-react';
import { Broadcast, Node, UserProfile } from '../types';
import { haversineMiles } from '../utils/geo';
import {
  formatHubDisplayName,
  getWalkDepartsMs,
  isWalkVisible,
  resolveWalkHub,
  useWalkSyncVersion,
} from '../utils/walkUtils';
import { WalkCard } from './WalkCard';

interface GroupWalksSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode: Node | null;
  nodes: Node[];
  broadcasts: Broadcast[];
  user: any;
  userProfile: UserProfile | null;
  isAdmin?: boolean;
  onStartWalkClick: () => void;
  onJoinWalkClick: (walk: Broadcast) => void;
  onSelectWalkDetails?: (walk: Broadcast) => void;
}

export const GroupWalksSheet: React.FC<GroupWalksSheetProps> = ({
  isOpen,
  onClose,
  currentNode,
  nodes,
  broadcasts,
  user,
  isAdmin = false,
  onStartWalkClick,
  onJoinWalkClick,
  onSelectWalkDetails,
}) => {
  useWalkSyncVersion();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showAllNearby, setShowAllNearby] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNowMs(Date.now());
    setShowAllNearby(false);
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [isOpen, currentNode?.id]);

  const { hereWalks, nearbyWalks } = useMemo(() => {
    if (!currentNode) {
      return { hereWalks: [] as Broadcast[], nearbyWalks: [] as Array<{ walk: Broadcast; distanceMiles: number }> };
    }

    const visibleWalks = (broadcasts || []).filter((b) => isWalkVisible(b, nowMs));

    const sortSoonest = (a: Broadcast, b: Broadcast) => {
      const aMs = getWalkDepartsMs(a, nowMs) ?? Number.MAX_SAFE_INTEGER;
      const bMs = getWalkDepartsMs(b, nowMs) ?? Number.MAX_SAFE_INTEGER;
      return aMs - bMs;
    };

    const here = visibleWalks
      .filter((b) => (b.node_id || b.nodeId) === currentNode.id)
      .sort(sortSoonest);

    const hasValidCurrentCoords =
      typeof currentNode.latitude === 'number' &&
      typeof currentNode.longitude === 'number' &&
      !Number.isNaN(currentNode.latitude) &&
      !Number.isNaN(currentNode.longitude);

    const nearby: Array<{ walk: Broadcast; distanceMiles: number }> = [];

    if (hasValidCurrentCoords) {
      for (const w of visibleWalks) {
        const wNodeId = w.node_id || w.nodeId;
        if (wNodeId === currentNode.id) continue;

        const hub = resolveWalkHub(w, nodes, null);
        const hubLat = hub?.latitude ?? w.latitude;
        const hubLng = hub?.longitude ?? w.longitude;

        // Skip hubs without valid coordinates
        if (
          typeof hubLat !== 'number' ||
          typeof hubLng !== 'number' ||
          Number.isNaN(hubLat) ||
          Number.isNaN(hubLng)
        ) {
          continue;
        }

        const distMiles = haversineMiles(currentNode.latitude, currentNode.longitude, hubLat, hubLng);
        if (distMiles <= 1.0) {
          nearby.push({ walk: w, distanceMiles: distMiles });
        }
      }

      nearby.sort((a, b) => {
        const aMs = getWalkDepartsMs(a.walk, nowMs) ?? Number.MAX_SAFE_INTEGER;
        const bMs = getWalkDepartsMs(b.walk, nowMs) ?? Number.MAX_SAFE_INTEGER;
        if (aMs !== bMs) return aMs - bMs;
        return a.distanceMiles - b.distanceMiles;
      });
    }

    return { hereWalks: here, nearbyWalks: nearby };
  }, [broadcasts, currentNode, nodes, nowMs]);

  if (!isOpen || !currentNode) return null;

  const hubTitle = formatHubDisplayName(currentNode.name, currentNode.id);
  const displayedNearby = showAllNearby ? nearbyWalks : nearbyWalks.slice(0, 10);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[120]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-walks-sheet-title"
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#0B0B0D] border-t border-[#26262A] rounded-t-3xl z-[130] pb-24 max-h-[88vh] overflow-y-auto text-white shadow-2xl"
      >
        <div className="w-10 h-1.5 bg-white/15 rounded-full mx-auto mt-3" />

        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-uh-yellow">
                {hubTitle}
              </p>
              <h2 id="group-walks-sheet-title" className="text-2xl font-bold text-white mt-0.5">
                Walk together
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close group walks"
              className="min-h-[44px] min-w-[44px] rounded-full bg-white/5 hover:bg-white/10 text-[#A3A3AA] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Primary Top CTA */}
          <button
            type="button"
            onClick={onStartWalkClick}
            className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-uh-yellow text-uh-black font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity cursor-pointer"
          >
            <Plus size={18} strokeWidth={2.5} />
            <span>Start a walk here</span>
          </button>

          {/* Section 1: Walks departing from this hub */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#A3A3AA]">
                Departing from {hubTitle}
              </h3>
              <span className="text-xs font-mono text-white/50 tabular-nums">
                {hereWalks.length}
              </span>
            </div>

            {hereWalks.length === 0 ? (
              <div className="rounded-2xl bg-[#161618] border border-[#26262A] p-6 text-center space-y-2">
                <Users size={22} className="text-[#A3A3AA] mx-auto" />
                <p className="text-sm font-medium text-[#E4E4E7]">
                  No walks here yet. Start the first one.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {hereWalks.map((walk) => (
                  <WalkCard
                    key={walk.id}
                    walk={walk}
                    nodes={nodes}
                    currentNode={currentNode}
                    user={user}
                    isAdmin={isAdmin}
                    layout="stack"
                    onJoinClick={onJoinWalkClick}
                    onSelectDetails={onSelectWalkDetails}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Section 2: Nearby within 1 mile (hidden if empty) */}
          {nearbyWalks.length > 0 && (
            <section className="space-y-3 pt-2 border-t border-[#26262A]">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#A3A3AA]">
                  Nearby · within 1 mile
                </h3>
                <span className="text-xs font-mono text-white/50 tabular-nums">
                  {nearbyWalks.length}
                </span>
              </div>

              <div className="space-y-3">
                {displayedNearby.map(({ walk, distanceMiles }) => (
                  <WalkCard
                    key={walk.id}
                    walk={walk}
                    nodes={nodes}
                    currentNode={currentNode}
                    user={user}
                    isAdmin={isAdmin}
                    layout="stack"
                    distanceMiles={distanceMiles}
                    onJoinClick={onJoinWalkClick}
                    onSelectDetails={onSelectWalkDetails}
                  />
                ))}
              </div>

              {!showAllNearby && nearbyWalks.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllNearby(true)}
                  className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-[#26262A] text-xs font-semibold text-white transition-colors cursor-pointer"
                >
                  Show more ({nearbyWalks.length - 10} more)
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
};
