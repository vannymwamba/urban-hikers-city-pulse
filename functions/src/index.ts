// functions/src/index.ts  (Node 20 · 2nd gen)
import { onSchedule }         from 'firebase-functions/v2/scheduler'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onObjectFinalized }  from 'firebase-functions/v2/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { beforeUserCreated }  from 'firebase-functions/v2/identity'
import * as admin              from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'
import * as fs from 'fs'
import * as path from 'path'

admin.initializeApp()

// Initialize Firestore with the correct database ID from config
let db: admin.firestore.Firestore;
let DATABASE_ID = '(default)';

try {
  // Try multiple possible paths for the config file
  const paths = [
    path.join(process.cwd(), 'firebase-applet-config.json'),
    path.join(process.cwd(), '../firebase-applet-config.json'),
    path.join(__dirname, '../firebase-applet-config.json'),
    path.join(__dirname, '../../firebase-applet-config.json')
  ];
  
  let configPath = '';
  for (const p of paths) {
    if (fs.existsSync(p)) {
      configPath = p;
      break;
    }
  }

  if (configPath) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    DATABASE_ID = config.firestoreDatabaseId;
    db = getFirestore(DATABASE_ID);
    console.log(`FIRESTORE_INITIALIZED_WITH_DB: ${DATABASE_ID} FROM ${configPath}`);
  } else {
    db = getFirestore();
    console.log('FIRESTORE_INITIALIZED_WITH_DEFAULT_DB (CONFIG_NOT_FOUND)');
  }
} catch (e) {
  console.error('FAILED_TO_LOAD_CONFIG_FOR_FIRESTORE:', e);
  db = getFirestore();
}

// ①  Auto-expire broadcasts every 15 min
export const onBroadcastExpired = onSchedule('every 15 minutes', async () => {
  const nowStr = new Date().toISOString();
  const snap = await db.collection('broadcasts')
    .where('active', '==', true)
    .where('expires_at', '<', nowStr)
    .get()
  const batch = db.batch()
  snap.docs.forEach(doc => batch.update(doc.ref, { active: false }))
  await batch.commit()
  console.log(`Expired ${snap.size} broadcasts`)
})

// ②  Validate + rate-limit tap writes
export const onTapValidate = onDocumentCreated({
  document: 'taps/{tapId}',
  database: DATABASE_ID
}, async event => {
  const data = event.data?.data()
  const required = ['nodeId', 'sessionUuid', 'timestamp']
  const valid = required.every(f => data?.[f])
  if (!valid) { await event.data?.ref.delete(); return }

  // Rate limit: max 3 taps per session per node per minute
  const recent = await db.collection('taps')
    .where('sessionUuid', '==', data.sessionUuid)
    .where('nodeId', '==', data.nodeId)
    .where('timestamp', '>', new Date(Date.now() - 60000).toISOString())
    .count().get()
  if (recent.data().count > 3) { await event.data?.ref.delete() }

  // Increment node tapCount
  await db.doc(`nodes/${data.nodeId}`)
    .update({ tapCount: admin.firestore.FieldValue.increment(1) })
})

// ③  Auto-assign role on signup
export const onUserSignup = beforeUserCreated(async event => {
  const email = event.data.email
  const uid = event.data.uid
  
  let role = 'hiker'
  let partnerId = null
  
  // Bootstrap super_admin
  if (email === 'vannymwamba@gmail.com') {
    role = 'super_admin'
  } else {
    // Check if user is a partner owner
    const partnerSnap = await db.collection('partners')
      .where('owner_email', '==', email).limit(1).get()
    
    let partnerDoc = partnerSnap.empty ? null : partnerSnap.docs[0]
    
    if (!partnerDoc) {
      const partnerSnapLegacy = await db.collection('partners')
        .where('ownerEmail', '==', email).limit(1).get()
      if (!partnerSnapLegacy.empty) {
        partnerDoc = partnerSnapLegacy.docs[0]
      }
    }
    
    if (partnerDoc) {
      role = 'partner_admin'
      partnerId = partnerDoc.id
    }
  }

  // Create the user document in Firestore
  await db.doc(`users/${uid}`).set({
    uid,
    email,
    role,
    partnerId,
    displayName: event.data.displayName || '',
    photoUrl: event.data.photoURL || '',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true })

  console.log(`User ${uid} signed up with role ${role}`)
})

// ④  Sponsor analytics (callable — auth-gated)
export const getSponsorAnalytics = onCall({ enforceAppCheck: false }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login required')
  const { sponsorId, days = 30 } = req.data
  const since = new Date(Date.now() - days * 864e5)
  const snap = await db.collection('taps')
    .where('sponsorId', '==', sponsorId)
    .where('timestamp', '>', since.toISOString()).get()
  const sessions = new Set(snap.docs.map(d => d.data().sessionUuid))
  return { totalTaps: snap.size, uniqueSessions: sessions.size }
})

// ⑤  Logo metadata update on upload
export const onLogoUploadProcess = onObjectFinalized(async event => {
  const filePath = event.data.name; // sponsors/{partnerId}/logo_TIMESTAMP.webp
  if (!filePath?.startsWith('sponsors/')) return;
  
  const parts = filePath.split('/');
  if (parts.length < 2) return;
  const partnerId = parts[1];
  
  // We only update the timestamp to trigger a refresh if needed, 
  // but we don't overwrite the logoUrl because the client provides a tokenized URL
  // which is more reliable than the public storage.googleapis.com URL.
  await db.doc(`partners/${partnerId}`).update({ 
    logoLastProcessed: admin.firestore.FieldValue.serverTimestamp() 
  });
});

// ⑥  Ingest CHPL events from Bibliocommons API
const CHPL_BRANCHES: Record<string, { lat: number, lng: number }> = {
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

export const ingestCHPLEvents = onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'America/New_York',
  memory: '256MiB',
}, async (event) => {
  // Bibliocommons API endpoint for CHPL events
  // Removing locations=1 to fetch events from all branches
  const API_URL = 'https://cincinnatilibrary.bibliocommons.com/events/api/v1/events?limit=100';
  
  try {
    console.log(`FETCHING_CHPL_EVENTS: ${API_URL}`);
    let response;
    try {
      response = await fetch(API_URL, {
        headers: {
          'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
          'Accept': 'application/json'
        }
      });
    } catch (fetchErr: any) {
      console.error('FETCH_EXCEPTION:', fetchErr);
      throw new Error(`FETCH_FAILED: ${fetchErr.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API_FETCH_FAILED: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`API_FETCH_FAILED: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonErr: any) {
      console.error('JSON_PARSE_EXCEPTION:', jsonErr);
      throw new Error(`JSON_PARSE_FAILED: ${jsonErr.message}`);
    }
    const events = data.events || [];
    console.log(`RECEIVED_${events.length}_EVENTS_FROM_CHPL_API`);
    
    const batch = db.batch();
    let count = 0;

    for (const evt of events) {
      try {
        if (!evt.id || !evt.title || !evt.start_datetime || !evt.end_datetime) {
          console.warn(`SKIPPING_INVALID_EVENT: ${evt.id || 'NO_ID'}`, evt.title);
          continue;
        }

        // Map location to coordinates
        const branchName = evt.location?.name || 'Main Library';
        const coords = CHPL_BRANCHES[branchName] || CHPL_BRANCHES['Main Library'];
        
        const broadcastId = `chpl-${evt.id}`;
        const broadcastRef = db.collection('broadcasts').doc(broadcastId);
        
        const startsAt = new Date(evt.start_datetime);
        const expiresAt = new Date(evt.end_datetime);

        if (isNaN(startsAt.getTime()) || isNaN(expiresAt.getTime())) {
          console.warn(`SKIPPING_INVALID_DATES: ${evt.id}`);
          continue;
        }

        // Only ingest future or ongoing events
        if (expiresAt.getTime() < Date.now()) {
          continue;
        }

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
          address: branchName, // Use branch name as address for display
          active: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        count++;
        if (count >= 500) break; // Firestore batch limit
      } catch (innerErr) {
        console.error(`ERROR_PROCESSING_EVENT: ${evt.id}`, innerErr);
      }
    }

    if (count > 0) {
      await batch.commit();
      console.log(`INGEST_SUCCESS: ${count} CHPL_EVENTS_SYNCED`);
    }
    return { success: true, count };
  } catch (error) {
    console.error('INGEST_FAILURE:', error);
    throw new HttpsError('internal', 'Ingestion failed');
  }
});

// ⑦  Manual trigger for CHPL ingestion (callable)
export const triggerCHPLIngest = onCall({ enforceAppCheck: false }, async (req) => {
  try {
    // Only admins can trigger manual sync
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'User must be logged in');
    }

    let userData;
    try {
      const userSnap = await db.doc(`users/${req.auth.uid}`).get();
      userData = userSnap.data();
    } catch (dbErr: any) {
      console.error('DB_FETCH_EXCEPTION:', dbErr);
      throw new HttpsError('internal', `DB_FETCH_FAILED: ${dbErr.message}`);
    }

    console.log('AUTH_CONTEXT:', {
      uid: req.auth.uid,
      email: req.auth.token.email,
      email_verified: req.auth.token.email_verified
    });

    const isDefaultAdmin = req.auth.token.email === 'vannymwamba@gmail.com';
    if (userData?.role !== 'super_admin' && userData?.role !== 'admin' && !isDefaultAdmin) {
      throw new HttpsError('permission-denied', 'Only admins can trigger sync');
    }

    const API_URL = 'https://cincinnatilibrary.bibliocommons.com/events/api/v1/events?limit=100';
    console.log(`FETCHING_CHPL_EVENTS: ${API_URL}`);
    
    let response;
    try {
      response = await fetch(API_URL, {
        headers: {
          'User-Agent': 'UrbanHikers/1.0 (https://www.urbanhikers.org)',
          'Accept': 'application/json'
        }
      });
    } catch (fetchErr: any) {
      console.error('FETCH_EXCEPTION:', fetchErr);
      throw new HttpsError('internal', `FETCH_FAILED: ${fetchErr.message}`);
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API_FETCH_FAILED: ${response.status} ${response.statusText}`, errorText);
      throw new HttpsError('internal', `API_FETCH_FAILED: ${response.status} ${response.statusText}`);
    }

    let data;
    try {
      data = await response.json();
    } catch (jsonErr: any) {
      console.error('JSON_PARSE_EXCEPTION:', jsonErr);
      throw new HttpsError('internal', `JSON_PARSE_FAILED: ${jsonErr.message}`);
    }
    const events = data.events || [];
    console.log(`RECEIVED_${events.length}_EVENTS_FROM_CHPL_API`);
    
    const batch = db.batch();
    let count = 0;
    for (const evt of events) {
      try {
        if (!evt.id || !evt.title || !evt.start_datetime || !evt.end_datetime) {
          console.warn(`SKIPPING_INVALID_EVENT: ${evt.id || 'NO_ID'}`, evt.title);
          continue;
        }

        const branchName = evt.location?.name || 'Main Library';
        const coords = CHPL_BRANCHES[branchName] || CHPL_BRANCHES['Main Library'];
        const broadcastId = `chpl-${evt.id}`;
        const broadcastRef = db.collection('broadcasts').doc(broadcastId);
        
        const startsAt = new Date(evt.start_datetime);
        const expiresAt = new Date(evt.end_datetime);

        if (isNaN(startsAt.getTime()) || isNaN(expiresAt.getTime())) {
          console.warn(`SKIPPING_INVALID_DATES: ${evt.id}`);
          continue;
        }

        // Only ingest future or ongoing events
        if (expiresAt.getTime() < Date.now()) {
          continue;
        }

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
          address: branchName, // Use branch name as address for display
          active: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        
        count++;
        if (count >= 500) break;
      } catch (innerErr) {
        console.error(`ERROR_PROCESSING_EVENT: ${evt.id}`, innerErr);
      }
    }
    if (count > 0) {
      try {
        await batch.commit();
      } catch (batchErr: any) {
        console.error('BATCH_COMMIT_EXCEPTION:', batchErr);
        throw new HttpsError('internal', `BATCH_COMMIT_FAILED: ${batchErr.message}`);
      }
    }
    console.log(`MANUAL_INGEST_SUCCESS: ${count} EVENTS`);
    return { success: true, count };
  } catch (error: any) {
    console.error('TRIGGER_CHPL_INGEST_ERROR:', error);
    if (error instanceof HttpsError) throw error;
    
    // Log the full error for debugging
    console.dir(error);
    
    const code = error.code || 'internal';
    const message = error.message || 'Unknown error occurred during ingestion';
    
    throw new HttpsError(code, message);
  }
});

export { tagEventToSector } from './tagEventToSector';
