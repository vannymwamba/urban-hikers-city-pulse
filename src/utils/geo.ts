/**
 * Calculates the distance between two points in meters using the Haversine formula.
 */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates straight-line distance in miles.
 */
export function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return (getDistance(lat1, lon1, lat2, lon2) / 1609.344);
}

/**
 * Calculates initial compass bearing in degrees (0 - 360) from point 1 to point 2.
 */
export function getBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360;
}

/**
 * Returns 8-point cardinal direction string (e.g., 'North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW').
 */
export function getCardinalDirection(bearingDeg: number): string {
  const directions = ['North', 'NE', 'East', 'SE', 'South', 'SW', 'West', 'NW'];
  const index = Math.round(bearingDeg / 45) % 8;
  return directions[index];
}

export interface NextStepDirections {
  distanceStr: string;      // e.g. "180 yd North" or "0.4 mi NE"
  distanceRawMi: number;
  walkMins: number;         // estimated walking minutes
  cardinal: string;         // e.g. "North"
  bearing: number;          // 0-360 deg
  summary: string;          // e.g. "180 yd North · 2 min"
  googleMapsUrl: string;    // Direct walking directions URL
  appleMapsUrl: string;
}

/**
 * Produces user-facing directions summary and maps links matching the prompt specification:
 * e.g., "180 yd North · 2 min" or "0.3 mi East · 5 min"
 */
export function formatNextStepDirections(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  destinationName?: string
): NextStepDirections {
  const distMeters = getDistance(fromLat, fromLon, toLat, toLon);
  const distMiles = distMeters / 1609.344;
  const bearing = getBearing(fromLat, fromLon, toLat, toLon);
  const cardinal = getCardinalDirection(bearing);

  // Use yards if under 440 yards (0.25 mi), otherwise miles
  const yards = Math.round(distMeters * 1.09361);
  let distanceStr: string;
  if (yards <= 440) {
    distanceStr = `${Math.max(20, Math.round(yards / 10) * 10)} yd ${cardinal}`;
  } else {
    distanceStr = `${distMiles.toFixed(1)} mi ${cardinal}`;
  }

  // Average walking pace: ~20 minutes per mile (~3 mph)
  const walkMins = Math.max(1, Math.round(distMiles * 20));
  const summary = `${distanceStr} · ${walkMins} min`;

  const destQuery = destinationName
    ? `${toLat},${toLon} (${encodeURIComponent(destinationName)})`
    : `${toLat},${toLon}`;

  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${destQuery}&travelmode=walking`;
  const appleMapsUrl = `https://maps.apple.com/?saddr=${fromLat},${fromLon}&daddr=${destQuery}&dirflg=w`;

  return {
    distanceStr,
    distanceRawMi: distMiles,
    walkMins,
    cardinal,
    bearing,
    summary,
    googleMapsUrl,
    appleMapsUrl,
  };
}

