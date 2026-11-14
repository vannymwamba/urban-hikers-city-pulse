import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import type { VisitorProfile } from '../types';

const PROJECT_ID = 'gen-lang-client-0752567409';
const DATABASE_ID = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';

let adminApp: App | null = null;
let loggedMissingCredsNotice = false;

function readDotEnvServiceAccount(): string | undefined {
  try {
    const envPath = path.join(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) return undefined;
    const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
    return parsed.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function hasServiceAccountCredentials(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || readDotEnvServiceAccount());
}

/**
 * Escapes raw newline/tab control characters that appear inside JSON string
 * literals (common when pasting multi-line service account JSON into secret UIs).
 */
function normalizeJsonControlChars(input: string): string {
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inString) {
      if (escaped) {
        out += ch;
        escaped = false;
      } else if (ch === '\\') {
        out += ch;
        escaped = true;
      } else if (ch === '"') {
        out += ch;
        inString = false;
      } else if (ch === '\n') {
        out += '\\n';
      } else if (ch === '\r') {
        // Ignore CR inside JSON strings
      } else if (ch === '\t') {
        out += '\\t';
      } else {
        out += ch;
      }
    } else {
      if (ch === '"') {
        inString = true;
      }
      out += ch;
    }
  }

  return out;
}

function parseServiceAccountEnv(raw: string): Record<string, any> | null {
  let candidate = raw.trim();
  if (
    (candidate.startsWith("'") && candidate.endsWith("'")) ||
    (candidate.startsWith('"') && candidate.endsWith('"') && !candidate.startsWith('"{'))
  ) {
    candidate = candidate.slice(1, -1).trim();
  }

  if (!candidate.startsWith('{') && !candidate.startsWith('"')) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) {
        candidate = decoded;
      }
    } catch {
      // Not base64
    }
  }

  let parsed: any = JSON.parse(normalizeJsonControlChars(candidate));
  if (typeof parsed === 'string') {
    parsed = JSON.parse(normalizeJsonControlChars(parsed));
  }

  if (!parsed || typeof parsed !== 'object' || !parsed.client_email || !parsed.private_key) {
    return null;
  }

  if (typeof parsed.private_key === 'string') {
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
  }

  return parsed;
}

/**
 * Lazily initializes the Admin SDK app using a service account from env.
 * Admin SDK writes bypass Firestore Security Rules by design — this is the
 * only legitimate way to write a trusted leaderboard value server-side.
 *
 * Setup: Firebase Console > Project Settings > Service Accounts > Generate
 * new private key. Set the resulting JSON (as a single-line string) as the
 * FIREBASE_SERVICE_ACCOUNT_JSON env var. Never commit this key to the repo.
 */
function getAdminApp(): App | null {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  const candidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim(),
    readDotEnvServiceAccount(),
  ].filter((val): val is string => Boolean(val));

  if (candidates.length === 0) {
    if (!loggedMissingCredsNotice) {
      loggedMissingCredsNotice = true;
      console.log(
        '[LEADERBOARD] Skipping server recompute: FIREBASE_SERVICE_ACCOUNT_JSON env var is not configured yet.'
      );
    }
    return null;
  }

  for (const raw of candidates) {
    try {
      const serviceAccount = parseServiceAccountEnv(raw);
      if (!serviceAccount) continue;

      adminApp = initializeApp({
        credential: cert(serviceAccount as any),
        projectId: serviceAccount.project_id || PROJECT_ID,
      });
      return adminApp;
    } catch {
      // Try next candidate if available
    }
  }

  if (!loggedMissingCredsNotice) {
    loggedMissingCredsNotice = true;
    console.log('[LEADERBOARD] Skipping server recompute: FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed as valid service account JSON.');
  }
  return null;
}

/**
 * Recomputes leaderboard/{uid} for every visitor_profiles doc, from real,
 * already-tracked data only (locations_visited_ids, total_miles_explored).
 * Runs with Admin SDK privileges, so it's the only writer firestore.rules
 * allows on the leaderboard collection — this is what closes the
 * self-reported gaming hole (a client could previously setDoc any number
 * it wanted to its own leaderboard entry).
 *
 * Call this from a cron job (see src/cron/scheduler.ts), not from any
 * client-reachable code path.
 */
export async function recomputeLeaderboard(): Promise<{ updated: number; skipped: number }> {
  const app = getAdminApp();
  if (!app) {
    return { updated: 0, skipped: 0 };
  }

  const db = getFirestore(app, DATABASE_ID);

  const profilesSnap = await db.collection('visitor_profiles').get();

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let batchCount = 0;

  for (const docSnap of profilesSnap.docs) {
    try {
      const profile = docSnap.data() as VisitorProfile;
      const tapsCount = profile.locations_visited_ids?.length || 0;
      if (tapsCount <= 0) continue; // only rank participants with at least one real tap

      const name = profile.email
        ? profile.email.split('@')[0]
        : `Explorer #${docSnap.id.slice(-4).toUpperCase()}`;

      const leaderRef = db.collection('leaderboard').doc(docSnap.id);
      batch.set(
        leaderRef,
        {
          uid: docSnap.id,
          display_name: name,
          taps_count: tapsCount,
          places_count: profile.locations_visited_ids?.length || 0,
          miles_count: Number((profile.total_miles_explored || 0).toFixed(1)),
          last_tapped_at: profile.last_tap_at || null,
        },
        { merge: true }
      );

      updated++;
      batchCount++;

      if (batchCount >= 450) {
        await batch.commit();
        batch = db.batch();
        batchCount = 0;
      }
    } catch {
      skipped++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`[LEADERBOARD] Sync complete: ${updated} entries updated.`);
  return { updated, skipped };
}
