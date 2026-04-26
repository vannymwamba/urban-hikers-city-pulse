/**
 * timeUtils.ts
 * Single source of truth for all time operations.
 * Used by: BroadcastCard, broadcastHelpers, App.tsx
 *
 * Handles ALL formats from all three data sources:
 *   Admin form      → Firestore Timestamp
 *   CHPL agent      → Firestore Timestamp (after fix)
 *   Visit Cincy     → Firestore Timestamp (after fix)
 *   Legacy data     → ISO string or { seconds } object
 */

export function toMs(val: any): number | null {
  if (val === null || val === undefined) return null;

  // Firestore Timestamp object with toDate()
  if (typeof val?.toDate === 'function') {
    try {
      const ms = val.toDate().getTime();
      return isNaN(ms) ? null : ms;
    } catch { return null; }
  }

  // Serialized Timestamp { seconds, nanoseconds }
  if (typeof val?.seconds === 'number') {
    const ms = val.seconds * 1000 +
      Math.floor((val.nanoseconds || 0) / 1e6);
    return isNaN(ms) ? null : ms;
  }

  // ISO string
  if (typeof val === 'string' && val.length > 0) {
    const ms = new Date(val).getTime();
    return isNaN(ms) ? null : ms;
  }

  // Numeric — distinguish seconds from milliseconds
  if (typeof val === 'number' && !isNaN(val)) {
    return val > 1e10 ? val : val * 1000;
  }

  return null;
}

export type TimeState = 'upcoming' | 'imminent' | 'live' | null;

export function getTimeState(
  starts_at: any,
  expires_at: any
): TimeState {
  const now   = Date.now();
  const start = toMs(starts_at)  || toMs((starts_at as any)?.startsAt);
  const end   = toMs(expires_at) || toMs((expires_at as any)?.expiresAt);

  if (end && now > end)  return null;       // ended
  if (!start)            return 'upcoming'; // no start = upcoming

  if (start <= now)      return 'live';     // started

  const mins = Math.round((start - now) / 60000);
  if (mins <= 60 && mins > 0) return 'imminent'; // within 1 hour

  return 'upcoming';
}

export function getTimeLabel(
  starts_at:  any,
  expires_at: any,
  type?:      string
): string {
  // Permanent types — no time label
  if (type === 'mural' || type === 'street_art') return '';

  const now   = Date.now();
  const start = toMs(starts_at);
  const end   = toMs(expires_at);
  const state = getTimeState(starts_at, expires_at);

  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit'
    });

  if (state === null)      return '';
  if (state === 'live') {
    if (!end) return 'Live';
    const left = Math.round((end - now) / 60000);
    return (left <= 30 && left > 0) ? `Ends in ${left}m` : `Ends ${fmt(end)}`;
  }
  if (state === 'imminent') {
    const mins = Math.round(((start || 0) - now) / 60000);
    return `Starts in ${mins}m`;
  }
  // Upcoming
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start)        return fmt(start);
  return '';
}

export function isNotExpired(broadcast: any): boolean {
  if (
    broadcast.type === 'mural' ||
    broadcast.type === 'street_art' ||
    broadcast.type === 'MURAL' ||
    broadcast.type === 'STREET_ART'
  ) return true;                    // permanent — never expire

  const end = toMs(broadcast.expires_at || broadcast.expiresAt);
  if (!end) return true;            // no expiry = keep showing
  return end > Date.now();
}
