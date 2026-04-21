// TTL INDEX REQUIRED: 
// Collection: signals
// Field: expires_at (Ascending)
// Enable TTL in Firebase Console → Firestore → Indexes → TTL Policies
// This auto-deletes documents where expires_at < now()

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const LIBRARY_FALLBACK_IMAGES: Record<string, string> = {
  default: 'https://cincinnatilibrary.bibliocommons.com/events/uploads/images/full/86624327f9dd8f925da4e06c95462492/events-cooking-food.png',
  local:   '/library-fallback.jpg'
};

function getLibraryFallback(): string {
  return LIBRARY_FALLBACK_IMAGES.default;
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// Firestore instance targeting the specific named database
let db: admin.firestore.Firestore;

function initDb() {
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0752567409"
    });
  }
  
  // prioritising the config for the correct named database instance
  let databaseId: string | undefined = undefined;
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath) && fs.statSync(configPath).size > 0) {
      const content = fs.readFileSync(configPath, 'utf8');
      if (content && content.trim()) {
        const config = JSON.parse(content);
        if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
          databaseId = config.firestoreDatabaseId;
        }
      }
    }
  } catch (e) {
    console.warn("Library Agent: Failed to read database config", e);
  }
  
  db = getFirestore(databaseId);
  console.log(`Library Agent: Initialized with DB: ${databaseId || '(default)'}`);
}

interface LibraryEvent {
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  location_name: string;
  location_address: string;
  category: string;
  registration_required: boolean;
  event_url: string;
  image_url: string;
  source_id: string;
}

interface EnrichedSignal {
  signal_title: string;
  signal_vibe: 'CHILL' | 'BUZZING' | 'PACKED';
  signal_category: 'CIVIC_EVENT' | 'WALKING_EVENT' | 'COMMUNITY' | 'KIDS' | 'WORKSHOP' | 'PERFORMANCE';
  short_description: string;
  walking_relevance_score: number;
  nearest_hub_hint: string;
}

/**
 * PHASE 1 — FETCH
 */
async function fetchLibraryEvents(): Promise<LibraryEvent[]> {
  const events: LibraryEvent[] = [];
  const apiUrl = 'https://cincinnatilibrary.bibliocommons.com/v2/events?locations=1&featured=true';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; UrbanHikersBot/1.0)',
    'Accept': 'application/json',
    'Referer': 'https://cincinnatilibrary.bibliocommons.com/events'
  };

  try {
    console.log(`Library Agent: Fetching from API: ${apiUrl}`);
    const response = await axios.get(apiUrl, { headers, timeout: 10000 });
    
    if (response.headers['content-type']?.includes('application/json')) {
      const data = response.data;
      const rawEvents = data.entities?.events || {};
      
      for (const id in rawEvents) {
        const evt = rawEvents[id];
        events.push({
          title: evt.name,
          description: evt.description?.replace(/<[^>]*>?/gm, '') || '',
          start_datetime: evt.start_datetime,
          end_datetime: evt.end_datetime,
          location_name: evt.location?.name || 'Cincinnati Public Library',
          location_address: evt.location?.address || '',
          category: evt.audiences?.[0]?.name || 'All Ages',
          registration_required: !!evt.registration_required,
          event_url: `https://cincinnatilibrary.bibliocommons.com/events/${evt.id}`,
          image_url: evt.image_url || 
                     evt.cover_image?.url || 
                     evt.images?.[0]?.url || 
                     evt.thumbnail_url || 
                     '',
          source_id: String(evt.id)
        });
      }
    } else {
      throw new Error('Endpoint returned non-JSON response');
    }
  } catch (error) {
    console.warn('Library Agent: Primary API failed, falling back to public events page scraping.', error instanceof Error ? error.message : '');
    try {
      const fallbackUrl = 'https://chpl.org/events/';
      const htmlResponse = await axios.get(fallbackUrl, { headers });
      const $ = cheerio.load(htmlResponse.data);
      
      $('.tribe-events-pro-photo__event').each((_, el) => {
        const title = $(el).find('.tribe-events-pro-photo__event-title').text().trim();
        const event_url = $(el).find('.tribe-events-pro-photo__event-title-link').attr('href') || fallbackUrl;
        const description = $(el).find('.tribe-events-pro-photo__event-description').text().trim();
        const image_url = $(el).find('.tribe-events-pro-photo__event-featured-image').attr('src') || '';
        const dateStr = $(el).find('.tribe-events-pro-photo__event-datetime').text().trim();
        
        // Simple hash for fallback source_id
        const source_id = crypto.createHash('md5').update(title + dateStr).digest('hex');
        
        // Basic date estimation for scraper if full ISO isn't available
        const now = new Date();
        const start_datetime = now.toISOString();
        const end_datetime = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

        if (title) {
          events.push({
            title,
            description,
            start_datetime,
            end_datetime,
            location_name: 'CHPL Branch',
            location_address: 'Cincinnati, OH',
            category: 'General',
            registration_required: false,
            event_url,
            image_url,
            source_id
          });
        }
      });
    } catch (fallbackError) {
      console.error('Library Agent: Fallback scraping also failed.', fallbackError);
    }
  }

  return events;
}

/**
 * PHASE 2 — ENRICH (Gemini AI)
 */
async function enrichEvent(event: LibraryEvent): Promise<EnrichedSignal | null> {
  try {
    const prompt = `You are enriching a civic event for a hyper-local city discovery platform called Urban Hikers. Given this raw event data: ${JSON.stringify(event)}, return a JSON object with:
- signal_title: punchy 5-7 word title
- signal_vibe: one of [CHILL, BUZZING, PACKED]
- signal_category: one of [CIVIC_EVENT, WALKING_EVENT, COMMUNITY, KIDS, WORKSHOP, PERFORMANCE]
- short_description: 2 sentences max, energetic tone
- walking_relevance_score: 1-10 (how relevant is this to someone on a walking tour nearby?)
- nearest_hub_hint: which Cincinnati neighborhood does this belong to? (OTR, Downtown, Findlay Market, The Banks, Covington, Newport, Northside)

Return only valid JSON, no markdown.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean JSON from potential markdown markers
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    if (!text) {
      console.warn(`Library Agent: Gemini returned empty text for ${event.title}`);
      return null;
    }

    try {
      return JSON.parse(text) as EnrichedSignal;
    } catch (parseError) {
      console.error(`Library Agent: JSON parse failed for ${event.title}. Text: "${text}"`, parseError);
      return null;
    }
  } catch (error) {
    console.error(`Library Agent: Enrichment failed for ${event.title}`, error);
    return null;
  }
}

/**
 * PHASE 3 — INGEST TO FIRESTORE
 */
export async function runLibraryIngestionAgent() {
  initDb();
  
  const MAX_PER_RUN = 3;
  const summary = {
    total_fetched: 0,
    total_enriched: 0,
    total_written: 0,
    total_skipped_duplicates: 0,
    errors: [] as string[]
  };

  try {
    const rawEvents = await fetchLibraryEvents();
    summary.total_fetched = rawEvents.length;

    const downtownEvents = rawEvents.filter(evt =>
      evt.location_name.toLowerCase().includes('downtown') ||
      evt.location_name.toLowerCase().includes('main')
    );

    for (const rawEvent of downtownEvents) {
      try {
        const eventStart = new Date(rawEvent.start_datetime);
        if (isNaN(eventStart.getTime()) || eventStart < new Date()) continue;

        // DEDUPLICATION
        const existingDoc = await db.collection('broadcasts')
          .where('source', '==', 'cincinnati_library')
          .where('source_id', '==', rawEvent.source_id)
          .limit(1)
          .get();

        if (!existingDoc.empty) {
          summary.total_skipped_duplicates++;
          continue;
        }

        const enriched = await enrichEvent(rawEvent);
        if (enriched) summary.total_enriched++;

        const startTimestamp = Timestamp.fromDate(new Date(rawEvent.start_datetime || Date.now()));
        const endTimestamp = Timestamp.fromDate(new Date(rawEvent.end_datetime || Date.now()));

        const documentData = {
          source: 'cincinnati_library',
          source_id: rawEvent.source_id,
          title: enriched?.signal_title || rawEvent.title,
          vibe: enriched?.signal_vibe || 'CHILL',
          type: enriched?.signal_category || 'CIVIC_EVENT',
          description: enriched?.short_description || rawEvent.description.slice(0, 150),
          location_name: rawEvent.location_name,
          location_address: rawEvent.location_address,
          nearest_hub: enriched?.nearest_hub_hint || '',
          walking_relevance_score: enriched?.walking_relevance_score || 0,
          start_datetime: startTimestamp,
          end_datetime: endTimestamp,
          expires_at: endTimestamp, // same as end_datetime
          registration_required: rawEvent.registration_required,
          booking_url: rawEvent.event_url,
          cover_url: (rawEvent.image_url && rawEvent.image_url.trim() !== '')
            ? rawEvent.image_url          
            : getLibraryFallback(),
          scope:      'all_nodes',
          latitude:   39.1031,
          longitude:  -84.5120,
          venue:      'Cincinnati Public Library',
          address:    '800 Vine St, Cincinnati, OH 45202',
          partner_id: 'cincinnati-public-library',
          created_at: FieldValue.serverTimestamp(),
          node_id: null, // geocoded later
          is_active: true
        };

        await db.collection('broadcasts').add(documentData);
        summary.total_written++;

        if (summary.total_written >= MAX_PER_RUN) break;

      } catch (innerError) {
        console.error(`Library Agent: Error processing event ${rawEvent.source_id}`, innerError);
        summary.errors.push(`Event ${rawEvent.source_id}: ${innerError instanceof Error ? innerError.message : String(innerError)}`);
      }
    }
  } catch (outerError) {
    console.error('Library Agent: Fatal pipeline error', outerError);
    summary.errors.push(`Fatal Error: ${outerError instanceof Error ? outerError.message : String(outerError)}`);
  }

  return summary;
}
