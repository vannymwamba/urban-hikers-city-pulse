import React, { useEffect, useState } from 'react';
import { Check, Loader2, MapPin, Minus, Navigation, Plus, ShieldCheck, X } from 'lucide-react';
import { Broadcast, Node } from '../types';
import {
  formatHubDisplayName,
  getSavedFirstName,
  getWalkDeviceId,
  getWalkScheduleLabel,
  getWalkSpotsRemaining,
  joinWalkGroupApi,
  resolveWalkHub,
  saveFirstName,
  saveWalkMembership,
  setWalkLivePatch,
  validateClientFirstName,
} from '../utils/walkUtils';

interface WalkJoinSheetProps {
  walk: Broadcast | null;
  nodes?: Node[];
  currentNode?: Node | null;
  isOpen: boolean;
  onClose: () => void;
  onJoined?: (walkId: string) => void;
}

export const WalkJoinSheet: React.FC<WalkJoinSheetProps> = ({
  walk,
  nodes = [],
  currentNode = null,
  isOpen,
  onClose,
  onJoined,
}) => {
  const [firstName, setFirstName] = useState(() => getSavedFirstName());
  const [spots, setSpots] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedSpots, setConfirmedSpots] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && walk) {
      setFirstName((prev) => prev || getSavedFirstName());
      setSpots(1);
      setSubmitting(false);
      setError(null);
      setConfirmedSpots(null);
    }
  }, [isOpen, walk?.id]);

  if (!isOpen || !walk) return null;

  const hub = resolveWalkHub(walk, nodes, currentNode);
  const hubName = hub
    ? formatHubDisplayName(hub.name, hub.id)
    : formatHubDisplayName(walk.venue || walk.address, 'Hub');
  const meetingPoint = walk.meeting_point || hub?.address || walk.address || hubName;
  const remaining = getWalkSpotsRemaining(walk);
  const maxSelectableSpots = remaining !== null ? Math.max(1, Math.min(4, remaining)) : 4;

  const destLat = hub?.latitude ?? walk.latitude ?? walk.coords?.lat;
  const destLng = hub?.longitude ?? walk.longitude ?? walk.coords?.lng;
  const directionsUrl =
    typeof destLat === 'number' && typeof destLng === 'number' && !Number.isNaN(destLat) && !Number.isNaN(destLng)
      ? `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`
      : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(meetingPoint)}&travelmode=walking`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    const validationError = validateClientFirstName(firstName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const cleanName = firstName.trim();
      const deviceId = getWalkDeviceId();
      const clampedSpots = Math.min(maxSelectableSpots, Math.max(1, spots));

      const result = await joinWalkGroupApi(walk.id, {
        first_name: cleanName,
        spots: clampedSpots,
        device_id: deviceId,
      });

      saveFirstName(cleanName);
      saveWalkMembership(walk.id, {
        memberToken: result.member_token,
        spots: result.spots,
        firstName: cleanName,
        joinedAt: Date.now(),
      });
      setWalkLivePatch(walk.id, {
        joined_count: result.joined_count,
        spots_remaining: result.spots_remaining,
        member_preview: result.member_preview,
      });

      setConfirmedSpots(result.spots);
      onJoined?.(walk.id);
    } catch (err: any) {
      setError(err?.message || 'Unable to join this walk right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[3100]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="walk-join-title"
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#161618] border-t border-[#26262A] rounded-t-3xl z-[3110] pb-24 max-h-[85vh] overflow-y-auto text-white shadow-2xl"
      >
        <div className="w-10 h-1.5 bg-white/15 rounded-full mx-auto mt-3" />
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-wider text-uh-yellow">
                Starts at {hubName}
              </p>
              <h2 id="walk-join-title" className="text-xl font-bold text-white leading-snug mt-0.5">
                {confirmedSpots !== null ? "You're in" : walk.title}
              </h2>
              <p className="text-xs text-[#A3A3AA] mt-1">
                {getWalkScheduleLabel(walk)} · {meetingPoint}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close join sheet"
              className="min-h-[44px] min-w-[44px] rounded-full bg-white/5 hover:bg-white/10 text-[#A3A3AA] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {confirmedSpots !== null ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-2xl bg-uh-teal/15 border border-uh-teal/35 p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-uh-teal text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Check size={18} strokeWidth={2.5} />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {confirmedSpots === 1
                      ? `1 spot saved for ${firstName.trim()}`
                      : `${confirmedSpots} spots saved under ${firstName.trim()}`}
                  </p>
                  <p className="text-xs text-[#D4D4D8] leading-relaxed">
                    Meet at {hubName} ({meetingPoint}) · {getWalkScheduleLabel(walk)}.
                  </p>
                </div>
              </div>

              <p className="text-xs text-[#A3A3AA] flex items-center gap-2">
                <ShieldCheck size={15} className="text-uh-teal shrink-0" />
                <span>Meet at the hub, in public. Never share contact details.</span>
              </p>

              <div className="flex flex-col gap-2.5 pt-1">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-uh-yellow text-uh-black font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
                >
                  <Navigation size={16} />
                  <span>Get directions</span>
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="walk-join-first-name" className="block text-xs font-semibold text-[#E4E4E7] mb-1.5">
                  First name
                </label>
                <input
                  id="walk-join-first-name"
                  type="text"
                  maxLength={30}
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g., Maya"
                  className="w-full min-h-[48px] bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-[#71717A] focus:outline-none focus:border-uh-yellow transition-colors"
                />
                <p className="text-xs text-[#A3A3AA] mt-1.5">
                  Your first name is shown to the group.
                </p>
              </div>

              <div className="flex items-center justify-between gap-4 py-2 border-y border-[#26262A]">
                <div>
                  <span className="block text-sm font-semibold text-white">
                    How many in your group?
                  </span>
                  {remaining !== null && (
                    <span className="text-xs text-[#A3A3AA] tabular-nums">
                      {remaining} {remaining === 1 ? 'spot' : 'spots'} left
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSpots((s) => Math.max(1, s - 1))}
                    disabled={spots <= 1}
                    aria-label="Decrease group size"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Minus size={16} />
                  </button>
                  <span className="min-w-[32px] text-center text-base font-bold font-mono tabular-nums text-white">
                    {Math.min(spots, maxSelectableSpots)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSpots((s) => Math.min(maxSelectableSpots, s + 1))}
                    disabled={spots >= maxSelectableSpots}
                    aria-label="Increase group size"
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Plus size={16} />
                  </button>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs text-[#A3A3AA]">
                <MapPin size={15} className="text-uh-teal shrink-0 mt-0.5" />
                <span>Meet at the hub, in public. Never share contact details.</span>
              </div>

              {error && (
                <div className="rounded-xl border border-uh-magenta/40 bg-uh-magenta/10 px-3.5 py-2.5 text-xs text-[#FDA4AF]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !firstName.trim()}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-uh-yellow text-uh-black font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Joining...</span>
                  </>
                ) : (
                  <span>Join this walk</span>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};
