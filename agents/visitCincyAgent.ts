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

async function matchAddressToNode(lat: number, lng: number, db: admin.firestore.Firestore): Promise<string | null> {
  if (!cachedNodes) {
    const nodesSnap = await db.collection('nodes').get();
    cachedNodes = nodesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  let closestNodeId: string | null = null;
  let minDistance = Infinity;

  for (const node of cachedNodes) {
    const distanceMeters = getDistanceMiles(lat, lng, node.latitude, node.longitude) * 1609.34; // Convert miles to meters
    const radiusLimit = node.radius_limit || 500;
    
    if (distanceMeters <= radiusLimit) {
      if (distanceMeters < minDistance) {
        minDistance = distanceMeters;
        closestNodeId = node.id;
      }
    }
  }

  return closestNodeId;
}

async function writeEventToFirestore(event: RawEvent, enriched: EnrichedEvent, nodeId: string | null, db: admin.firestore.Firestore, batch: admin.firestore.WriteBatch) {
  const broadcastRef = db.collection('broadcasts').doc(event.sourceHash);
  
  const data = {
    title: event.title,
    description: enriched.short_description,
    original_description: event.description,
    type: event.source === 'chpl' ? 'civic_free' : 'civic_event',
    partner_id: event.source,
    source: event.source,
    sourceHash: event.sourceHash,
    sourceUrl: event.sourceUrl,
    imageUrl: event.imageUrl,
    latitude: event.latitude,
    longitude: event.longitude,
    node_id: nodeId,
    starts_at: event.starts_at,
    expires_at: event.expires_at,
    current_vibe: enriched.vibe_estimate,
    taxonomy_tags: enriched.taxonomy_tags,
    active: true,
    ingestedAt: FieldValue.serverTimestamp()
  };

  batch.set(broadcastRef, data, { merge: true });
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
  
  // CHPL sync is now handled by the shared module directly
  const [visitCincyRaw, chplResult] = await Promise.all([
    fetchVisitCincyEvents(),
    fetchAndProcessCHPLEvents(db)
  ]);

  const allRawEvents = [...visitCincyRaw];
  console.log(`Civic Ingestion Engine: Found ${allRawEvents.length} raw visitCincy events. CHPL: ${chplResult.count} processed.`);

  let visitCincyCount = 0;
  let chplCount = chplResult.count;
  let errorCount = chplResult.errors;
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
      const nodeId = await matchAddressToNode(event.latitude, event.longitude, db);

      // 4. Write to Firestore
      console.log(`Civic Ingestion: Writing event: ${event.title} (Source: ${event.source}, Node: ${nodeId || 'None'})`);
      await writeEventToFirestore(event, enriched, nodeId, db, batch);
      
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
