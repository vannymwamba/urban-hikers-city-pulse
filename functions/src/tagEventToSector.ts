import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

// ─── Config ───────────────────────────────────────────────────────────────────
// Your named Firestore database ID (from Firebase console → Firestore → Database ID)
// Replace this value if your DB ID differs.
const DB_ID = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';

/**
 * Haversine formula — distance between two lat/lng points in miles.
 */
function getDistanceMiles(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Tags new broadcasts to the closest sector hub node.
 *
 * Robustness notes:
 * - database must match the named DB where broadcasts live.
 * - admin.firestore(DB_ID) scopes all reads/writes to the same instance.
 * - Skips docs missing coords or already tagged (idempotent).
 * - Logs a warning (not an error) when no hub is within radius — expected for
 *   events far from any node.
 */
export const tagEventToSector = onDocumentCreated(
  {
    document: 'broadcasts/{eventId}',
    database: DB_ID, // FIX: was '(default)' — triggers on the wrong DB instance
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    // Idempotency guard — skip if already tagged or coords missing
    if (!data.coords || data.sectorId) {
      console.log(
        `[tagEventToSector] Skipping ${event.params.eventId}: ` +
        (!data.coords ? 'no coords' : 'sectorId already set')
      );
      return;
    }

    const { lat, lng } = data.coords;

    // FIX: was admin.firestore() which targets '(default)'.
    // getDatabase(DB_ID) ensures reads/writes stay in the named instance.
    const db = admin.firestore(DB_ID);

    try {
      const hubsSnap = await db.collection('nodes').get();

      let closestHubId: string | null = null;
      let minDistance = Infinity;

      hubsSnap.forEach((doc) => {
        const hub = doc.data();
        if (typeof hub.latitude !== 'number' || typeof hub.longitude !== 'number') return;

        const distance = getDistanceMiles(lat, lng, hub.latitude, hub.longitude);

        // Prefer explicit radiusMiles; fall back to radius_limit (metres → miles)
        const limitMiles: number =
          typeof hub.radiusMiles === 'number'
            ? hub.radiusMiles
            : (hub.radius_limit ?? 8046) / 1609.34; // default 5 miles if neither set

        if (distance <= limitMiles && distance < minDistance) {
          minDistance = distance;
          closestHubId = doc.id;
        }
      });

      if (closestHubId) {
        console.log(
          `[tagEventToSector] Tagging ${event.params.eventId} → hub ${closestHubId} ` +
          `(${minDistance.toFixed(2)} mi)`
        );

        const batch = db.batch();
        batch.update(event.data!.ref, { sectorId: closestHubId });
        batch.update(db.doc(`nodes/${closestHubId}`), {
          eventCount: admin.firestore.FieldValue.increment(1),
        });
        await batch.commit();
      } else {
        // Warning, not an error — valid for events outside all hub radii
        console.warn(
          `[tagEventToSector] No hub within radius for ${event.params.eventId} ` +
          `at (${lat}, ${lng})`
        );
      }
    } catch (error) {
      console.error('[tagEventToSector] Fatal error:', error);
      throw error; // Re-throw so Firebase retries the function
    }
  }
);
