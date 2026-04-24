import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { getDistance } from './geo';

/**
 * Geocodes an address using Nominatim (OpenStreetMap).
 */
export async function geocodeAddress(
  address: string
): Promise<{ lat: number; lng: number } | null> {
  try {
    const encoded = encodeURIComponent(address);
    const url = `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'UrbanHikers/1.0' }
    });
    
    if (!res.ok) return null;
    
    const data = await res.json();

    if (!data[0]) return null;

    return {
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
    };
  } catch (error) {
    console.error('GEOCODE_FAILED:', error);
    return null;
  }
}

/**
 * Interface for matches hubs in a radius
 */
export interface HubMatch {
  id:       string;
  name:     string;
  distance: number; // meters
}

/**
 * Finds all hubs (nodes) within a specified radius.
 */
export async function findHubsInRadius(
  lat: number,
  lng: number,
  maxRadiusMeters = 4828  // 3 miles
): Promise<HubMatch[]> {
  try {
    const snap = await getDocs(collection(db, 'nodes'));

    const matches: HubMatch[] = [];

    snap.docs.forEach(doc => {
      const hub = doc.data();
      if (!hub.latitude || !hub.longitude) return;

      const dist = getDistance(
        lat, lng,
        hub.latitude, hub.longitude
      );

      if (dist <= maxRadiusMeters) {
        matches.push({
          id:       doc.id,
          name:     hub.name || doc.id,
          distance: dist,
        });
      }
    });

    // Sort by distance — closest first
    return matches.sort((a, b) => a.distance - b.distance);

  } catch (error) {
    console.error('findHubsInRadius failed:', error);
    return [];
  }
}
