// TTL INDEX REQUIRED: 
// Collection: broadcasts
// Field: expires_at (Ascending)
// Enable TTL in Firebase Console → Firestore → Indexes → TTL Policies
// This auto-deletes documents where expires_at < now()

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { Client } from "@googlemaps/google-maps-services-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import { fetchAndProcessCHPLEvents } from '../shared/chplIngestion.ts';

dotenv.config();

const mapsClient = new Client({});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

import { Timestamp } from 'firebase-admin/firestore';

function parseCivicDate(dateStr: string | null): Date | null {
  if (!dateStr) return null;

  // Try direct parse first
  const direct = new Date(dateStr);
  if (!isNaN(direct.getTime())) return direct;

  // Handle "April 24, 2026 @ 10:00 AM" format
  const cleaned = dateStr
    .replace('@', '')
    .replace(/\s+/g, ' ')
    .trim();
  const parsed = new Date(cleaned);
  if (!isNaN(parsed.getTime())) return parsed;

  // Handle "April 24, 2026" with no time → default noon
  const dateOnly = new Date(dateStr + ' 12:00:00');
  if (!isNaN(dateOnly.getTime())) return dateOnly;

  return null;
}

const RawEvent: any = null; // Placeholder as CHPL_BRANCHES was removed

interface RawEvent {
  title: string;
  description: string;
  starts_at: string;
  expires_at: string;
  venue: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  source: 'visit-cincy' | 'chpl';
  sourceHash: string;
  latitude?: number;
  longitude?: number;
}

interface EnrichedEvent {
  taxonomy_tags: string[];
  vibe_estimate: 'chill' | 'buzzing' | 'packed';
  short_description: string;
}

let cachedNodes: any[] | null = null;

function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8; // Earth radius in miles
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

async function fetchVisitCincyEvents(): Promise<RawEvent[]> {
  const events: RawEvent[] = [];
  try {
    const response = await axios.get('https://www.visitcincy.com/events/', {
      headers: {
        'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
        'Accept': 'text/html'
      }
    });

    const $ = cheerio.load(response.data);
    
    // Try multiple selectors as sites change
    const eventCards = $('.em-event, article.event, .event-card, .event-item, .event-list-item, article.slide, .featured-slide, .listing-item');
    console.log(`Visit Cincy Scraper: Found ${eventCards.length} potential event cards`);

    for (const element of eventCards.toArray()) {
      let title = $(element).find('h2, h3, h4, .title, .event-title').first().text().trim();
      let dateStr = $(element).find('.date, .time, .event-date, .event-time, .mini-date-section').first().text().trim().replace(/\s+/g, ' ');
      let venue = $(element).find('.location, .venue, .event-location, .event-venue, .item-city').first().text().trim();
      let sourceUrl = $(element).find('a').first().attr('href') || null;
      let imageUrl = $(element).find('img').first().attr('src') || $(element).find('img').first().attr('data-lazy-src') || null;

      // Try to extract from data-gtm-vars if available
      const gtmVars = $(element).find('[data-gtm-vars]').first().attr('data-gtm-vars');
      if (gtmVars) {
        try {
          const parsed = JSON.parse(gtmVars);
          const item = parsed.tClient_ga4;
          if (item) {
            if (item.itemName) title = item.itemName;
            if (item.itemCategory) venue = `${item.itemCategory} - ${item.itemCity || 'Cincinnati'}`;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (!title) continue;
      
      // If dateStr is empty but we have mini-date-section components
      if (!dateStr || dateStr.length < 2) {
        const month = $(element).find('.date-month').text().trim();
        const day = $(element).find('.date-day').text().trim();
        if (month && day) {
          dateStr = `${month} ${day}`;
        }
      }

      if (!title || !dateStr) continue;

      // Decode URL-encoded titles if necessary
      try {
        title = decodeURIComponent(title);
      } catch (e) {
        // Ignore errors
      }

      const sourceHash = crypto.createHash('md5').update(`${title}${dateStr}`).digest('hex');

      // Improved date parsing for visitcincy
      let cleanDateStr = dateStr.replace(/@/g, '').replace(/\s+/g, ' ');
      // If year is missing, append current year
      if (!cleanDateStr.match(/\d{4}/)) {
        cleanDateStr += ` ${new Date().getFullYear()}`;
      }
      
      let startTimeDate = new Date(cleanDateStr);
      let hasSpecificTime = !isNaN(startTimeDate.getTime()) && dateStr.includes(':');

      if (isNaN(startTimeDate.getTime())) {
        // Fallback: Try to extract date components if standard parsing fails
        const monthMatch = dateStr.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i);
        const dayMatch = dateStr.match(/\d{1,2}/);
        if (monthMatch && dayMatch) {
          const year = new Date().getFullYear();
          startTimeDate = new Date(`${monthMatch[0]} ${dayMatch[0]}, ${year}`);
          hasSpecificTime = false;
        } else {
          startTimeDate = new Date();
          hasSpecificTime = true; // Assume now
        }
      }

      // If no specific time was found, assume it's a day-long event and set expiry to end of day
      let endTime: Date;
      if (!hasSpecificTime) {
        endTime = new Date(startTimeDate);
        endTime.setHours(23, 59, 59, 999);
      } else {
        endTime = new Date(startTimeDate.getTime() + 4 * 60 * 60 * 1000);
      }

      if (endTime.getTime() < Date.now()) {
        console.log(`Visit Cincy Scraper: Skipping past event: ${title} (Expires: ${endTime.toISOString()})`);
        continue;
      }

      events.push({
        title,
        description: '', // Scraper doesn't easily get full description from list
        starts_at: startTimeDate.toISOString(),
        expires_at: endTime.toISOString(),
        venue,
        sourceUrl: sourceUrl ? (sourceUrl.startsWith('http') ? sourceUrl : `https://www.visitcincy.com${sourceUrl}`) : null,
        imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://www.visitcincy.com${imageUrl}`) : null,
        source: 'visit-cincy',
        sourceHash
      });
    }
  } catch (err) {
    console.error("fetchVisitCincyEvents Error:", err);
  }
  return events;
}

async function enrichEventWithAI(event: RawEvent): Promise<EnrichedEvent> {
  try {
    const prompt = `Given this Cincinnati event: Title: ${event.title}, Description: ${event.description}
Return JSON only with these fields:
{ 
  "taxonomy_tags": string[],  // pick from: Culture, Wellness, History, Food, Music, Art, Tech, Family, Sports, Civic
  "vibe_estimate": "chill" | "buzzing" | "packed",
  "short_description": string  // max 120 chars, punchy, present tense
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Strip markdown fences
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (!text) {
      console.warn(`Enrichment failed for ${event.title}: Gemini returned empty text`);
      return {
        taxonomy_tags: ['Civic'],
        vibe_estimate: 'chill',
        short_description: event.title
      };
    }

    try {
      const parsed = JSON.parse(text);
      return {
        taxonomy_tags: parsed.taxonomy_tags || ['Civic'],
        vibe_estimate: parsed.vibe_estimate || 'chill',
        short_description: parsed.short_description || event.title
      };
    } catch (parseErr) {
      console.error(`JSON parse failed for ${event.title}. Text: "${text}"`, parseErr);
      return {
        taxonomy_tags: ['Civic'],
        vibe_estimate: 'chill',
        short_description: event.title
      };
    }
  } catch (err) {
    console.error(`enrichEventWithAI Error for ${event.title}:`, err);
    return {
      taxonomy_tags: ['Civic'],
      vibe_estimate: 'chill',
      short_description: event.title
    };
  }
}

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function findAllHubsInRadius(
  lat: number,
  lng: number,
  db: admin.firestore.Firestore,
  maxMeters = 4828  // 3 miles
): Promise<{ node_id: string | null; node_ids: string[] }> {
  if (!lat || !lng) return { node_id: null, node_ids: [] }

  // Use cached nodes if available
  if (!cachedNodes) {
    const snap = await db.collection('nodes').get()
    cachedNodes = snap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }))
  }

  const matches = (cachedNodes || [])
    .filter(node => {
      if (!node.latitude || !node.longitude) return false
      const dist = haversineMeters(
        lat, lng, node.latitude, node.longitude
      )
      return dist <= maxMeters
    })
    .sort((a, b) => {
      const dA = haversineMeters(lat, lng, a.latitude, a.longitude)
      const dB = haversineMeters(lat, lng, b.latitude, b.longitude)
      return dA - dB
    })

  return {
    node_id:  matches[0]?.id || null,
    node_ids: matches.map(m => m.id),
  }
}

function toFirestoreTimestamp(val: string | null, fallback: Date): Timestamp {
  if (!val) return Timestamp.fromDate(fallback)
  const d = new Date(val)
  return isNaN(d.getTime()) ? Timestamp.fromDate(fallback) : Timestamp.fromDate(d)
}

async function writeEventToFirestore(event: RawEvent, enriched: EnrichedEvent, hubMatch: { node_id: string | null, node_ids: string[] }, db: admin.firestore.Firestore, batch: admin.firestore.WriteBatch) {
  // Skip if event has already ended
  const expiresMs = new Date(event.expires_at).getTime()
  if (expiresMs < Date.now()) {
    console.log('AGENT: Skipping past event:', event.title)
    return
  }

  const now      = new Date()
  const midnight = new Date()
  midnight.setHours(23, 59, 0, 0)

  const eventData: any = {
    // ── Core identity ────────────────────────
    title:                event.title,
    type:                 event.source === 'chpl' ? 'civic_free' : 'civic_event',
    status:               'active',
    source:               event.source,      // 'chpl' | 'visit-cincy'
    partner_id:           event.source,
    sourceHash:           event.sourceHash,
    sourceUrl:            event.sourceUrl || null,

    // ── Content ──────────────────────────────
    description:          enriched.short_description || event.description,
    original_description: event.description || null,
    cover_url:            event.imageUrl || null,
    taxonomy_tags:        enriched.taxonomy_tags || [],
    current_vibe:         enriched.vibe_estimate || 'chill',

    // ── Pricing — civic events always free ───
    price:                0,
    is_sponsored:         false,

    // ── Location ─────────────────────────────
    latitude:             event.latitude  || null,
    longitude:            event.longitude || null,
    address:              event.venue     || null,
    venue:                event.venue     || null,

    // ── Hub assignment ────────────────────────
    node_id:  hubMatch.node_id,
    node_ids: hubMatch.node_ids,
    scope:    hubMatch.node_ids.length > 0 ? 'multi_node' :
              hubMatch.node_id             ? 'specific_node' :
                                           'all_nodes',

    // ── Timing — always Firestore Timestamp ───
    starts_at:  toFirestoreTimestamp(event.starts_at, now),
    expires_at: toFirestoreTimestamp(event.expires_at, midnight),

    // Legacy ISO string copies for backward compat
    startsAt:  event.starts_at  || now.toISOString(),
    expiresAt: event.expires_at || midnight.toISOString(),

    // ── Flags ────────────────────────────────
    active:               true,
    is_admin_post:        false,
    payment_type:         'free',
    expiry_warning_sent:  false,

    // ── Analytics ────────────────────────────
    impressions:          0,
    taps:                 0,

    // ── Metadata ─────────────────────────────
    ingestedAt:           FieldValue.serverTimestamp(),
    updatedAt:            FieldValue.serverTimestamp(),
  }

  // Doc ID = sourceHash (MD5 of title + date + source)
  // merge:true → update if exists, create if new
  batch.set(db.collection('broadcasts').doc(event.sourceHash), eventData, { merge: true })
}

export async function runCivicIngestionEngine() {
  console.log("Civic Ingestion Engine: Starting...");
  
  const projectId = "gen-lang-client-0752567409";

  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: projectId
    });
  }

  const databaseId = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';
  const db = getFirestore(databaseId);
  console.log(`Civic Ingestion Engine: Using database ${databaseId}`);
  
  const [visitCincyRaw, chplRaw] = await Promise.all([
    fetchVisitCincyEvents(),
    fetchAndProcessCHPLEvents(db)
  ]);

  const allRawEvents = [...visitCincyRaw, ...chplRaw];
  console.log(`Civic Ingestion Engine: Found ${visitCincyRaw.length} raw visitCincy events and ${chplRaw.length} raw CHPL events.`);

  let visitCincyCount = 0;
  let chplCount = 0;
  let errorCount = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const event of allRawEvents) {
    try {
      // 1. Geocode if needed
      if (event.latitude === undefined || event.longitude === undefined) {
        const googleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
        if (googleMapsKey) {
          const geoResponse = await mapsClient.geocode({
            params: {
              address: `${event.venue}, Cincinnati, OH`,
              key: googleMapsKey,
            },
          });
          if (geoResponse.data.results.length > 0) {
            const loc = geoResponse.data.results[0].geometry.location;
            event.latitude = loc.lat;
            event.longitude = loc.lng;
          }
        }
      }

      if (event.latitude === undefined || event.longitude === undefined) {
        console.warn(`Skipping event ${event.title}: Could not resolve location.`);
        errorCount++;
        continue;
      }

      // 2. AI Enrichment
      const enriched = await enrichEventWithAI(event);
      await new Promise(resolve => setTimeout(resolve, 200)); // Rate limit

      // 3. Node Matching
      const hubMatch = await findAllHubsInRadius(event.latitude, event.longitude, db);

      // 4. Write to Firestore
      console.log(`Civic Ingestion: Writing event: ${event.title} (Source: ${event.source}, Hubs: ${hubMatch.node_ids.length})`);
      await writeEventToFirestore(event, enriched, hubMatch, db, batch);
      
      batchCount++;
      if (event.source === 'visit-cincy') visitCincyCount++;
      else chplCount++;

      if (batchCount >= 400) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    } catch (err) {
      console.error(`Error processing event ${event.title}:`, err);
      errorCount++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`Civic Ingestion Engine: Complete. VisitCincy: ${visitCincyCount}, CHPL: ${chplCount}, Errors: ${errorCount}`);
  
  const syncResult = {
    timestamp: FieldValue.serverTimestamp(),
    visitCincy: visitCincyCount,
    chpl: chplCount,
    total: visitCincyCount + chplCount,
    errors: errorCount,
    status: errorCount > 0 ? 'partial_success' : 'success'
  };

  try {
    await db.collection('sync_logs').add(syncResult);
  } catch (e) {
    console.error("Failed to write sync log:", e);
  }
  
  return syncResult;
}

// Legacy export for compatibility if needed
export const runVisitCincyAgent = runCivicIngestionEngine;
