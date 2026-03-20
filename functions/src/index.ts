// functions/src/index.ts  (Node 20 · 2nd gen)
import { onSchedule }         from 'firebase-functions/v2/scheduler'
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore'
import { onObjectFinalized }  from 'firebase-functions/v2/storage'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { beforeUserCreated }  from 'firebase-functions/v2/identity'
import * as admin              from 'firebase-admin'

admin.initializeApp()
const db = admin.firestore()

// ①  Auto-expire broadcasts every 15 min
export const onBroadcastExpired = onSchedule('every 15 minutes', async () => {
  const now = admin.firestore.Timestamp.now()
  const snap = await db.collection('broadcasts')
    .where('active', '==', true)
    .where('expiresAt', '<', now)
    .get()
  const batch = db.batch()
  snap.docs.forEach(doc => batch.update(doc.ref, { active: false }))
  await batch.commit()
  console.log(`Expired ${snap.size} broadcasts`)
})

// ②  Validate + rate-limit tap writes
export const onTapValidate = onDocumentCreated('taps/{tapId}', async event => {
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
      .where('ownerEmail', '==', email).limit(1).get()
    
    if (!partnerSnap.empty) {
      role = 'partner_admin'
      partnerId = partnerSnap.docs[0].id
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
export const getSponsorAnalytics = onCall({ enforceAppCheck: true }, async (req) => {
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
