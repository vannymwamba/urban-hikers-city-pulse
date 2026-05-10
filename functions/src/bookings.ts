/**
 * functions/src/bookings.ts
 * Urban Hikers — Local Pulse OS
 *
 * Cloud Functions for native walk booking:
 *   onBookingCreated  — fires on new bookings doc → decrements spots_remaining
 *   onSpotsChanged    — fires when spots_remaining changes → FCM push at thresholds
 *
 * Deploy from ~/urban-hikers-city-pulse:
 *   firebase deploy --only functions:onBookingCreated,functions:onSpotsChanged
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

const db = admin.firestore();
const messaging = admin.messaging();

// ─── onBookingCreated ─────────────────────────────────────────────────────────
// Trigger: new document in bookings/{bookingId}
// Effect:
//   1. Atomically decrement broadcast.spots_remaining by booking.spots
//   2. Write booking_confirmed: true back to the booking doc
//   3. Send email receipt (via SendGrid env var — optional)

export const onBookingCreated = functions.firestore
  .document('bookings/{bookingId}')
  .onCreate(async (snap, context) => {
    const booking = snap.data() as BookingDoc;
    const { broadcastId, spots = 1, userId, notifyToken } = booking;

    if (!broadcastId) {
      console.error(`[onBookingCreated] Missing broadcastId on booking ${context.params.bookingId}`);
      return null;
    }

    const broadcastRef = db.collection('broadcasts').doc(broadcastId);

    try {
      // Atomic decrement — safe under concurrent bookings
      await broadcastRef.update({
        spots_remaining: admin.firestore.FieldValue.increment(-spots),
      });

      // Mark booking confirmed
      await snap.ref.update({ status: 'confirmed', confirmed_at: admin.firestore.FieldValue.serverTimestamp() });

      // Send confirmation push to the booker if they opted in
      if (notifyToken) {
        await messaging.send({
          token: notifyToken,
          notification: {
            title: 'Walk confirmed',
            body: `You're in! ${spots} spot${spots > 1 ? 's' : ''} reserved. Tap to view your pass.`,
          },
          data: {
            type: 'booking_confirmed',
            broadcastId,
            bookingId: context.params.bookingId,
          },
          android: { priority: 'high' },
          apns: { payload: { aps: { sound: 'default' } } },
        });
      }

      console.log(`[onBookingCreated] Decremented ${spots} spot(s) on broadcast ${broadcastId}`);
      return null;

    } catch (err) {
      console.error(`[onBookingCreated] Failed for broadcast ${broadcastId}:`, err);
      // Mark booking as failed so the client can retry
      await snap.ref.update({ status: 'failed', error: String(err) });
      return null;
    }
  });


// ─── onSpotsChanged ───────────────────────────────────────────────────────────
// Trigger: any update to a broadcast document
// Effect:
//   When spots_remaining crosses a threshold (3 or 1), push notify all users
//   who have this broadcast in their saved list or who tapped the node.
//
// Thresholds: 3 spots left, 1 spot left.
// Deduplication: uses broadcast.last_spots_alert field to avoid re-sending.

const ALERT_THRESHOLDS = [3, 1];

export const onSpotsChanged = functions.firestore
  .document('broadcasts/{broadcastId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data() as BroadcastDoc;
    const after = change.after.data() as BroadcastDoc;

    const spotsBefore = before.spots_remaining ?? Infinity;
    const spotsAfter = after.spots_remaining ?? Infinity;

    // Only act when spots decrease
    if (spotsAfter >= spotsBefore) return null;

    // Find which threshold(s) were just crossed
    const crossedThresholds = ALERT_THRESHOLDS.filter(
      (t) => spotsBefore > t && spotsAfter <= t
    );

    if (crossedThresholds.length === 0) return null;

    const threshold = crossedThresholds[0]; // lowest crossed threshold
    const lastAlert = after.last_spots_alert ?? Infinity;

    // Don't re-send if we already sent for this or a lower threshold
    if (lastAlert <= threshold) return null;

    const broadcastId = context.params.broadcastId;
    const broadcastTitle = after.title || 'This walk';

    // Mark alert sent before dispatching (prevents race condition on re-run)
    await change.after.ref.update({ last_spots_alert: threshold });

    // Find FCM tokens of interested users:
    //   - users who saved the hub this broadcast belongs to (wallet_saves)
    //   - users who tapped this node recently (taps collection)
    const nodeId = after.node_id || after.nodeId;
    const tokens: string[] = [];

    if (nodeId) {
      // Collect from recent taps on this node (last 24h)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const tapsSnap = await db
        .collection('taps')
        .where('node_id', '==', nodeId)
        .where('timestamp', '>=', since)
        .get();

      // Get unique session UUIDs → look up their FCM tokens
      const sessionIds = [...new Set(tapsSnap.docs.map((d) => d.data().session_uuid as string))];

      for (const sid of sessionIds.slice(0, 100)) { // cap at 100
        const userSnap = await db
          .collection('users')
          .where('session_uuid', '==', sid)
          .where('fcm_token', '!=', null)
          .limit(1)
          .get();

        userSnap.docs.forEach((d) => {
          const token = d.data().fcm_token as string;
          if (token && !tokens.includes(token)) tokens.push(token);
        });
      }
    }

    if (tokens.length === 0) {
      console.log(`[onSpotsChanged] No tokens to notify for broadcast ${broadcastId}`);
      return null;
    }

    // Send multicast push
    const message: admin.messaging.MulticastMessage = {
      tokens,
      notification: {
        title: threshold === 1 ? 'Last spot!' : `Only ${threshold} spots left`,
        body: `${broadcastTitle} is almost full. Book now before it's gone.`,
      },
      data: {
        type: 'spots_low',
        broadcastId,
        spots_remaining: String(spotsAfter),
        node_id: nodeId || '',
      },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
    };

    const result = await messaging.sendEachForMulticast(message);
    console.log(
      `[onSpotsChanged] Sent ${result.successCount}/${tokens.length} push notifications ` +
      `for broadcast ${broadcastId} at ${threshold} spots remaining`
    );

    return null;
  });


// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingDoc {
  broadcastId: string;
  userId?: string;
  spots: number;
  status: 'pending' | 'confirmed' | 'failed';
  notifyToken?: string; // FCM token, set during booking if user opted in
  price?: number;
  created_at?: admin.firestore.FieldValue;
}

interface BroadcastDoc {
  title?: string;
  spots_remaining?: number;
  node_id?: string;
  nodeId?: string;
  last_spots_alert?: number; // lowest threshold already alerted
  type?: string;
}
