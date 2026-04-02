import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { Client } from "@googlemaps/google-maps-services-js";
import dotenv from 'dotenv';

dotenv.config();

const mapsClient = new Client({});

/**
 * Visit Cincy Event Ingestion Agent
 * Fetches events from visitcincy.com, geocodes them, and writes to Firestore.
 */
export async function runVisitCincyAgent() {
  console.log('[visit-cincy] Starting ingestion agent...');
  
  // Initialize Firestore if not already done
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0404340863",
    });
  }
  
  // Use the specific database ID if available, otherwise default
  const db = getFirestore("ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a");
  
  let ingested = 0;
  let skipped = 0;

  try {
    const response = await axios.get('https://www.visitcincy.com/events/', {
      headers: {
        'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
        'Accept': 'text/html'
      }
    });

    const $ = cheerio.load(response.data);
    const eventCards = $('.em-event, article.event');
    
    console.log(`[visit-cincy] Found ${eventCards.length} event cards on page.`);

    for (const element of eventCards.toArray()) {
      try {
        const title = $(element).find('h2, h3').first().text().trim();
        const dateStr = $(element).find('.date, .time').first().text().trim();
        const venue = $(element).find('.location, .venue').first().text().trim();
        const sourceUrl = $(element).find('a').first().attr('href') || null;
        const imageUrl = $(element).find('img').first().attr('src') || null;

        if (!title || !dateStr) {
          skipped++;
          continue;
        }

        // Generate MD5 sourceHash for deduplication
        const sourceHash = crypto.createHash('md5').update(`${title}${dateStr}`).digest('hex');

        // Check for existing event
        const existing = await db.collection('broadcasts')
          .where('sourceHash', '==', sourceHash)
          .limit(1)
          .get();

        if (!existing.empty) {
          skipped++;
          continue;
        }

        // Parse date (this is tricky with strings, we'll try our best or use a default)
        // For the sake of this agent, we'll assume the event is today if parsing fails
        let startTimeDate = new Date(dateStr);
        if (isNaN(startTimeDate.getTime())) {
          startTimeDate = new Date(); // Fallback to now
        }

        // Skip if event end time (startTime + 4 hours) is in the past
        const endTime = new Date(startTimeDate.getTime() + 4 * 60 * 60 * 1000);
        if (endTime.getTime() < Date.now()) {
          skipped++;
          continue;
        }

        // Geocoding
        let coords = null;
        if (venue) {
          try {
            // Respect rate limit
            await new Promise(resolve => setTimeout(resolve, 200));
            
            const geoResponse = await mapsClient.geocode({
              params: {
                address: `${venue}, Cincinnati, OH`,
                key: process.env.GOOGLE_MAPS_API_KEY || '',
              },
            });

            if (geoResponse.data.results.length > 0) {
              const loc = geoResponse.data.results[0].geometry.location;
              coords = { lat: loc.lat, lng: loc.lng };
            }
          } catch (geoErr) {
            console.error(`[visit-cincy] Geocoding error for ${venue}:`, geoErr);
          }
        }

        // Write to Firestore
        await db.collection('broadcasts').add({
          title,
          venue: venue || null,
          startTime: Timestamp.fromDate(startTimeDate),
          coords,
          sectorId: null, // Cloud Function will stamp this
          source: "visit-cincy",
          sourceHash,
          sourceUrl: sourceUrl ? (sourceUrl.startsWith('http') ? sourceUrl : `https://www.visitcincy.com${sourceUrl}`) : null,
          imageUrl: imageUrl ? (imageUrl.startsWith('http') ? imageUrl : `https://www.visitcincy.com${imageUrl}`) : null,
          active: true,
          vibe: null,
          ingestedAt: FieldValue.serverTimestamp()
        });

        ingested++;
      } catch (err) {
        console.error('[visit-cincy] Error processing individual event:', err);
        skipped++;
      }
    }

    console.log(`[visit-cincy] Ingestion complete. Ingested: ${ingested}, Skipped: ${skipped}`);
    return { ingested, skipped };
  } catch (error) {
    console.error('[visit-cincy] Fatal ingestion error:', error);
    throw error;
  }
}
