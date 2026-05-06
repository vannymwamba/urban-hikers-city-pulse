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
  const type = (broadcast.type ?? '').toLowerCase();
  if (
    broadcast.is_recurring === true ||
    type === 'mural' ||
    type === 'street_art' ||
    type === 'civic_event' ||
    type === 'civic_mural'
  ) return true;                    // permanent/civic/recurring — keep showing

  const end = toMs(broadcast.expires_at || broadcast.expiresAt);
  if (!end) return true;            // no expiry = keep showing
  return end > Date.now();
}

const DAY_MAP: Record<string, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
};

export function getNextRecurringDeparture(
  recurring_days: string[],
  recurring_times: string[]
): { label: string; isToday: boolean; minutesAway: number } | null {
  if (!recurring_days?.length || !recurring_times?.length) return null;

  const now = new Date();
  const nowDay = now.getDay();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const activeDayNums = recurring_days.map(d => DAY_MAP[d]).filter(n => n !== undefined);
  const sortedTimes = [...recurring_times].sort();

  // Check up to 8 days ahead (covers full week + today)
  for (let offset = 0; offset < 8; offset++) {
    const checkDay = (nowDay + offset) % 7;
    if (!activeDayNums.includes(checkDay)) continue;

    for (const t of sortedTimes) {
      const [h, m] = t.split(':').map(Number);
      const depMins = h * 60 + m;

      // If today, only show future departures (5 min buffer)
      if (offset === 0 && depMins <= nowMins + 5) continue;

      const minsAway = offset * 1440 + depMins - nowMins;
      const isToday = offset === 0;
      const isTomorrow = offset === 1;

      const timeStr = new Date(2000, 0, 1, h, m)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

      let label: string;
      if (isToday) {
        label = minsAway <= 60
          ? `Departs in ${Math.round(minsAway)}m`
          : `Today ${timeStr}`;
      } else if (isTomorrow) {
        label = `Tomorrow ${timeStr}`;
      } else {
        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][checkDay];
        label = `${dayName} ${timeStr}`;
      }

      return { label, isToday, minutesAway: minsAway };
    }
  }

  return null;
}

export function getRecurringTimeLabel(broadcast: any): string {
  if (!broadcast.is_recurring) return '';
  
  const freq = broadcast.recurring_frequency || 'daily';
  const next = getNextRecurringDeparture(
    broadcast.recurring_days,
    broadcast.recurring_times
  );
  
  if (freq === 'daily') return next?.label ?? '';
  
  // Weekly/Biweekly/Monthly logic could be more complex, but let's approximate based on your spec
  if (!next) return '';
  return next.label;
}

export function getRecurringFrequencyBadge(broadcast: any): string {
  if (!broadcast.is_recurring) return '';
  return (broadcast.recurring_frequency || 'daily').toUpperCase();
}

export function getRecurringDeparturesSummary(times: string[]): string {
  return [...times]
    .sort()
    .map(t => {
      const [h, m] = t.split(':').map(Number);
      return new Date(2000, 0, 1, h, m)
        .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    })
    .join(' · ');
}

export function getFrequencySummary(broadcast: any): string {
  const freq = broadcast.recurring_frequency || 'daily';
  if (freq === 'daily') return getRecurringDeparturesSummary(broadcast.recurring_times || []);
  if (freq === 'weekly') return 'Every ' + (broadcast.recurring_days?.[0]?.charAt(0).toUpperCase() + broadcast.recurring_days?.[0]?.slice(1) || 'Fri');
  if (freq === 'biweekly') return 'Alt. ' + (broadcast.recurring_days?.[0]?.charAt(0).toUpperCase() + broadcast.recurring_days?.[0]?.slice(1) || 'Sat');
  if (freq === 'monthly') {
    const week = broadcast.recurring_week_of_month || 1;
    const weekMap: any = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: 'Last' };
    const day = (broadcast.recurring_days?.[0]?.charAt(0).toUpperCase() + broadcast.recurring_days?.[0]?.slice(1)) || 'Thu';
    return `${weekMap[week]} ${day}`;
  }
  return '';
}
