import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Loader2, LogIn, Mail, MapPin, Minus, Plus, ShieldCheck, X } from 'lucide-react';
import { sendEmailVerification } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Node, UserProfile } from '../types';
import {
  START_WALK_DRAFT_KEY,
  createWalkGroupApi,
  formatHubDisplayName,
  getWalkDeviceId,
  saveFirstName,
  saveWalkMembership,
  validateClientFirstName,
  validateClientNote,
} from '../utils/walkUtils';

interface StartWalkDraft {
  nodeId: string;
  dateStr: string;
  timeStr: string;
  capacity: number;
  note: string;
  firstNameInput: string;
}

export function hasPendingStartWalkDraft(): boolean {
  try {
    return Boolean(sessionStorage.getItem(START_WALK_DRAFT_KEY));
  } catch {
    return false;
  }
}

function readStartWalkDraft(): StartWalkDraft | null {
  try {
    const raw = sessionStorage.getItem(START_WALK_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function clearStartWalkDraft() {
  try {
    sessionStorage.removeItem(START_WALK_DRAFT_KEY);
  } catch {
    // Ignore storage errors
  }
}

function getDefaultDateTimeStrings(): { dateStr: string; timeStr: string } {
  // Default to ~60 minutes from now, rounded to the next 15-minute mark
  const future = new Date(Date.now() + 60 * 60 * 1000);
  const rem = future.getMinutes() % 15;
  if (rem !== 0) {
    future.setMinutes(future.getMinutes() + (15 - rem), 0, 0);
  } else {
    future.setSeconds(0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`;
  const timeStr = `${pad(future.getHours())}:${pad(future.getMinutes())}`;
  return { dateStr, timeStr };
}

function extractProfileFirstWord(userProfile?: UserProfile | null): string {
  const raw = userProfile?.name?.trim() || '';
  if (!raw || raw.includes('@')) return '';
  return raw.split(/\s+/)[0]?.slice(0, 30) || '';
}

interface StartWalkSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentNode: Node | null;
  nodes: Node[];
  user: any;
  userProfile: UserProfile | null;
  onLogin: () => void;
  onProfileUpdate?: (profile: UserProfile) => void;
  onCreated?: (walkId: string) => void;
}

export const StartWalkSheet: React.FC<StartWalkSheetProps> = ({
  isOpen,
  onClose,
  currentNode,
  nodes,
  user,
  userProfile,
  onLogin,
  onProfileUpdate,
  onCreated,
}) => {
  const availableNodes = useMemo(() => {
    const map = new Map<string, Node>();
    nodes.forEach((n) => {
      if (n?.id && typeof n.latitude === 'number' && typeof n.longitude === 'number') {
        map.set(n.id, n);
      }
    });
    if (
      currentNode?.id &&
      typeof currentNode.latitude === 'number' &&
      typeof currentNode.longitude === 'number' &&
      !map.has(currentNode.id)
    ) {
      map.set(currentNode.id, currentNode);
    }
    return Array.from(map.values()).sort((a, b) =>
      formatHubDisplayName(a.name, a.id).localeCompare(formatHubDisplayName(b.name, b.id))
    );
  }, [nodes, currentNode]);

  const defaults = useMemo(() => getDefaultDateTimeStrings(), [isOpen]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(currentNode?.id || '');
  const [dateStr, setDateStr] = useState<string>(defaults.dateStr);
  const [timeStr, setTimeStr] = useState<string>(defaults.timeStr);
  const [capacity, setCapacity] = useState<number>(8);
  const [note, setNote] = useState<string>('');
  const [firstNameInput, setFirstNameInput] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [emailVerifiedState, setEmailVerifiedState] = useState<boolean>(Boolean(user?.emailVerified));

  const isSignedInAccount = Boolean(user && !user.isAnonymous);
  const profileFirstWord = extractProfileFirstWord(userProfile);

  useEffect(() => {
    setEmailVerifiedState(Boolean(user?.emailVerified));
  }, [user, user?.emailVerified]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setVerificationSent(false);

    const draft = readStartWalkDraft();
    if (draft) {
      const validNode = availableNodes.some((n) => n.id === draft.nodeId)
        ? draft.nodeId
        : currentNode?.id || availableNodes[0]?.id || '';
      setSelectedNodeId(validNode);
      setDateStr(draft.dateStr || defaults.dateStr);
      setTimeStr(draft.timeStr || defaults.timeStr);
      setCapacity(typeof draft.capacity === 'number' ? Math.min(15, Math.max(2, draft.capacity)) : 8);
      setNote(draft.note || '');
      setFirstNameInput(draft.firstNameInput || '');
      if (isSignedInAccount) {
        clearStartWalkDraft();
      }
    } else {
      setSelectedNodeId(currentNode?.id || availableNodes[0]?.id || '');
      const fresh = getDefaultDateTimeStrings();
      setDateStr(fresh.dateStr);
      setTimeStr(fresh.timeStr);
      setCapacity(8);
      setNote('');
      setFirstNameInput('');
    }
  }, [isOpen, currentNode?.id, availableNodes.length, isSignedInAccount]);

  if (!isOpen) return null;

  const handleRouteToLogin = () => {
    try {
      const draft: StartWalkDraft = {
        nodeId: selectedNodeId || currentNode?.id || '',
        dateStr,
        timeStr,
        capacity,
        note,
        firstNameInput,
      };
      sessionStorage.setItem(START_WALK_DRAFT_KEY, JSON.stringify(draft));
      const returnPath = window.location.pathname.startsWith('/tap/')
        ? window.location.pathname
        : `/tap/${selectedNodeId || currentNode?.id || 'ALPHA_PLAZA_HUB'}`;
      sessionStorage.setItem('uh_login_redirect', returnPath);
      sessionStorage.removeItem('uh_login_partner_mode');
    } catch {
      // Ignore storage errors
    }
    onLogin();
  };

  const handleSendVerification = async () => {
    if (!user || user.isAnonymous) return;
    setError(null);
    try {
      await sendEmailVerification(user);
      setVerificationSent(true);
    } catch (err: any) {
      setError(err?.message || 'Could not send verification email right now.');
    }
  };

  const handleRefreshVerification = async () => {
    if (!user || user.isAnonymous) return;
    setCheckingVerification(true);
    setError(null);
    try {
      await user.reload();
      await user.getIdToken(true);
      const verified = Boolean(user.emailVerified);
      setEmailVerifiedState(verified);
      if (!verified) {
        setError('Your email is still unverified. Click the link in your inbox and try again.');
      }
    } catch {
      setError('Could not refresh verification status. Please try again.');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedInAccount) {
      handleRouteToLogin();
      return;
    }

    if (!emailVerifiedState) {
      setError('Verify your email address before starting a group walk.');
      return;
    }

    const chosenFirstName = profileFirstWord || firstNameInput.trim();
    const firstNameErr = validateClientFirstName(chosenFirstName);
    if (firstNameErr) {
      setError(firstNameErr);
      return;
    }

    if (!selectedNodeId || !availableNodes.some((n) => n.id === selectedNodeId)) {
      setError('Choose an existing hub for your walk.');
      return;
    }

    const departsDate = new Date(`${dateStr}T${timeStr}`);
    const departsMs = departsDate.getTime();
    const nowMs = Date.now();
    if (Number.isNaN(departsMs)) {
      setError('Choose a valid departure date and time.');
      return;
    }
    if (departsMs < nowMs + 30 * 60 * 1000) {
      setError('Departure time must be at least 30 minutes from now.');
      return;
    }
    if (departsMs > nowMs + 14 * 24 * 60 * 60 * 1000) {
      setError('Walks can be scheduled up to 14 days ahead.');
      return;
    }

    const noteErr = validateClientNote(note);
    if (noteErr) {
      setError(noteErr);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Save name to users/{uid} if profile had no name yet (allowed by firestore.rules; never touches role/partnerId)
      if (!profileFirstWord && user?.uid) {
        await setDoc(doc(db, 'users', user.uid), { name: chosenFirstName }, { merge: true });
        if (userProfile && onProfileUpdate) {
          onProfileUpdate({ ...userProfile, name: chosenFirstName });
        }
      }

      const idToken = await user.getIdToken();
      const deviceId = getWalkDeviceId();
      const created = await createWalkGroupApi(
        {
          first_name: chosenFirstName,
          node_id: selectedNodeId,
          departs_at: departsDate.toISOString(),
          capacity,
          note: note.trim() || null,
          device_id: deviceId,
        },
        idToken
      );

      saveFirstName(chosenFirstName);
      if (created.member_token) {
        saveWalkMembership(created.id, {
          memberToken: created.member_token,
          spots: 1,
          firstName: chosenFirstName,
          isHost: true,
          joinedAt: Date.now(),
        });
      }
      clearStartWalkDraft();
      onCreated?.(created.id);
      onClose();
    } catch (err: any) {
      if (err?.code === 'LOGIN_REQUIRED') {
        handleRouteToLogin();
        return;
      }
      if (err?.code === 'VERIFY_EMAIL') {
        setEmailVerifiedState(false);
      }
      setError(err?.message || 'Unable to start walk right now.');
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
        aria-labelledby="start-walk-title"
        className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-[#161618] border-t border-[#26262A] rounded-t-3xl z-[3110] pb-24 max-h-[88vh] overflow-y-auto text-white shadow-2xl"
      >
        <div className="w-10 h-1.5 bg-white/15 rounded-full mx-auto mt-3" />
        <div className="p-6 space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-uh-yellow">
                Community Walk
              </p>
              <h2 id="start-walk-title" className="text-xl font-bold text-white mt-0.5">
                Start a walk
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close start walk sheet"
              className="min-h-[44px] min-w-[44px] rounded-full bg-white/5 hover:bg-white/10 text-[#A3A3AA] hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Auth / Verification Notices */}
          {!isSignedInAccount && (
            <div className="rounded-2xl bg-uh-yellow/10 border border-uh-yellow/30 p-4 space-y-2.5">
              <p className="text-xs text-[#E4E4E7] leading-relaxed">
                Sign in with a verified account to host a walk. Fill in your details below or sign in now — your entries are kept.
              </p>
              <button
                type="button"
                onClick={handleRouteToLogin}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-uh-yellow text-uh-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogIn size={14} />
                <span>Sign in to host</span>
              </button>
            </div>
          )}

          {isSignedInAccount && !emailVerifiedState && (
            <div className="rounded-2xl bg-uh-magenta/10 border border-uh-magenta/35 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle size={17} className="text-uh-magenta shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-white">
                    Verify your email to start a walk
                  </p>
                  <p className="text-xs text-[#E4E4E7] leading-relaxed">
                    Hosting a community walk requires a verified email address. Check your inbox for a verification link, then refresh below.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendVerification}
                  disabled={verificationSent}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {verificationSent ? <Check size={14} /> : <Mail size={14} />}
                  <span>{verificationSent ? 'Verification email sent' : 'Send verification email'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleRefreshVerification}
                  disabled={checkingVerification}
                  className="min-h-[40px] px-3 py-2 rounded-xl bg-uh-yellow text-uh-black text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {checkingVerification ? <Loader2 size={14} className="animate-spin" /> : null}
                  <span>I&apos;ve verified</span>
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Host First Name */}
            {profileFirstWord ? (
              <div className="flex items-center justify-between text-xs py-2 px-3.5 rounded-xl bg-white/[0.04] border border-[#26262A]">
                <span className="text-[#A3A3AA]">Hosted by</span>
                <span className="font-semibold text-white">{profileFirstWord}</span>
              </div>
            ) : (
              <div>
                <label htmlFor="start-walk-first-name" className="block text-xs font-semibold text-[#E4E4E7] mb-1.5">
                  Your first name
                </label>
                <input
                  id="start-walk-first-name"
                  type="text"
                  maxLength={30}
                  value={firstNameInput}
                  onChange={(e) => setFirstNameInput(e.target.value)}
                  placeholder="First name shown to walkers"
                  className="w-full min-h-[48px] bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-[#71717A] focus:outline-none focus:border-uh-yellow"
                />
              </div>
            )}

            {/* Existing Hub Picker ONLY */}
            <div>
              <label htmlFor="start-walk-hub" className="block text-xs font-semibold text-[#E4E4E7] mb-1.5">
                Starting hub
              </label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-uh-yellow pointer-events-none" />
                <select
                  id="start-walk-hub"
                  value={selectedNodeId}
                  onChange={(e) => setSelectedNodeId(e.target.value)}
                  className="w-full min-h-[48px] bg-black/50 border border-white/15 rounded-xl pl-10 pr-4 py-3 text-sm text-white focus:outline-none focus:border-uh-yellow appearance-none"
                >
                  {availableNodes.map((hub) => (
                    <option key={hub.id} value={hub.id} className="bg-[#161618] text-white">
                      {formatHubDisplayName(hub.name, hub.id)}
                      {hub.address ? ` — ${hub.address}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="start-walk-date" className="block text-xs font-semibold text-[#E4E4E7] mb-1.5">
                  Date
                </label>
                <input
                  id="start-walk-date"
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  required
                  className="w-full min-h-[48px] bg-black/50 border border-white/15 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-uh-yellow"
                />
              </div>
              <div>
                <label htmlFor="start-walk-time" className="block text-xs font-semibold text-[#E4E4E7] mb-1.5">
                  Departure time
                </label>
                <input
                  id="start-walk-time"
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  required
                  className="w-full min-h-[48px] bg-black/50 border border-white/15 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:border-uh-yellow"
                />
              </div>
            </div>
            <p className="text-[11px] text-[#A3A3AA] -mt-2">
              Schedule between 30 minutes and 14 days ahead. You&apos;re counted as the first walker.
            </p>

            {/* Group Size 2-15 */}
            <div className="flex items-center justify-between gap-4 py-2 border-y border-[#26262A]">
              <div>
                <span className="block text-sm font-semibold text-white">Group size</span>
                <span className="text-xs text-[#A3A3AA]">2 to 15 walkers (including you)</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCapacity((c) => Math.max(2, c - 1))}
                  disabled={capacity <= 2}
                  aria-label="Decrease capacity"
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-[32px] text-center text-base font-bold font-mono tabular-nums text-white">
                  {capacity}
                </span>
                <button
                  type="button"
                  onClick={() => setCapacity((c) => Math.min(15, c + 1))}
                  disabled={capacity >= 15}
                  aria-label="Increase capacity"
                  className="min-h-[44px] min-w-[44px] rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white disabled:opacity-35 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Optional Note (<= 140 chars, no links/emails/phones) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="start-walk-note" className="text-xs font-semibold text-[#E4E4E7]">
                  Note (optional)
                </label>
                <span className="text-[11px] font-mono tabular-nums text-[#A3A3AA]">
                  {note.length}/140
                </span>
              </div>
              <textarea
                id="start-walk-note"
                rows={2}
                maxLength={140}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Easy 45-min loop around the park, dogs welcome"
                className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-3 text-sm text-white placeholder-[#71717A] focus:outline-none focus:border-uh-yellow resize-none"
              />
            </div>

            <div className="flex items-start gap-2 text-xs text-[#A3A3AA]">
              <ShieldCheck size={15} className="text-uh-teal shrink-0 mt-0.5" />
              <span>Meet at the hub, in public. Never share contact details.</span>
            </div>

            {error && (
              <div className="rounded-xl border border-uh-magenta/40 bg-uh-magenta/10 px-3.5 py-2.5 text-xs text-[#FDA4AF]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || (isSignedInAccount && !emailVerifiedState)}
              className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-uh-yellow text-uh-black font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Starting walk...</span>
                </>
              ) : !isSignedInAccount ? (
                <span>Sign in to start this walk</span>
              ) : (
                <span>Start walk</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
};
