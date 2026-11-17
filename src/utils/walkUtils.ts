import { useEffect, useState } from 'react';
import { Broadcast, Node } from '../types';
import { toMs, getNextRecurringDeparture, getRecurringTimeLabel } from './timeUtils';

export const WALK_TIMEZONE = 'America/New_York';

const DEVICE_ID_KEY = 'uh_walk_device_id';
const FIRST_NAME_KEY = 'uh_walk_first_name';
const MEMBERSHIPS_KEY = 'uh_walk_memberships_v1';
export const START_WALK_DRAFT_KEY = 'uh_start_walk_draft_v1';
export const WALK_STATE_CHANGED_EVENT = 'uh-walk-state-changed';

export interface LocalWalkMembership {
  memberToken: string;
  spots: number;
  firstName: string;
  isHost?: boolean;
  joinedAt: number;
}

export interface WalkLivePatch {
  joined_count?: number;
  spots_remaining?: number;
  member_preview?: string[];
  active?: boolean;
}

const liveWalkPatches = new Map<string, WalkLivePatch>();

function emitWalkStateChanged(walkId?: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(WALK_STATE_CHANGED_EVENT, { detail: { walkId } }));
  }
}

export function setWalkLivePatch(walkId: string, patch: WalkLivePatch) {
  const prev = liveWalkPatches.get(walkId) || {};
  liveWalkPatches.set(walkId, { ...prev, ...patch });
  emitWalkStateChanged(walkId);
}

export function applyWalkLivePatch(walk: Broadcast): Broadcast {
  const patch = liveWalkPatches.get(walk.id);
  if (!patch) return walk;
  return {
    ...walk,
    ...(patch.joined_count !== undefined ? { joined_count: patch.joined_count } : {}),
    ...(patch.spots_remaining !== undefined ? { spots_remaining: patch.spots_remaining } : {}),
    ...(patch.member_preview !== undefined ? { member_preview: patch.member_preview } : {}),
    ...(patch.active !== undefined ? { active: patch.active } : {}),
  };
}

export function getWalkDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return `dev_ephemeral_${Date.now()}`;
  }
}

export function getSavedFirstName(): string {
  try {
    return localStorage.getItem(FIRST_NAME_KEY) || '';
  } catch {
    return '';
  }
}

export function saveFirstName(name: string) {
  try {
    const trimmed = name.trim();
    if (trimmed) {
      localStorage.setItem(FIRST_NAME_KEY, trimmed);
    }
  } catch {
    // Ignore storage errors
  }
}

function readAllMemberships(): Record<string, LocalWalkMembership> {
  try {
    const raw = localStorage.getItem(MEMBERSHIPS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function getWalkMembership(walkId: string): LocalWalkMembership | null {
  const all = readAllMemberships();
  return all[walkId] || null;
}

export function saveWalkMembership(walkId: string, membership: LocalWalkMembership) {
  try {
    const all = readAllMemberships();
    all[walkId] = membership;
    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(all));
    emitWalkStateChanged(walkId);
  } catch {
    // Ignore storage errors
  }
}

export function clearWalkMembership(walkId: string) {
  try {
    const all = readAllMemberships();
    delete all[walkId];
    localStorage.setItem(MEMBERSHIPS_KEY, JSON.stringify(all));
    emitWalkStateChanged(walkId);
  } catch {
    // Ignore storage errors
  }
}

export function useWalkSyncVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const handler = () => setVersion((v) => v + 1);
    window.addEventListener(WALK_STATE_CHANGED_EVENT, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(WALK_STATE_CHANGED_EVENT, handler);
      window.removeEventListener('storage', handler);
    };
  }, []);
  return version;
}

export async function sha256BrowserHex(value: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useUidHash(uid?: string | null): string | null {
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    if (!uid) {
      setHash(null);
      return;
    }
    sha256BrowserHex(uid)
      .then((h) => {
        if (active) setHash(h || null);
      })
      .catch(() => {
        if (active) setHash(null);
      });
    return () => {
      active = false;
    };
  }, [uid]);
  return hash;
}

export function formatHubDisplayName(rawName?: string | null, fallback = 'Hub'): string {
  if (!rawName || !rawName.trim()) return fallback;
  return rawName.replace(/_HUB$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || fallback;
}

export function resolveWalkHub(walk: Broadcast, nodes: Node[], fallbackNode?: Node | null): Node | null {
  const targetId = walk.node_id || walk.nodeId;
  if (targetId) {
    const found = nodes.find((n) => n.id === targetId);
    if (found) return found;
    if (fallbackNode && fallbackNode.id === targetId) return fallbackNode;
  }
  return null;
}

const URL_PATTERN =
  /https?:\/\/|www\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|me|app|gg|ly|link|xyz|info|biz|edu|gov|us|tv|dev)\b/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d(?:[\s().-]?\d){6,}/;

export function validateClientNote(note: string): string | null {
  const trimmed = note.trim();
  if (!trimmed) return null;
  if (trimmed.length > 140) {
    return 'Note must be 140 characters or fewer.';
  }
  if (URL_PATTERN.test(trimmed) || EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed)) {
    return 'Notes cannot include links, email addresses, or phone numbers.';
  }
  return null;
}

export function validateClientFirstName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    return 'Enter your first name (1–30 characters).';
  }
  if (URL_PATTERN.test(trimmed) || EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed)) {
    return 'Enter a valid first name only.';
  }
  return null;
}

export function getWalkDepartsMs(walk: Broadcast, nowMs = Date.now()): number | null {
  const explicitDeparts = toMs(walk.departs_at);
  if (explicitDeparts !== null) return explicitDeparts;

  if (walk.is_recurring) {
    const next = getNextRecurringDeparture(walk.recurring_days || [], walk.recurring_times || []);
    if (next) {
      return nowMs + next.minutesAway * 60_000;
    }
    return null;
  }

  return toMs(walk.starts_at || walk.startsAt || walk.startTime);
}

export function isWalkVisible(walk: Broadcast, nowMs = Date.now()): boolean {
  const patched = applyWalkLivePatch(walk);
  if ((patched.type ?? '').toString().toLowerCase() !== 'walking_event') {
    return false;
  }
  if (patched.active === false || Boolean(patched.cancelled_at)) {
    return false;
  }
  if (patched.is_recurring) {
    return true;
  }
  const depMs = getWalkDepartsMs(patched, nowMs);
  if (depMs !== null && nowMs > depMs + 15 * 60_000) {
    return false;
  }
  return true;
}

function getNyDayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: WALK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function isWalkTodayNY(ms: number, nowMs = Date.now()): boolean {
  return getNyDayKey(ms) === getNyDayKey(nowMs);
}

export function formatWalkTimeNY(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: WALK_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}

function formatWalkDayNY(ms: number): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: WALK_TIMEZONE,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(ms));
}

export function getWalkScheduleLabel(walk: Broadcast, nowMs = Date.now()): string {
  if (walk.is_recurring) {
    return getRecurringTimeLabel(walk) || walk.departure_time || 'Scheduled';
  }

  const depMs = getWalkDepartsMs(walk, nowMs);
  if (depMs !== null) {
    if (nowMs > depMs) {
      return `Departed · ${formatWalkTimeNY(depMs)}`;
    }
    const minsAway = Math.max(1, Math.round((depMs - nowMs) / 60_000));
    if (minsAway <= 60) {
      return `Departs in ${minsAway}m`;
    }
    if (isWalkTodayNY(depMs, nowMs)) {
      return `Today · ${formatWalkTimeNY(depMs)}`;
    }
    const tomorrowKey = getNyDayKey(nowMs + 24 * 60 * 60 * 1000);
    if (getNyDayKey(depMs) === tomorrowKey) {
      return `Tomorrow · ${formatWalkTimeNY(depMs)}`;
    }
    return `${formatWalkDayNY(depMs)} · ${formatWalkTimeNY(depMs)}`;
  }

  return walk.departure_time || 'Upcoming';
}

export type WalkAvailabilityState = 'OPEN' | 'ALMOST FULL' | 'FULL' | 'DEPARTED';

export function getWalkAvailabilityState(
  walk: Broadcast,
  nowMs = Date.now()
): WalkAvailabilityState {
  const patched = applyWalkLivePatch(walk);
  if (!patched.is_recurring) {
    const depMs = getWalkDepartsMs(patched, nowMs);
    if (depMs !== null && nowMs > depMs) {
      return 'DEPARTED';
    }
  }

  const remaining = getWalkSpotsRemaining(patched);
  if (remaining !== null) {
    if (remaining <= 0) return 'FULL';
    if (remaining <= 3) return 'ALMOST FULL';
  }

  return 'OPEN';
}

export function getWalkSpotsRemaining(walk: Broadcast): number | null {
  const patched = applyWalkLivePatch(walk);
  if (typeof patched.spots_remaining === 'number') {
    return Math.max(0, patched.spots_remaining);
  }
  if (typeof patched.max_capacity === 'number') {
    const joined = typeof patched.joined_count === 'number' ? patched.joined_count : 0;
    return Math.max(0, patched.max_capacity - joined);
  }
  return null;
}

export function getWalkJoinedCount(walk: Broadcast): number {
  const patched = applyWalkLivePatch(walk);
  if (typeof patched.joined_count === 'number') {
    return Math.max(0, patched.joined_count);
  }
  if (typeof patched.max_capacity === 'number' && typeof patched.spots_remaining === 'number') {
    return Math.max(0, patched.max_capacity - patched.spots_remaining);
  }
  return 0;
}

function mapApiErrorMessage(codeOrMessage: string): string {
  switch (codeOrMessage) {
    case 'WALKS_UNAVAILABLE':
      return 'Group walks are temporarily unavailable right now. Please try again shortly.';
    case 'LOGIN_REQUIRED':
      return 'Please sign in with your account to continue.';
    case 'VERIFY_EMAIL':
      return 'Verify your email address before starting a group walk.';
    case 'HUB_NOT_FOUND':
      return 'The selected hub could not be found.';
    case 'FORBIDDEN':
      return 'Only the walk host or an admin can cancel this walk.';
    case 'WALK_NOT_FOUND':
      return 'This walk could not be found.';
    case 'MEMBERSHIP_NOT_FOUND':
      return 'You have already left this walk.';
    case 'INVALID_MEMBER_TOKEN':
      return 'Could not verify your spot on this device.';
    default:
      return codeOrMessage || 'Something went wrong. Please try again.';
  }
}

async function postJson<T>(url: string, body: Record<string, any>, idToken?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  let payload: any = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const rawCode = payload?.error || `Request failed (${res.status})`;
    const err = new Error(mapApiErrorMessage(rawCode)) as Error & { code?: string; status?: number };
    err.code = rawCode;
    err.status = res.status;
    throw err;
  }

  return payload as T;
}

export interface CreateWalkResponse {
  ok: boolean;
  id: string;
  member_token?: string;
  spots?: number;
  joined_count: number;
  spots_remaining: number;
  member_preview: string[];
}

export function createWalkGroupApi(
  payload: {
    first_name: string;
    node_id: string;
    departs_at: string;
    capacity: number;
    note?: string | null;
    device_id?: string;
  },
  idToken: string
): Promise<CreateWalkResponse> {
  return postJson<CreateWalkResponse>('/api/walk-groups', payload, idToken);
}

export interface JoinWalkResponse {
  ok: boolean;
  already_joined?: boolean;
  member_token: string;
  spots: number;
  joined_count: number;
  spots_remaining: number;
  member_preview: string[];
}

export function joinWalkGroupApi(
  walkId: string,
  payload: { first_name: string; spots: number; device_id: string }
): Promise<JoinWalkResponse> {
  return postJson<JoinWalkResponse>(`/api/walk-groups/${encodeURIComponent(walkId)}/join`, payload);
}

export interface LeaveWalkResponse {
  ok: boolean;
  joined_count: number;
  spots_remaining: number;
  member_preview: string[];
}

export function leaveWalkGroupApi(
  walkId: string,
  payload: { device_id: string; member_token: string }
): Promise<LeaveWalkResponse> {
  return postJson<LeaveWalkResponse>(`/api/walk-groups/${encodeURIComponent(walkId)}/leave`, payload);
}

export function cancelWalkGroupApi(walkId: string, idToken: string): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/api/walk-groups/${encodeURIComponent(walkId)}/cancel`, {}, idToken);
}

export function reportWalkGroupApi(walkId: string, reason: string): Promise<{ ok: boolean }> {
  return postJson<{ ok: boolean }>(`/api/walk-groups/${encodeURIComponent(walkId)}/report`, { reason });
}
