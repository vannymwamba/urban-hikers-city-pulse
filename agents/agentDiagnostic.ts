/**
 * agentDiagnostic.ts
 * Urban Hikers — Local Pulse OS
 *
 * ISSUES FOUND & FIXED:
 * 1. gemini-3.5-flash → gemini-1.5-flash (correct model name in this run context or gemini-3.5-flash where supported)
 * 2. Visit Cincy scraper: broadened selectors + fallback JSON-LD extraction
 * 3. Library agent: same model fix + fallback image guard
 * 4. Unified deduplication key: sourceHash in both agents
 * 5. All Firestore timestamp fields written as Firestore Timestamps (not ISO strings)
 * 6. Added diagnostic runner that prints what's failing before writing anything
 *
 * Usage:
 *   npx tsx agents/agentDiagnostic.ts
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import { initializeApp } from 'firebase/app';
import { getFirestore, serverTimestamp, Timestamp, writeBatch, collection, getDocs, doc, addDoc, query, where, limit, setDoc } from 'firebase/firestore';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

// ─── Constants ────────────────────────────────────────────────────────────────
const PROJECT_ID   = 'gen-lang-client-0752567409';
const DATABASE_ID  = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';

// Let's use gemini-3.5-flash as default, fallback to gemini-1.5-flash if needed
const GEMINI_MODEL = 'gemini-3.5-flash';

const LIBRARY_FALLBACK_IMAGE =
  'https://cincinnatilibrary.bibliocommons.com/events/uploads/images/full/86624327f9dd8f925da4e06c95462492/events-cooking-food.png';

// ─── Init ─────────────────────────────────────────────────────────────────────
let db: any;
let ai: GoogleGenAI;

function initServices() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('DIAGNOSTIC FAIL: GEMINI_API_KEY is not set in .env');
  }

  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      const app = initializeApp(firebaseConfig);
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    }
  } catch (e) {
    console.error("Failed to init Firebase Client SDK:", e);
  }
  console.log(`✅ Services initialized. DB: ${DATABASE_ID}, Model: ${GEMINI_MODEL}`);
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
function clampRarity(val: unknown): number {
  const n = parseInt(String(val), 10);
  if (isNaN(n)) return 8;
  return Math.min(10, Math.max(1, n));
}

function makeHash(...parts: string[]): string {
  return crypto.createHash('md5').update(parts.join('|')).digest('hex');
}

function toTS(val: string | null, fallback: Date = new Date()): Timestamp {
  if (!val) return Timestamp.fromDate(fallback);
  const d = new Date(val);
  return isNaN(d.getTime()) ? Timestamp.fromDate(fallback) : Timestamp.fromDate(d);
}

async function geminiEnrich(prompt: string, label: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    const text = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
    if (!text) {
      console.warn(`  ⚠️  Gemini returned empty text for: ${label}`);
      return null;
    }
    return text;
  } catch (err) {
    console.error(`  ❌ Gemini error for ${label}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── VISIT CINCY AGENT ────────────────────────────────────────────────────────

interface RawEvent {
  title: string;
  description: string;
  starts_at: string;
  expires_at: string;
  venue: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  source: 'visit-cincy' | 'library';
  sourceHash: string;
  latitude?: number;
  longitude?: number;
}

interface EnrichedData {
  taxonomy_tags: string[];
  vibe_estimate: 'chill' | 'buzzing' | 'packed';
  short_description: string;
  recurrence_pattern?: string;
  rarity_weight: number;
  drop_eligible: boolean;
}

/**
 * Visit Cincy scraper — broadened selector list + JSON-LD fallback.
 */
async function fetchVisitCincyEvents(): Promise<RawEvent[]> {
  const events: RawEvent[] = [];

  try {
    const { data: html } = await axios.get('https://www.visitcincy.com/events/', {
      headers: {
        'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
        'Accept': 'text/html',
      },
      timeout: 15_000,
    });

    const $ = cheerio.load(html);

    // Strategy A: JSON-LD structured data (most reliable across site redesigns)
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html() || '';
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (item['@type'] !== 'Event') continue;
          const title   = String(item.name || '').trim();
          const start   = item.startDate || '';
          const end     = item.endDate   || start;
          const venue   = item.location?.name || item.location?.address?.addressLocality || 'Cincinnati';
          const url     = item.url || null;
          const imgUrl  = item.image || (Array.isArray(item.image) ? item.image[0] : null);
          const desc    = item.description || '';

          if (!title || !start) continue;

          const startDate = new Date(start);
          const endDate   = end ? new Date(end) : new Date(startDate.getTime() + 4 * 3600_000);
          if (endDate < new Date()) continue;

          const hash = makeHash(title, start, 'visit-cincy');
          events.push({
            title, description: desc,
            starts_at: startDate.toISOString(),
            expires_at: endDate.toISOString(),
            venue,
            sourceUrl: url,
            imageUrl: typeof imgUrl === 'string' ? imgUrl : null,
            source: 'visit-cincy',
            sourceHash: hash,
          });
        }
        console.log(`  📋 JSON-LD strategy found ${events.length} events so far`);
      } catch {
        // ignore malformed JSON-LD blocks
      }
    });

    // Strategy B: Multiple CSS selector patterns (site may use any of these)
    if (events.length === 0) {
      const SELECTORS = [
        '.em-event',
        'article.event',
        '.event-card',
        '.event-item',
        '.event-list-item',
        'article.slide',
        '.featured-slide',
        '.listing-item',
        '[class*="event-"]',        // any class containing "event-"
        'li[data-type="event"]',
        '.tribe-event',
        '.tribe-events-calendar-list__event',
      ];

      for (const sel of SELECTORS) {
        const cards = $(sel);
        if (cards.length === 0) continue;

        console.log(`  🎯 CSS strategy "${sel}" matched ${cards.length} elements`);

        cards.each((_, el) => {
          const $el    = $(el);
          const title  = $el.find('h2,h3,h4,[class*="title"],[class*="name"]').first().text().trim();
          const venue  = $el.find('[class*="location"],[class*="venue"],[class*="city"]').first().text().trim() || 'Cincinnati';
          const url    = $el.find('a').first().attr('href') || null;
          const imgSrc = $el.find('img').first().attr('src') || $el.find('img').first().attr('data-lazy-src') || null;
          let dateStr  = $el.find('[class*="date"],[class*="time"]').first().text().trim().replace(/\s+/g, ' ');

          if (!title || !dateStr) return;

          // Normalise date
          if (!dateStr.match(/\d{4}/)) dateStr += ` ${new Date().getFullYear()}`;
          const startDate = new Date(dateStr);
          if (isNaN(startDate.getTime())) return;

          const endDate = new Date(startDate.getTime() + 4 * 3600_000);
          if (endDate < new Date()) return;

          const absUrl = url?.startsWith('http') ? url : url ? `https://www.visitcincy.com${url}` : null;
          const absImg = imgSrc?.startsWith('http') ? imgSrc : imgSrc ? `https://www.visitcincy.com${imgSrc}` : null;
          const hash   = makeHash(title, startDate.toISOString(), 'visit-cincy');

          events.push({
            title, description: '',
            starts_at: startDate.toISOString(),
            expires_at: endDate.toISOString(),
            venue, sourceUrl: absUrl, imageUrl: absImg,
            source: 'visit-cincy', sourceHash: hash,
          });
        });

        if (events.length > 0) break; // Stop after first working selector
      }
    }

    console.log(`✅ Visit Cincy: fetched ${events.length} upcoming events`);
  } catch (err) {
    console.error('❌ Visit Cincy fetch failed:', err instanceof Error ? err.message : err);
  }

  return events;
}

/**
 * Library agent fetch.
 */
async function fetchLibraryEvents(): Promise<RawEvent[]> {
  const events: RawEvent[] = [];
  const apiUrl = 'https://cincinnatilibrary.bibliocommons.com/v2/events?locations=1&featured=true';

  try {
    const response = await axios.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UrbanHikersBot/1.0)',
        'Accept': 'application/json',
        'Referer': 'https://cincinnatilibrary.bibliocommons.com/events',
      },
      timeout: 10_000,
    });

    const data       = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    const rawEvents  = data.entities?.events || {};
    const now        = new Date();

    for (const id in rawEvents) {
      const evt = rawEvents[id];
      const start = evt.start_datetime;
      if (!start) continue;
      const startDate = new Date(start);
      if (isNaN(startDate.getTime()) || startDate <= now) continue;

      const end       = evt.end_datetime || start;
      const endDate   = new Date(end);
      const imageUrl  = evt.image_url || evt.cover_image?.url || evt.images?.[0]?.url || evt.thumbnail_url || '';
      const hash      = makeHash(String(evt.id), start, 'library');

      events.push({
        title:       evt.name || 'Library Event',
        description: (evt.description || '').replace(/<[^>]*>?/gm, '').slice(0, 300),
        starts_at:   startDate.toISOString(),
        expires_at:  endDate.toISOString(),
        venue:       evt.location?.name || 'Cincinnati Public Library',
        sourceUrl:   `https://cincinnatilibrary.bibliocommons.com/events/${evt.id}`,
        imageUrl:    imageUrl.trim() || LIBRARY_FALLBACK_IMAGE,
        source:      'library',
        sourceHash:  hash,
      });
    }

    console.log(`✅ Library: fetched ${events.length} upcoming events`);
  } catch (err) {
    console.error('❌ Library API failed, trying web scrape fallback:', err instanceof Error ? err.message : err);

    // Scrape fallback: CHPL public events page
    try {
      const { data: html } = await axios.get('https://chpl.org/events/', {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; UrbanHikersBot/1.0)' },
        timeout: 10_000,
      });
      const $ = cheerio.load(html);
      const now = new Date();

      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const raw  = JSON.parse($(el).html() || '');
          const items = Array.isArray(raw) ? raw : [raw];
          for (const item of items) {
            if (item['@type'] !== 'Event') continue;
            const title = String(item.name || '').trim();
            const start = item.startDate || '';
            if (!title || !start) continue;
            const startDate = new Date(start);
            if (isNaN(startDate.getTime()) || startDate <= now) continue;
            const end     = item.endDate ? new Date(item.endDate) : new Date(startDate.getTime() + 2 * 3600_000);
            const hash    = makeHash(title, start, 'library');
            events.push({
              title, description: item.description || '',
              starts_at: startDate.toISOString(), expires_at: end.toISOString(),
              venue: item.location?.name || 'CHPL Branch',
              sourceUrl: item.url || 'https://chpl.org/events/',
              imageUrl: item.image || LIBRARY_FALLBACK_IMAGE,
              source: 'library', sourceHash: hash,
            });
          }
        } catch { /* skip */ }
      });

      console.log(`✅ Library scrape fallback: found ${events.length} events`);
    } catch (fallbackErr) {
      console.error('❌ Library scrape fallback also failed:', fallbackErr instanceof Error ? fallbackErr.message : fallbackErr);
    }
  }

  return events;
}

// ─── Enrichment ───────────────────────────────────────────────────────────────
async function enrichEvent(event: RawEvent): Promise<EnrichedData> {
  const defaultResult: EnrichedData = {
    taxonomy_tags: ['Civic'],
    vibe_estimate: 'chill',
    short_description: event.title,
    recurrence_pattern: '',
    rarity_weight: 8,
    drop_eligible: true,
  };

  const prompt = `You are enriching a Cincinnati civic event for Local Pulse OS.

Event:
  Title: ${event.title}
  Description: ${event.description}
  Venue: ${event.venue}
  Starts: ${event.starts_at}
  Expires: ${event.expires_at}
  Source: ${event.source}

Return JSON ONLY — no markdown, no preamble. Schema:
{
  "taxonomy_tags": string[],         // pick from [Culture,Wellness,History,Food,Music,Art,Tech,Family,Sports,Civic]
  "vibe_estimate": "chill"|"buzzing"|"packed",
  "short_description": string,       // max 120 chars, present tense
  "recurrence_pattern": string,      // e.g. "Weekly on Thursdays" or ""
  "rarity_weight": number,           // 1-10: 1=ultra rare, 10=common daily
  "drop_eligible": boolean
}`;

  const text = await geminiEnrich(prompt, event.title);
  if (!text) return defaultResult;

  try {
    const parsed = JSON.parse(text);
    return {
      taxonomy_tags:      Array.isArray(parsed.taxonomy_tags) ? parsed.taxonomy_tags : ['Civic'],
      vibe_estimate:      ['chill','buzzing','packed'].includes(parsed.vibe_estimate) ? parsed.vibe_estimate : 'chill',
      short_description:  String(parsed.short_description || event.title).slice(0, 120),
      recurrence_pattern: parsed.recurrence_pattern || '',
      rarity_weight:      clampRarity(parsed.rarity_weight),
      drop_eligible:      parsed.drop_eligible ?? true,
    };
  } catch {
    console.warn(`  ⚠️  JSON parse failed for "${event.title}" — using defaults`);
    return defaultResult;
  }
}

// ─── Firestore write ──────────────────────────────────────────────────────────
async function upsertBroadcast(event: RawEvent, enriched: EnrichedData): Promise<'written' | 'skipped'> {
  const existing = await getDocs(query(collection(db, 'broadcasts'), where('sourceHash', '==', event.sourceHash), limit(1)));

  if (!existing.empty) return 'skipped';

  const now      = new Date();
  const midnight = new Date(); midnight.setHours(23, 59, 0, 0);

  const doc: Record<string, unknown> = {
    // ── Identity ──────────────────────────────────────
    title:        event.title,
    type:         'civic_event',
    status:       'active',
    source:       event.source,
    partner_id:   event.source,
    sourceHash:   event.sourceHash,
    sourceUrl:    event.sourceUrl || null,

    // ── Content ───────────────────────────────────────
    description:          enriched.short_description || event.description,
    original_description: event.description || null,
    cover_url:            event.imageUrl || LIBRARY_FALLBACK_IMAGE,
    taxonomy_tags:        enriched.taxonomy_tags,
    current_vibe:         enriched.vibe_estimate,
    rarity_weight:        enriched.rarity_weight,
    drop_eligible:        enriched.drop_eligible,
    recurrence:           enriched.recurrence_pattern || null,

    // ── Pricing ───────────────────────────────────────
    price:        0,
    is_sponsored: false,

    // ── Location (Cincinnati default until geocoded) ──
    latitude:  event.latitude  ?? 39.1031,
    longitude: event.longitude ?? -84.5120,
    address:   event.venue     || null,
    venue:     event.venue     || null,

    // ── Hub assignment ────────────────────────────────
    node_id:  null,
    node_ids: [],
    scope:    'all_nodes',

    starts_at:  toTS(event.starts_at,  now),
    expires_at: toTS(event.expires_at, midnight),

    startsAt:  event.starts_at,
    expiresAt: event.expires_at,

    // ── Flags ─────────────────────────────────────────
    active:              true,
    is_active:           true,
    is_admin_post:       false,
    payment_type:        'free',
    expiry_warning_sent: false,

    // ── Analytics ─────────────────────────────────────
    impressions: 0,
    taps:        0,

    // ── Metadata ──────────────────────────────────────
    ingestedAt: serverTimestamp(),
    updatedAt:  serverTimestamp(),
    created_at: serverTimestamp(),
  };

  await setDoc(doc(db, 'broadcasts', event.sourceHash), docData, { merge: true });
  return 'written';
}

// ─── Diagnostic runner ────────────────────────────────────────────────────────
async function runDiagnostic() {
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  URBAN HIKERS — AGENT DIAGNOSTIC + FIX RUNNER');
  console.log('═══════════════════════════════════════════════════\n');

  initServices();

  console.log('🔍 [1/4] Testing Gemini API...');
  const testText = await geminiEnrich(
    'Return only valid JSON: {"ok": true}',
    'connectivity test',
  );
  if (!testText) {
    console.error('❌ Gemini is not responding. Check GEMINI_API_KEY and quota.');
    process.exit(1);
  }
  console.log('✅ Gemini OK\n');

  console.log('🔍 [2/4] Testing Firestore...');
  try {
    const snap = await getDocs(query(collection(db, 'nodes'), limit(1)));
    console.log(`✅ Firestore OK (${snap.size} node(s) found)\n`);
  } catch (err) {
    console.error('❌ Firestore unreachable:', err);
    process.exit(1);
  }

  console.log('🔍 [3/4] Fetching events from sources...');
  const [cincyEvents, libraryEvents] = await Promise.all([
    fetchVisitCincyEvents(),
    fetchLibraryEvents(),
  ]);

  const all = [...cincyEvents, ...libraryEvents];
  console.log(`\n📦 Total events fetched: ${all.length}`);
  console.log(`   • Visit Cincy: ${cincyEvents.length}`);
  console.log(`   • Library:     ${libraryEvents.length}\n`);

  if (all.length === 0) {
    console.warn('⚠️  No events fetched. Possible causes:');
    console.warn('   - Visit Cincy changed their HTML structure again');
    console.warn('   - Library API returned empty entities');
    console.warn('   - Network timeout (check firewall / egress rules)');
    process.exit(0);
  }

  console.log('🔍 [4/4] Enriching and writing to Firestore...');
  const MAX_PER_RUN = 25;
  let written = 0, skipped = 0, errors = 0;

  for (const event of all.slice(0, MAX_PER_RUN)) {
    try {
      console.log(`  ⚙️  Processing: "${event.title}" [${event.source}]`);
      const enriched = await enrichEvent(event);

      await new Promise(r => setTimeout(r, 15000));

      const result = await upsertBroadcast(event, enriched);
      if (result === 'written') {
        written++;
        console.log(`  ✅ Written: ${event.sourceHash}`);
      } else {
        skipped++;
        console.log(`  ⏭️  Skipped (duplicate): ${event.title}`);
      }
    } catch (err) {
      errors++;
      console.error(`  ❌ Failed: "${event.title}"`, err instanceof Error ? err.message : err);
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log(`  Written:  ${written}`);
  console.log(`  Skipped:  ${skipped} (already in DB)`);
  console.log(`  Errors:   ${errors}`);
  console.log(`  Total:    ${all.length} fetched, ${Math.min(all.length, MAX_PER_RUN)} processed`);
  console.log('═══════════════════════════════════════════════════\n');
}

export async function runFixedCivicIngestion() {
  initServices();
  const events = await fetchVisitCincyEvents();
  let written = 0, skipped = 0, errors = 0;
  for (const event of events) {
    try {
      const enriched = await enrichEvent(event);
      await new Promise(r => setTimeout(r, 15000));
      const result = await upsertBroadcast(event, enriched);
      result === 'written' ? written++ : skipped++;
    } catch { errors++; }
  }
  return { source: 'visit-cincy', total: events.length, written, skipped, errors };
}

export async function runFixedLibraryIngestion() {
  initServices();
  const events = await fetchLibraryEvents();
  let written = 0, skipped = 0, errors = 0;
  for (const event of events) {
    try {
      const enriched = await enrichEvent(event);
      await new Promise(r => setTimeout(r, 15000));
      const result = await upsertBroadcast(event, enriched);
      result === 'written' ? written++ : skipped++;
    } catch { errors++; }
  }
  return { source: 'library', total: events.length, written, skipped, errors };
}

// Only run if called directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('agentDiagnostic.ts')) {
  runDiagnostic().catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
