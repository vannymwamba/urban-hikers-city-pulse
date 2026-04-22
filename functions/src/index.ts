// functions/src/index.ts  (Node 20 · 2nd gen)
import { onSchedule }         from 'firebase-functions/v2/scheduler'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onObjectFinalized }  from 'firebase-functions/v2/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { beforeUserCreated }  from 'firebase-functions/v2/identity'
import * as admin              from 'firebase-admin'
import { getFirestore } from 'firebase-admin/firestore'
import { fetchAndProcessCHPLEvents } from '../../shared/chplIngestion.ts'
import * as fs from 'fs'
import * as path from 'path'

// Initialize Admin SDK with defensive projectId logic
const envProjectId = process.env.FIREBASE_PROJECT_ID;
let initialProjectId = (envProjectId && !envProjectId.startsWith('ai-studio-')) ? envProjectId : undefined;

// Try to find the config file to get the correct projectId if env is wrong
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

if (configPath && !initialProjectId) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    initialProjectId = config.projectId;
  } catch (e) {
    console.error('FAILED_TO_READ_CONFIG_FOR_PROJECT_ID:', e);
  }
}

admin.initializeApp({
  projectId: initialProjectId
});

// Initialize Firestore with the correct database ID from config
let db: admin.firestore.Firestore;
let DATABASE_ID = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';

try {
  // Using specific database ID as requested to match Kroger data location
  db = getFirestore(DATABASE_ID);
  console.log(`FIRESTORE_INITIALIZED_WITH_DB: ${DATABASE_ID}`);
} catch (e) {
  console.error('FAILED_TO_LOAD_FIRESTORE:', e);
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

// ⑥  Ingest CHPL events from Bibliocommons API (Scheduled)
export const ingestCHPLEvents = onSchedule({
  schedule: '0 2 * * *',
  timeZone: 'America/New_York',
  memory: '256MiB',
}, async (event) => {
  try {
    const { count } = await fetchAndProcessCHPLEvents(db);
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

    const { count } = await fetchAndProcessCHPLEvents(db);
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
