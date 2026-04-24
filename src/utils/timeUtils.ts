/**
 * Converts ANY Firestore timestamp format to milliseconds.
 * Handles all four formats Firestore can return:
 *   1. Firestore Timestamp object    { toDate() }
 *   2. Plain seconds object          { seconds, nanoseconds }
 *   3. ISO string                    "2026-04-24T10:00:00Z"
 *   4. Numeric milliseconds          1745678400000
 */
export function toMs(val: any): number | null {
  if (val === null || val === undefined) return null;

  // Format 1 — Firestore Timestamp object
  if (typeof val.toDate === 'function') {
    try {
      const d = val.toDate();
      const ms = d.getTime();
      return isNaN(ms) ? null : ms;
    } catch {
      return null;
    }
  }

  // Format 2 — Plain object { seconds, nanoseconds }
  // This happens when Firestore data is serialized/deserialized
  if (
    typeof val === 'object' &&
    typeof val.seconds === 'number'
  ) {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
  }

  // Format 3 — ISO string
  if (typeof val === 'string' && val.length > 0) {
    const ms = new Date(val).getTime();
    return isNaN(ms) ? null : ms;
  }

  // Format 4 — Numeric milliseconds
  if (typeof val === 'number' && !isNaN(val)) {
    // Distinguish seconds from milliseconds
    // Unix seconds are ~10 digits, ms are ~13 digits
    return val > 1e10 ? val : val * 1000;
  }

  return null;
}

/**
 * Returns the time state for a broadcast.
 * THREE STATES ONLY:
 *   'upcoming'  — not started yet (> 60 min away)
 *   'imminent'  — starting within 60 minutes
 *   'live'      — currently happening
 *   null        — ended, don't show
 */
export type TimeState = 'upcoming' | 'imminent' | 'live' | null;

export function getTimeState(
  starts_at: any,
  expires_at: any
): TimeState {
  const now   = Date.now();
  const start = toMs(starts_at);
  const end   = toMs(expires_at);

  // Ended — don't show
  if (end && now > end) return null;

  // No start time — treat as upcoming
  if (!start) return 'upcoming';

  // LIVE — started and not ended
  if (start <= now) return 'live';

  const minsUntil = Math.round((start - now) / 60000);

  // IMMINENT — starting within 60 minutes
  if (minsUntil <= 60 && minsUntil > 0) return 'imminent';

  // UPCOMING — starts later
  return 'upcoming';
}

/**
 * Returns human-readable time label for location pill.
 * Returns '' for permanent types (mural, street_art).
 */
export function getTimeLabel(
  starts_at:  any,
  expires_at: any,
  type?:      string
): string {
  // Permanent — never show time
  if (type === 'mural' || type === 'street_art') return '';

  const now   = Date.now();
  const start = toMs(starts_at);
  const end   = toMs(expires_at);

  const fmt = (ms: number) =>
    new Date(ms).toLocaleTimeString('en-US', {
      hour:   'numeric',
      minute: '2-digit',
    });

  const state = getTimeState(starts_at, expires_at);

  if (state === null) return '';  // ended

  if (state === 'live') {
    if (!end) return 'Live';
    const minsLeft = Math.round((end - now) / 60000);
    if (minsLeft <= 30 && minsLeft > 0) return `Ends in ${minsLeft}m`;
    return `Ends ${fmt(end)}`;
  }

  if (state === 'imminent') {
    const minsUntil = Math.round(((start || 0) - now) / 60000);
    return `Starts in ${minsUntil}m`;
  }

  // Upcoming — show range
  if (start && end) return `${fmt(start)} – ${fmt(end)}`;
  if (start)        return fmt(start);

  return '';
}
