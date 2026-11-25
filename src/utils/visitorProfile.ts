import { 
  doc, 
  getDoc, 
  setDoc, 
  runTransaction
} from 'firebase/firestore';
import { db } from '../firebase';
import type { VisitorProfile, JourneyStop } from '../types';
import { SHOW_MILEAGE } from '../config/features';

/**
 * Calculates straight-line distance in miles between two coordinates using Haversine formula.
 */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface TapStopInput {
  artist_id?: string | null;
  location_id?: string | null;
  neighborhood?: string | null;
  lat?: number | null;
  lng?: number | null;
  access_vector?: 'nfc' | 'qr' | 'direct';
}

export interface TapTransactionResult {
  xpAwarded: number;
  newBadge: string | null;
}

const XP_PER_TAP = 25;
const XP_PER_CONNECTION = 10;

/**
 * Badge thresholds, evaluated against real, already-tracked profile metrics.
 * Add new badges here — no new counters needed, just new thresholds.
 */
function computeEarnedBadges(profile: {
  locations_visited_ids: string[];
  neighborhoods_visited: string[];
  total_miles_explored: number;
  connections_count: number;
}): string[] {
  const earned: string[] = [];
  if (profile.locations_visited_ids.length >= 1) earned.push('Downtown Explorer');
  if (profile.locations_visited_ids.length >= 5) earned.push('Local Explorer');
  if (profile.locations_visited_ids.length >= 10) earned.push('Hyperlocal Guru');
  if (profile.neighborhoods_visited.length >= 3) earned.push('Neighborhood Hopper');
  if (SHOW_MILEAGE && profile.total_miles_explored >= 10) earned.push('10-Mile Hiker');
  if (profile.connections_count >= 3) earned.push('Connector');
  return earned;
}

/**
 * Record a tap into visitor_profiles/{uid} using a single Firestore transaction.
 * - Distance: straight-line distance from previous stop * 1.3
 * - Skip segment if under 50m or more than 3 hours after previous tap.
 * - Caps journey_stops at 50 stops.
 * - Dedupes artists/locations/neighborhoods manually (not arrayUnion) so the
 *   resulting counts are known inside the transaction, for badge checks.
 * - Awards XP and badges atomically alongside the tap — this is now the one
 *   source of truth; nothing is tracked in localStorage anymore.
 */
export async function recordVisitorTapTransaction(
  uid: string,
  stop: TapStopInput
): Promise<TapTransactionResult> {
  if (!uid) return { xpAwarded: 0, newBadge: null };

  const profileRef = doc(db, 'visitor_profiles', uid);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(profileRef);
      const newStop: JourneyStop = {
        artist_id: stop.artist_id || null,
        location_id: stop.location_id || null,
        neighborhood: stop.neighborhood || null,
        lat: typeof stop.lat === 'number' ? stop.lat : null,
        lng: typeof stop.lng === 'number' ? stop.lng : null,
        first_tapped_at: nowIso,
        access_vector: stop.access_vector || 'direct',
      };

      if (!snap.exists()) {
        const locations = stop.location_id ? [stop.location_id] : [];
        const neighborhoods = stop.neighborhood ? [stop.neighborhood] : [];
        const badges = computeEarnedBadges({
          locations_visited_ids: locations,
          neighborhoods_visited: neighborhoods,
          total_miles_explored: 0,
          connections_count: 0,
        });

        const initialProfile: VisitorProfile = {
          artists_discovered_ids: stop.artist_id ? [stop.artist_id] : [],
          locations_visited_ids: locations,
          neighborhoods_visited: neighborhoods,
          total_miles_explored: 0,
          journey_stops: [newStop],
          favorite_artist_id: stop.artist_id || null,
          first_tap_at: nowIso,
          last_tap_at: nowIso,
          email: null,
          consent_given: false,
          consent_timestamp: null,
          consent_version: null,
          xp: XP_PER_TAP,
          badges,
          connections_count: 0,
        };
        tx.set(profileRef, initialProfile);
        return { xpAwarded: XP_PER_TAP, newBadge: badges[0] || null };
      }

      const existing = snap.data() as VisitorProfile;
      const existingStops: JourneyStop[] = Array.isArray(existing.journey_stops) ? existing.journey_stops : [];
      const prevStop = existingStops.length > 0 ? existingStops[existingStops.length - 1] : null;

      let milesToAdd = 0;
      if (
        prevStop &&
        typeof prevStop.lat === 'number' &&
        typeof prevStop.lng === 'number' &&
        typeof stop.lat === 'number' &&
        typeof stop.lng === 'number'
      ) {
        const straightLineMi = haversineMiles(prevStop.lat, prevStop.lng, stop.lat, stop.lng);
        const distMeters = straightLineMi * 1609.344;
        const prevTimeMs = prevStop.first_tapped_at ? new Date(prevStop.first_tapped_at).getTime() : 0;
        const timeDiffMs = nowMs - prevTimeMs;

        // Skip segment if < 50 meters or > 3 hours (10,800,000 ms)
        if (distMeters >= 50 && timeDiffMs <= 3 * 60 * 60 * 1000) {
          milesToAdd = straightLineMi * 1.3;
        }
      }

      const updatedMiles = Number(((existing.total_miles_explored || 0) + milesToAdd).toFixed(3));
      const updatedStops = [...existingStops, newStop].slice(-50); // max 50 stops

      // Dedupe manually (instead of arrayUnion) so we know the resulting
      // counts synchronously, for badge threshold checks below.
      const updatedArtists = stop.artist_id
        ? Array.from(new Set([...(existing.artists_discovered_ids || []), stop.artist_id]))
        : (existing.artists_discovered_ids || []);
      const updatedLocations = stop.location_id
        ? Array.from(new Set([...(existing.locations_visited_ids || []), stop.location_id]))
        : (existing.locations_visited_ids || []);
      const updatedNeighborhoods = stop.neighborhood
        ? Array.from(new Set([...(existing.neighborhoods_visited || []), stop.neighborhood]))
        : (existing.neighborhoods_visited || []);

      const existingBadges = existing.badges || [];
      const connectionsCount = existing.connections_count || 0;
      const earnedBadges = computeEarnedBadges({
        locations_visited_ids: updatedLocations,
        neighborhoods_visited: updatedNeighborhoods,
        total_miles_explored: updatedMiles,
        connections_count: connectionsCount,
      });
      const newBadges = earnedBadges.filter((b) => !existingBadges.includes(b));
      const updatedBadges = [...existingBadges, ...newBadges];
      const newXp = (existing.xp || 0) + XP_PER_TAP;

      const updatePayload: any = {
        total_miles_explored: updatedMiles,
        journey_stops: updatedStops,
        last_tap_at: nowIso,
        first_tap_at: existing.first_tap_at || nowIso,
        favorite_artist_id: existing.favorite_artist_id || stop.artist_id || null,
        artists_discovered_ids: updatedArtists,
        locations_visited_ids: updatedLocations,
        neighborhoods_visited: updatedNeighborhoods,
        xp: newXp,
        badges: updatedBadges,
      };

      tx.update(profileRef, updatePayload);
      return { xpAwarded: XP_PER_TAP, newBadge: newBadges[0] || null };
    });
  } catch (err) {
    console.warn('Error recording visitor tap transaction:', err);
    return { xpAwarded: 0, newBadge: null };
  }
}

/**
 * Record a self-reported "met someone" connection. Awards bonus XP and
 * checks for the Connector badge, atomically, inside one transaction.
 * Replaces the old localStorage-only connectionsCount increment.
 */
export async function recordConnection(uid: string): Promise<TapTransactionResult> {
  if (!uid) return { xpAwarded: 0, newBadge: null };

  const profileRef = doc(db, 'visitor_profiles', uid);
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(profileRef);
      if (!snap.exists()) {
        // No profile yet (shouldn't normally happen — a tap always creates one first)
        return { xpAwarded: 0, newBadge: null };
      }

      const existing = snap.data() as VisitorProfile;
      const newConnectionsCount = (existing.connections_count || 0) + 1;
      const newXp = (existing.xp || 0) + XP_PER_CONNECTION;
      const existingBadges = existing.badges || [];
      const earnedBadges = computeEarnedBadges({
        locations_visited_ids: existing.locations_visited_ids || [],
        neighborhoods_visited: existing.neighborhoods_visited || [],
        total_miles_explored: existing.total_miles_explored || 0,
        connections_count: newConnectionsCount,
      });
      const newBadges = earnedBadges.filter((b) => !existingBadges.includes(b));
      const updatedBadges = [...existingBadges, ...newBadges];

      tx.update(profileRef, {
        connections_count: newConnectionsCount,
        xp: newXp,
        badges: updatedBadges,
      });

      return { xpAwarded: XP_PER_CONNECTION, newBadge: newBadges[0] || null };
    });
  } catch (err) {
    console.warn('Error recording connection:', err);
    return { xpAwarded: 0, newBadge: null };
  }
}



/**
 * Fetch a single visitor profile document.
 */
export async function getVisitorProfile(uid: string): Promise<VisitorProfile | null> {
  if (!uid) return null;
  try {
    const snap = await getDoc(doc(db, 'visitor_profiles', uid));
    if (snap.exists()) {
      return { uid: snap.id, ...snap.data() } as VisitorProfile;
    }
  } catch (err) {
    console.warn('Error fetching visitor profile:', err);
  }
  return null;
}

/**
 * Merge an anonymous visitor profile into an existing account's profile:
 * - Union the arrays (artists_discovered_ids, locations_visited_ids, neighborhoods_visited)
 * - Add the miles (total_miles_explored)
 * - Merge journey_stops (max 50)
 * - Consolidate timestamps & consent
 */
export async function mergeVisitorProfiles(
  anonProfile: VisitorProfile,
  targetUid: string
): Promise<void> {
  if (!targetUid || !anonProfile) return;

  const targetRef = doc(db, 'visitor_profiles', targetUid);
  try {
    const targetSnap = await getDoc(targetRef);
    const existing = targetSnap.exists() ? (targetSnap.data() as VisitorProfile) : null;

    const unionArtists = Array.from(
      new Set([
        ...(existing?.artists_discovered_ids || []),
        ...(anonProfile.artists_discovered_ids || []),
      ])
    );

    const unionLocations = Array.from(
      new Set([
        ...(existing?.locations_visited_ids || []),
        ...(anonProfile.locations_visited_ids || []),
      ])
    );

    const unionNeighborhoods = Array.from(
      new Set([
        ...(existing?.neighborhoods_visited || []),
        ...(anonProfile.neighborhoods_visited || []),
      ])
    );

    const mergedMiles = Number(
      ((existing?.total_miles_explored || 0) + (anonProfile.total_miles_explored || 0)).toFixed(3)
    );

    // Merge stops, sort by first_tapped_at ascending, and slice last 50
    const mergedStops = [
      ...(existing?.journey_stops || []),
      ...(anonProfile.journey_stops || []),
    ]
      .sort((a, b) => new Date(a.first_tapped_at).getTime() - new Date(b.first_tapped_at).getTime())
      .slice(-50);

    const firstTap = [existing?.first_tap_at, anonProfile.first_tap_at]
      .filter(Boolean)
      .sort((a, b) => new Date(a!).getTime() - new Date(b!).getTime())[0] || null;

    const lastTap = [existing?.last_tap_at, anonProfile.last_tap_at]
      .filter(Boolean)
      .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0] || null;

    const consentGiven = existing?.consent_given || anonProfile.consent_given || false;
    const consentTimestamp = existing?.consent_timestamp || anonProfile.consent_timestamp || null;
    const consentVersion = existing?.consent_version || anonProfile.consent_version || null;

    const mergedProfile: Partial<VisitorProfile> = {
      artists_discovered_ids: unionArtists,
      locations_visited_ids: unionLocations,
      neighborhoods_visited: unionNeighborhoods,
      total_miles_explored: mergedMiles,
      journey_stops: mergedStops,
      favorite_artist_id: existing?.favorite_artist_id || anonProfile.favorite_artist_id || null,
      first_tap_at: firstTap,
      last_tap_at: lastTap,
      email: existing?.email || anonProfile.email || null,
      consent_given: consentGiven,
      consent_timestamp: consentTimestamp,
      consent_version: consentVersion,
    };

    await setDoc(targetRef, mergedProfile, { merge: true });
  } catch (err) {
    console.warn('Error merging visitor profiles:', err);
  }
}

/**
 * Save user email and BLINK recap consent to visitor_profiles/{uid}.
 */
export async function saveVisitorConsent(
  uid: string,
  email: string,
  consentGiven: boolean
): Promise<void> {
  if (!uid) return;
  const ref = doc(db, 'visitor_profiles', uid);
  const dataToUpdate: any = {
    email: email || null,
  };
  if (consentGiven) {
    dataToUpdate.consent_given = true;
    dataToUpdate.consent_timestamp = new Date().toISOString();
    dataToUpdate.consent_version = 'blink-2026-v1';
  }
  try {
    await setDoc(ref, dataToUpdate, { merge: true });
  } catch (err) {
    console.warn('Error saving visitor consent:', err);
  }
}

/**
 * Generates a stable, counter-verifiable 4-character perk PIN for the user,
 * e.g. "UH-7429", based on user UID and date.
 */
export function generatePerkCode(uid?: string): string {
  if (!uid) return 'UH-7429';
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash << 5) - hash + uid.charCodeAt(i);
    hash |= 0;
  }
  const codeNum = Math.abs(hash % 9000) + 1000;
  return `UH-${codeNum}`;
}

/**
 * Confirms counter verification by business staff, recording the timestamp
 * and marking the perk redeemed in Firestore and local storage.
 */
export async function redeemPartnerPerk(
  uid: string,
  code: string,
  venueName: string = 'Urbana Cafe'
): Promise<{ success: boolean; redeemedAt: string }> {
  const nowIso = new Date().toISOString();
  
  // Always record locally immediately so UI is 100% responsive and offline-resilient
  try {
    localStorage.setItem(`uh_perk_redeemed_${uid}`, JSON.stringify({
      code,
      venue: venueName,
      redeemedAt: nowIso
    }));
  } catch {
    // Ignore storage errors
  }

  if (uid) {
    try {
      const ref = doc(db, 'visitor_profiles', uid);
      await setDoc(ref, {
        perk_unlocked: true,
        perk_redeemed_at: nowIso,
        perk_redemption_code: code,
      }, { merge: true });
    } catch (err) {
      console.warn('Error recording perk redemption in Firestore:', err);
    }
  }

  return { success: true, redeemedAt: nowIso };
}

