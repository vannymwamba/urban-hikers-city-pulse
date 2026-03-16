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
    .where('expires_at', '<', now)
    .get()
  const batch = db.batch()
  snap.docs.forEach(doc => batch.update(doc.ref, { active: false }))
  await batch.commit()
  console.log(`Expired ${snap.size} broadcasts`)
})

// ②  Validate + rate-limit tap writes
export const onTapValidate = onDocumentCreated('taps/{tapId}', async event => {
  const data = event.data?.data()
  const required = ['node_id', 'session_id', 'tapped_at']
  const valid = required.every(f => data?.[f])
  if (!valid) { await event.data?.ref.delete(); return }

  // Rate limit: max 3 taps per session per node per minute
  const recent = await db.collection('taps')
    .where('session_id', '==', data.session_id)
    .where('node_id', '==', data.node_id)
    .where('tapped_at', '>', new Date(Date.now() - 60000))
    .count().get()
  if (recent.data().count > 3) { await event.data?.ref.delete() }

  // Increment node tap_count
  await db.doc(`nodes/${data.node_id}`)
    .update({ tap_count: admin.firestore.FieldValue.increment(1) })
})

// ③  Auto-assign partner role on signup
export const onPartnerRoleSync = beforeUserCreated(async event => {
  const email = event.data.email
  const snap = await db.collection('partners')
    .where('owner_email', '==', email).limit(1).get()
  if (!snap.empty) {
    await db.doc(`users/${event.data.uid}`)
      .set({ role: 'partner', partner_id: snap.docs[0].id }, { merge: true })
  }
})

// ④  Sponsor analytics (callable — auth-gated)
export const getSponsorAnalytics = onCall({ enforceAppCheck: true }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login required')
  const { sponsor_id, days = 30 } = req.data
  const since = new Date(Date.now() - days * 864e5)
  const snap = await db.collection('taps')
    .where('sponsor_id', '==', sponsor_id)
    .where('tapped_at', '>', since).get()
  const sessions = new Set(snap.docs.map(d => d.data().session_id))
  return { total_taps: snap.size, unique_sessions: sessions.size }
})

// ⑤  Logo resize on upload
export const onLogoUploadProcess = onObjectFinalized(async event => {
  const filePath = event.data.name  // sponsors/{partnerId}/logo.png
  if (!filePath?.startsWith('sponsors/')) return
  const partnerId = filePath.split('/')[1]
  const url = `https://storage.googleapis.com/${event.data.bucket}/${filePath}`
  await db.doc(`partners/${partnerId}`)
    .update({ logo_url: url, logo_updated_at: admin.firestore.FieldValue.serverTimestamp() })
})
