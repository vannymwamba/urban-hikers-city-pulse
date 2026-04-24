import * as admin from 'firebase-admin';
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

export async function fetchAndProcessCHPLEvents(db: admin.firestore.Firestore): Promise<{ count: number, errors: number }> {
  // Try API first
  const API_URL = 'https://cincinnatilibrary.bibliocommons.com/v2/events?locations=1&featured=true';
  let count = 0;
  let errors = 0;
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

    if (response.headers['content-type']?.includes('application/json')) {
      const data = response.data;
      const rawEvents = data.entities?.events || {};
      for (const id in rawEvents) {
        const evt = rawEvents[id];
        events.push({
          id: String(evt.id),
          title: evt.name,
          description: evt.description?.replace(/<[^>]*>?/gm, '') || '',
          start_datetime: evt.start_datetime,
          end_datetime: evt.end_datetime,
          location: { name: evt.location?.name || 'Main Library' }
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
        
        const id = crypto.createHash('md5').update(title + dateStr).digest('hex');
        const now = new Date();
        
        if (title) {
          events.push({
            id,
            title,
            description,
            start_datetime: now.toISOString(),
            end_datetime: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
            location: { name: 'CHPL Branch' }
          });
        }
      });
    } catch (fallbackError) {
      console.error('CHPL_FALLBACK_SCRAPE_FAILED:', fallbackError);
    }
  }

  if (events.length === 0) {
    console.log('NO_CHPL_EVENTS_FOUND_TO_PROCESS');
    return { count: 0, errors: 0 };
  }

  try {
    console.log(`PROCESSING_${events.length}_CHPL_EVENTS`);
    const batch = db.batch();

    for (const evt of events) {
      try {
        if (!evt.id || !evt.title || !evt.start_datetime || !evt.end_datetime) {
          console.warn(`SKIPPING_INVALID_EVENT: ${evt.id || 'NO_ID'}`, evt.title);
          errors++;
          continue;
        }

        const startsAt = new Date(evt.start_datetime);
        const expiresAt = new Date(evt.end_datetime);

        if (isNaN(startsAt.getTime()) || isNaN(expiresAt.getTime())) {
          console.warn(`SKIPPING_INVALID_DATES: ${evt.id}`);
          errors++;
          continue;
        }

        // Only ingest future or ongoing events
        if (expiresAt.getTime() < Date.now()) {
          continue;
        }

        const branchName = evt.location?.name || 'Main Library';
        const coords = CHPL_BRANCHES[branchName] || CHPL_BRANCHES['Main Library'];
        
        const broadcastId = `chpl-${evt.id}`;
        const broadcastRef = db.collection('broadcasts').doc(broadcastId);

        batch.set(broadcastRef, {
          title: evt.title,
          description: evt.description || '',
          starts_at: startsAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          current_vibe: 'chill',
          type: 'civic_free',
          partner_id: 'chpl',
          latitude: coords.lat,
          longitude: coords.lng,
          address: branchName,
          active: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        count++;
        if (count >= 500) break; // Firestore batch limit
      } catch (innerErr) {
        console.error(`ERROR_PROCESSING_EVENT: ${evt.id}`, innerErr);
        errors++;
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`INGEST_SUCCESS: ${count} CHPL_EVENTS_SYNCED`);
    }

    return { count, errors };
  } catch (error) {
    console.error('CHPL_INGESTION_FAILURE:', error);
    throw error;
  }
}
