import { 
  doc, 
  getDoc, 
  setDoc, 
  runTransaction, 
  arrayUnion 
} from 'firebase/firestore';
import { db } from '../firebase';
import type { VisitorProfile, JourneyStop } from '../types';

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
}

/**
 * Record a tap into visitor_profiles/{uid} using a Firestore transaction.
 * - Distance: straight-line distance from previous stop * 1.3
 * - Skip segment if under 50m or more than 3 hours after previous tap.
 * - Caps journey_stops at 50 stops.
 * - Deduplicates artists, locations, and neighborhoods via arrayUnion.
 */
export async function recordVisitorTapTransaction(
  uid: string,
  stop: TapStopInput
): Promise<void> {
  if (!uid) return;

  const profileRef = doc(db, 'visitor_profiles', uid);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(profileRef);
      const newStop: JourneyStop = {
        artist_id: stop.artist_id || null,
        location_id: stop.location_id || null,
        neighborhood: stop.neighborhood || null,
        lat: typeof stop.lat === 'number' ? stop.lat : null,
        lng: typeof stop.lng === 'number' ? stop.lng : null,
        first_tapped_at: nowIso,
      };

      if (!snap.exists()) {
        const initialProfile: VisitorProfile = {
          artists_discovered_ids: stop.artist_id ? [stop.artist_id] : [],
          locations_visited_ids: stop.location_id ? [stop.location_id] : [],
          neighborhoods_visited: stop.neighborhood ? [stop.neighborhood] : [],
          total_miles_explored: 0,
          journey_stops: [newStop],
          favorite_artist_id: stop.artist_id || null,
          first_tap_at: nowIso,
          last_tap_at: nowIso,
          email: null,
          consent_given: false,
          consent_timestamp: null,
          consent_version: null,
        };
        tx.set(profileRef, initialProfile);
        return;
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

      const updatePayload: any = {
        total_miles_explored: updatedMiles,
        journey_stops: updatedStops,
        last_tap_at: nowIso,
        first_tap_at: existing.first_tap_at || nowIso,
        favorite_artist_id: existing.favorite_artist_id || stop.artist_id || null,
      };

      if (stop.artist_id) {
        updatePayload.artists_discovered_ids = arrayUnion(stop.artist_id);
      }
      if (stop.location_id) {
        updatePayload.locations_visited_ids = arrayUnion(stop.location_id);
      }
      if (stop.neighborhood) {
        updatePayload.neighborhoods_visited = arrayUnion(stop.neighborhood);
      }

      tx.update(profileRef, updatePayload);
    });
  } catch (err) {
    console.warn('Error recording visitor tap transaction:', err);
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
