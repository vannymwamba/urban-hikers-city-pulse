
import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';

export const CHPL_BRANCHES: Record<string, { lat: number, lng: number }> = {
  'Main Library': { lat: 39.1064, lng: -84.5125 },
  'Walnut Hills': { lat: 39.1287, lng: -84.4844 },
  'Corryville': { lat: 39.1333, lng: -84.5083 },
  'Northside': { lat: 39.1625, lng: -84.5375 },
  'Avondale': { lat: 39.1464, lng: -84.4925 },
  'Price Hill': { lat: 39.1089, lng: -84.5625 },
  'Westwood': { lat: 39.1467, lng: -84.5983 },
  'Hyde Park': { lat: 39.1414, lng: -84.4439 },
  'Oakley': { lat: 39.1539, lng: -84.4333 },
  'Pleasant Ridge': { lat: 39.1811, lng: -84.4267 },
  'Bond Hill': { lat: 39.1783, lng: -84.4683 },
  'Roselawn': { lat: 39.1911, lng: -84.4617 },
  'Hartwell': { lat: 39.2067, lng: -84.4750 },
  'College Hill': { lat: 39.2017, lng: -84.5450 },
  'Mt. Healthy': { lat: 39.2333, lng: -84.5500 },
  'Groesbeck': { lat: 39.2167, lng: -84.5917 },
  'Monfort Heights': { lat: 39.1833, lng: -84.6167 },
  'Cheviot': { lat: 39.1583, lng: -84.6133 },
  'Covedale': { lat: 39.1167, lng: -84.6083 },
  'Delhi Township': { lat: 39.0917, lng: -84.6167 },
  'Sayler Park': { lat: 39.1167, lng: -84.7000 },
  'Miami Township': { lat: 39.1667, lng: -84.7500 },
  'Harrison': { lat: 39.2667, lng: -84.8000 },
  'Green Township': { lat: 39.1583, lng: -84.6500 },
  'North Central': { lat: 39.2667, lng: -84.4500 },
  'Sharonville': { lat: 39.2667, lng: -84.4167 },
  'Blue Ash': { lat: 39.2333, lng: -84.3833 },
  'Deer Park': { lat: 39.2000, lng: -84.4000 },
  'Madeira': { lat: 39.1833, lng: -84.3667 },
  'Mariemont': { lat: 39.1417, lng: -84.3833 },
  'Anderson': { lat: 39.0667, lng: -84.3500 },
  'Mt. Washington': { lat: 39.0833, lng: -84.3833 },
  'Forest Park': { lat: 39.2500, lng: -84.5000 },
  'Greenhills': { lat: 39.2667, lng: -84.5167 },
  'Wyoming': { lat: 39.2250, lng: -84.4833 },
  'Reading': { lat: 39.2250, lng: -84.4417 },
  'St. Bernard': { lat: 39.1667, lng: -84.4917 },
  'Elmwood Place': { lat: 39.1833, lng: -84.4917 },
  'Norwood': { lat: 39.1583, lng: -84.4583 },
  'Madisonville': { lat: 39.1583, lng: -84.3917 },
  'Loveland': { lat: 39.2667, lng: -84.2500 },
  'Symmes Township': { lat: 39.2667, lng: -84.3167 },
};

import { Timestamp } from 'firebase/firestore';

function toFirestoreTimestamp(
  val: string | null | undefined,
  fallback: Date
): Timestamp {
  if (!val) return Timestamp.fromDate(fallback);
  const d = new Date(val);
  return isNaN(d.getTime())
    ? Timestamp.fromDate(fallback)
    : Timestamp.fromDate(d);
}

export async function fetchAndProcessCHPLEvents(db: any): Promise<any[]> {
  // Try API first
  const API_URL = 'https://cincinnatilibrary.bibliocommons.com/v2/events?locations=1&featured=true';
  const events: any[] = [];

  try {
    console.log(`FETCHING_CHPL_EVENTS: ${API_URL}`);
    const response = await axios.get(API_URL, {
      headers: {
        'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
        'Accept': 'application/json',
        'Referer': 'https://cincinnatilibrary.bibliocommons.com/events'
      },
      timeout: 10000
    });

    const isJson = response.headers['content-type']?.includes('application/json') || 
                   typeof response.data === 'object' ||
                   (typeof response.data === 'string' && (response.data.trim().startsWith('{') || response.data.trim().startsWith('[')));

    if (isJson) {
      let data = response.data;
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          throw new Error('API returned non-JSON response');
        }
      }
      const rawEvents = data.entities?.events || {};
      for (const id in rawEvents) {
        const evt = rawEvents[id];
        const branchName = evt.location?.name || 'Main Library';
        const coords = CHPL_BRANCHES[branchName] || CHPL_BRANCHES['Main Library'];
        
        events.push({
          title: evt.name,
          description: evt.description?.replace(/<[^>]*>?/gm, '') || '',
          starts_at: evt.start_datetime,
          expires_at: evt.end_datetime,
          venue: branchName,
          latitude: coords.lat,
          longitude: coords.lng,
          source: 'chpl',
          sourceHash: `chpl-${evt.id}`,
          sourceUrl: `https://cincinnatilibrary.bibliocommons.com/events/${evt.id}`
        });
      }
    } else {
      throw new Error('API returned non-JSON response');
    }
  } catch (error) {
    console.warn('CHPL API failed, falling back to scraping:', error instanceof Error ? error.message : String(error));
    try {
      const fallbackUrl = 'https://chpl.org/events/';
      const htmlResponse = await axios.get(fallbackUrl, {
        headers: { 'User-Agent': 'UrbanHikers/1.0' }
      });
      const $ = cheerio.load(htmlResponse.data);
      
      $('.tribe-events-pro-photo__event').each((_, el) => {
        const title = $(el).find('.tribe-events-pro-photo__event-title').text().trim();
        const event_url = $(el).find('.tribe-events-pro-photo__event-title-link').attr('href') || fallbackUrl;
        const description = $(el).find('.tribe-events-pro-photo__event-description').text().trim();
        const dateStr = $(el).find('.tribe-events-pro-photo__event-datetime').text().trim();
        
        const sourceHash = crypto.createHash('md5').update(title + dateStr).digest('hex');
        const now = new Date();
        const expires = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        
        if (title) {
          events.push({
            title,
            description,
            starts_at: now.toISOString(),
            expires_at: expires.toISOString(),
            venue: 'Main Library',
            latitude: CHPL_BRANCHES['Main Library'].lat,
            longitude: CHPL_BRANCHES['Main Library'].lng,
            source: 'chpl',
            sourceHash: `chpl-${sourceHash}`,
            sourceUrl: event_url
          });
        }
      });
    } catch (fallbackError) {
      console.error('CHPL_FALLBACK_SCRAPE_FAILED:', fallbackError);
    }
  }

  return events;
}
