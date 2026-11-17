import React, { useEffect, useState } from 'react';
import { Check, Clock, ExternalLink, Flag, Loader2, MapPin } from 'lucide-react';
import { Broadcast, Node } from '../types';
import {
  applyWalkLivePatch,
  cancelWalkGroupApi,
  clearWalkMembership,
  formatHubDisplayName,
  getWalkAvailabilityState,
  getWalkDeviceId,
  getWalkJoinedCount,
  getWalkMembership,
  getWalkScheduleLabel,
  getWalkSpotsRemaining,
  leaveWalkGroupApi,
  reportWalkGroupApi,
  resolveWalkHub,
  setWalkLivePatch,
  useUidHash,
  useWalkSyncVersion,
} from '../utils/walkUtils';

interface WalkCardProps {
  walk: Broadcast;
  nodes?: Node[];
  currentNode?: Node | null;
  user?: any;
  isAdmin?: boolean;
  layout?: 'carousel' | 'stack';
  distanceMiles?: number | null;
  onJoinClick: (walk: Broadcast) => void;
  onSelectDetails?: (walk: Broadcast) => void;
}

export const WalkCard: React.FC<WalkCardProps> = ({
  walk: rawWalk,
  nodes = [],
  currentNode = null,
  user = null,
  isAdmin = false,
  layout = 'stack',
  distanceMiles = null,
  onJoinClick,
  onSelectDetails,
}) => {
  // Re-render when local membership or live walk patches change across surfaces
  useWalkSyncVersion();

  const [nowMs, setNowMs] = useState(() => Date.now());
  const [leaving, setLeaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reportSent, setReportSent] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const uidHash = useUidHash(user && !user.isAnonymous ? user.uid : null);
  const walk = applyWalkLivePatch(rawWalk);
  if (walk.active === false || walk.cancelled_at) {
    return null;
  }

  const isHost = Boolean(uidHash && walk.host_uid_hash && uidHash === walk.host_uid_hash);
  const canCancel = isHost || Boolean(isAdmin);

  const membership = getWalkMembership(walk.id);
  const isCommunity = walk.walk_kind === 'community';
  const isPaid = (walk.price ?? 0) > 0;
  const isExternalPartnerWalk = !isCommunity && walk.booking_type === 'partner' && Boolean(walk.booking_url);

  const hub = resolveWalkHub(walk, nodes, currentNode);
  const hubName = hub
    ? formatHubDisplayName(hub.name, hub.id)
    : formatHubDisplayName(walk.venue || walk.address, 'Local Hub');
  const meetingPoint = walk.meeting_point || hub?.address || walk.address || hubName;

  const availability = getWalkAvailabilityState(walk, nowMs);
  const spotsRemaining = getWalkSpotsRemaining(walk);
  const joinedCount = getWalkJoinedCount(walk);
  const scheduleLabel = getWalkScheduleLabel(walk, nowMs);

  const memberNames = Array.isArray(walk.member_preview)
    ? walk.member_preview.filter((n): n is string => typeof n === 'string' && n.trim().length > 0).slice(0, 5)
    : [];

  const stateColorClass =
    availability === 'OPEN'
      ? 'text-uh-teal'
      : availability === 'ALMOST FULL'
        ? 'text-uh-magenta'
        : availability === 'FULL'
          ? 'text-[#A3A3AA]'
          : 'text-[#71717A]';

  const kickerText = isCommunity
    ? `COMMUNITY WALK · hosted by ${walk.host_name || 'Neighbor'}`
    : `GUIDED BY ${(walk.guide_name || walk.partner_name || 'Urban Hikers').toUpperCase()}`;

  const handleLeave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!membership || leaving) return;
    setLeaving(true);
    setActionError(null);
    try {
      const res = await leaveWalkGroupApi(walk.id, {
        device_id: getWalkDeviceId(),
        member_token: membership.memberToken,
      });
      clearWalkMembership(walk.id);
      setWalkLivePatch(walk.id, {
        joined_count: res.joined_count,
        spots_remaining: res.spots_remaining,
        member_preview: res.member_preview,
      });
    } catch (err: any) {
      if (err?.code === 'MEMBERSHIP_NOT_FOUND') {
        clearWalkMembership(walk.id);
      } else {
        setActionError(err?.message || 'Could not leave walk right now.');
      }
    } finally {
      setLeaving(false);
    }
  };

  const handleCancelWalk = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || user.isAnonymous || cancelling) return;
    setCancelling(true);
    setActionError(null);
    try {
      const token = await user.getIdToken();
      await cancelWalkGroupApi(walk.id, token);
      clearWalkMembership(walk.id);
      setWalkLivePatch(walk.id, { active: false });
      setConfirmCancel(false);
    } catch (err: any) {
      setActionError(err?.message || 'Could not cancel walk.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!reportReason.trim() || reporting) return;
    setReporting(true);
    setActionError(null);
    try {
      await reportWalkGroupApi(walk.id, reportReason.trim());
      setReportSent(true);
      setShowReport(false);
      setReportReason('');
    } catch (err: any) {
      setActionError(err?.message || 'Could not send report.');
    } finally {
      setReporting(false);
    }
  };

  const containerWidth =
    layout === 'carousel'
      ? 'w-[clamp(280px,82vw,340px)] shrink-0 snap-start'
      : 'w-full';

  return (
    <div
      onClick={() => onSelectDetails?.(walk)}
      className={`${containerWidth} bg-[#161618] border border-[#26262A] hover:border-white/20 rounded-2xl p-4 flex flex-col justify-between gap-3 text-white transition-colors ${
        onSelectDetails ? 'cursor-pointer' : ''
      }`}
    >
      {/* Top Row: Label + State Badge */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[11px] font-mono font-bold tracking-wider text-[#A3A3AA] leading-snug">
            {kickerText}
          </span>
          <span className={`text-[11px] font-mono font-bold tracking-wider shrink-0 whitespace-nowrap ${stateColorClass}`}>
            {availability}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-white leading-snug">
          {walk.title}
        </h3>

        {/* Hub Anchor + Meeting Point */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
            <MapPin size={13} className="text-uh-yellow shrink-0" />
            <span className="truncate">
              {distanceMiles !== null && distanceMiles !== undefined
                ? `${hubName} · ${distanceMiles.toFixed(1)} mi`
                : `Starts at ${hubName}`}
            </span>
          </div>
          {distanceMiles !== null && distanceMiles !== undefined && (
            <p className="text-xs text-[#A3A3AA] pl-5 truncate">
              Starts at {hubName} · {meetingPoint}
            </p>
          )}
          {(distanceMiles === null || distanceMiles === undefined) && meetingPoint && (
            <p className="text-xs text-[#A3A3AA] pl-5 truncate">
              {meetingPoint}
            </p>
          )}
        </div>

        {/* Optional Note */}
        {walk.note && (
          <p className="text-xs text-[#D4D4D8] leading-relaxed line-clamp-2 pt-0.5">
            {walk.note}
          </p>
        )}
      </div>

      {/* Schedule & Roster */}
      <div className="pt-2.5 border-t border-[#26262A] space-y-2.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-uh-yellow tabular-nums">
            <Clock size={13} className="shrink-0" />
            <span>{scheduleLabel}</span>
          </span>

          <span className="text-xs font-mono text-[#D4D4D8] tabular-nums whitespace-nowrap">
            {spotsRemaining !== null
              ? `${joinedCount} walking · ${spotsRemaining} left`
              : `${joinedCount} walking`}
          </span>
        </div>

        {/* Up to 5 member initial circles */}
        {memberNames.length > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center -space-x-1.5">
              {memberNames.map((name, index) => (
                <div
                  key={`${name}-${index}`}
                  title={name}
                  className="w-6 h-6 rounded-full bg-[#26262A] border border-[#161618] text-[10px] font-bold text-white flex items-center justify-center uppercase select-none"
                >
                  {name.trim().charAt(0)}
                </div>
              ))}
            </div>
            <span className="text-[11px] text-[#A3A3AA] truncate">
              {memberNames.join(', ')}
            </span>
          </div>
        )}

        {actionError && (
          <p className="text-xs text-[#FDA4AF]" onClick={(e) => e.stopPropagation()}>
            {actionError}
          </p>
        )}

        {/* Primary Action */}
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          {isPaid ? (
            <button
              type="button"
              onClick={() => onSelectDetails?.(walk)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-uh-yellow text-uh-black font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity cursor-pointer whitespace-nowrap"
            >
              <span>Book walk · ${walk.price}</span>
            </button>
          ) : isExternalPartnerWalk ? (
            <a
              href={walk.booking_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-uh-yellow text-uh-black font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap"
            >
              <span>Book now</span>
              <ExternalLink size={13} />
            </a>
          ) : membership ? (
            <div className="min-h-[44px] px-3.5 py-2 rounded-xl bg-uh-teal/15 border border-uh-teal/35 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-uh-teal whitespace-nowrap">
                <Check size={15} strokeWidth={2.5} />
                <span>
                  You&apos;re in{membership.spots > 1 ? ` (${membership.spots})` : ''}
                </span>
              </span>
              {!isHost && (
                <button
                  type="button"
                  onClick={handleLeave}
                  disabled={leaving}
                  className="min-h-[36px] px-2.5 text-xs font-semibold text-[#E4E4E7] hover:text-white underline cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  {leaving ? 'Leaving...' : 'Leave'}
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              disabled={availability === 'FULL' || availability === 'DEPARTED'}
              onClick={() => onJoinClick(walk)}
              className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-uh-yellow text-uh-black font-bold text-xs flex items-center justify-center gap-1.5 hover:opacity-95 disabled:bg-[#26262A] disabled:text-[#71717A] disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Join this walk</span>
            </button>
          )}
        </div>

        {/* Host/Admin Cancel + Community Report Controls */}
        {(canCancel || isCommunity) && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col gap-2 pt-1"
          >
            <div className="flex items-center justify-between gap-3 text-xs">
              {canCancel ? (
                confirmCancel ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[#FDA4AF] font-medium">Cancel this walk?</span>
                    <button
                      type="button"
                      onClick={handleCancelWalk}
                      disabled={cancelling}
                      className="min-h-[36px] px-2.5 rounded-lg bg-uh-magenta text-white font-semibold cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {cancelling ? 'Cancelling...' : 'Yes, cancel'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      className="min-h-[36px] px-2 text-[#A3A3AA] hover:text-white cursor-pointer whitespace-nowrap"
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="min-h-[36px] text-xs font-semibold text-uh-magenta hover:underline cursor-pointer whitespace-nowrap"
                  >
                    Cancel walk
                  </button>
                )
              ) : (
                <span />
              )}

              {isCommunity && (
                reportSent ? (
                  <span className="text-[11px] text-[#A3A3AA]">Report sent</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowReport((v) => !v)}
                    className="min-h-[36px] inline-flex items-center gap-1 text-[11px] text-[#A3A3AA] hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    <Flag size={11} />
                    <span>Report</span>
                  </button>
                )
              )}
            </div>

            {showReport && !reportSent && (
              <form onSubmit={handleReportSubmit} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  maxLength={200}
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Reason for reporting (max 200 chars)"
                  className="flex-1 min-h-[40px] bg-black/50 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder-[#71717A] focus:outline-none focus:border-uh-yellow"
                />
                <button
                  type="submit"
                  disabled={!reportReason.trim() || reporting}
                  className="min-h-[40px] px-3 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white disabled:opacity-40 cursor-pointer whitespace-nowrap"
                >
                  {reporting ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
