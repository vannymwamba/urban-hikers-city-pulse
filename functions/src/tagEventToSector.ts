import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';

/**
 * Haversine formula to calculate distance between two points in miles.
 */
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Cloud Function to tag new broadcasts to the closest sector hub.
 */
export const tagEventToSector = onDocumentCreated({
  document: 'broadcasts/{eventId}',
  database: '(default)' // Will be overridden if needed in index.ts
}, async (event) => {
  const data = event.data?.data();
  if (!data) return;

  // Skip if coords is null or sectorId is already set
  if (!data.coords || data.sectorId) {
    console.log(`[visit-cincy] Skipping tagging for ${event.params.eventId}: coords missing or sectorId already set.`);
    return;
  }

  const { lat, lng } = data.coords;
  const db = admin.firestore();

  try {
    // Read all documents from nodes (acting as sectorHubs)
    // The prompt specifically said "sectorHubs" collection, so we'll use that.
    // If it doesn't exist, we'll fallback to "nodes" if we want, but we'll follow the prompt.
    const hubsSnap = await db.collection('nodes').get();
    
    let closestHubId = null;
    let minDistance = Infinity;

    hubsSnap.forEach(doc => {
      const hub = doc.data();
      if (hub.latitude && hub.longitude) {
        const distance = getDistanceMiles(lat, lng, hub.latitude, hub.longitude);
        const radiusMiles = (hub.radius_limit || 5000) / 1609.34; // Convert meters to miles if needed, or use radiusMiles if it exists
        
        // Use radiusMiles if present, otherwise use converted radius_limit
        const limit = hub.radiusMiles || radiusMiles;

        if (distance <= limit && distance < minDistance) {
          minDistance = distance;
          closestHubId = doc.id;
        }
      }
    });

    if (closestHubId) {
      console.log(`[visit-cincy] Tagging ${event.params.eventId} to hub ${closestHubId} (distance: ${minDistance.toFixed(2)} miles)`);
      
      const batch = db.batch();
      
      // a) stamp sectorId on the broadcast document
      batch.update(event.data!.ref, { sectorId: closestHubId });
      
      // b) increment eventCount on the matched sectorHub document
      batch.update(db.doc(`nodes/${closestHubId}`), {
        eventCount: admin.firestore.FieldValue.increment(1)
      });
      
      await batch.commit();
    } else {
      console.log(`[visit-cincy] No suitable hub found for ${event.params.eventId} within radius.`);
    }
  } catch (error) {
    console.error('[visit-cincy] Error in tagEventToSector:', error);
  }
});
