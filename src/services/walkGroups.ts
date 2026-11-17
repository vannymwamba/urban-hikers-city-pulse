import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {
  initializeApp as initializeAdminApp,
  getApps,
  cert,
  applicationDefault,
  App as AdminApp,
} from 'firebase-admin/app';
import { getFirestore as getAdminFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth, DecodedIdToken } from 'firebase-admin/auth';
import { createRateLimiter } from '../../rateLimiter.ts';

const PROJECT_ID = 'gen-lang-client-0752567409';
const DATABASE_ID = 'ai-studio-8d3a18ac-9f60-480e-8200-f9f5e01c389a';
const WALK_ADMIN_APP_NAME = 'walk-groups-admin';
const AUTH_VERIFY_APP_NAME = 'walk-groups-auth-verify';

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

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
  try {
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
  } catch {
    return null;
  }
}

let cachedWalkAdminApp: AdminApp | null = null;
let cachedCredMode: 'service_account' | 'adc' | null = null;

function getOrInitWalkAdminApp(): { app: AdminApp | null; reason?: string } {
  const existing = getApps().find((a) => a.name === WALK_ADMIN_APP_NAME);
  if (existing) {
    cachedWalkAdminApp = existing;
    return { app: existing };
  }

  const saCandidates = [
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim(),
    readDotEnvServiceAccount(),
  ].filter((v): v is string => Boolean(v));

  for (const raw of saCandidates) {
    const parsed = parseServiceAccountEnv(raw);
    if (parsed) {
      try {
        cachedWalkAdminApp = initializeAdminApp(
          {
            credential: cert(parsed as any),
            projectId: parsed.project_id || PROJECT_ID,
          },
          WALK_ADMIN_APP_NAME
        );
        cachedCredMode = 'service_account';
        return { app: cachedWalkAdminApp };
      } catch (err: any) {
        console.error('[WALK_GROUPS] Service account initialization failed:', err?.message || err);
      }
    } else {
      console.warn('[WALK_GROUPS] FIREBASE_SERVICE_ACCOUNT_JSON is set but could not be parsed as valid service account JSON.');
    }
  }

  try {
    cachedWalkAdminApp = initializeAdminApp(
      {
        credential: applicationDefault(),
        projectId: PROJECT_ID,
      },
      WALK_ADMIN_APP_NAME
    );
    cachedCredMode = 'adc';
    return { app: cachedWalkAdminApp };
  } catch (err: any) {
    const reason = `Neither FIREBASE_SERVICE_ACCOUNT_JSON nor Application Default Credentials could be initialized: ${err?.message || String(err)}`;
    console.warn(`[WALK_GROUPS] ${reason}`);
    return { app: null, reason };
  }
}

function getAuthVerifierApp(): AdminApp {
  const existing = getApps().find((a) => a.name === AUTH_VERIFY_APP_NAME);
  if (existing) return existing;
  const walkAdmin = getApps().find((a) => a.name === WALK_ADMIN_APP_NAME);
  if (walkAdmin) return walkAdmin;
  return initializeAdminApp({ projectId: PROJECT_ID }, AUTH_VERIFY_APP_NAME);
}

function isUnavailableCredentialError(err: any): boolean {
  if (!err) return false;
  const code = err.code;
  const msg = String(err.message || err || '');
  if (
    msg.includes('Could not load the default credentials') ||
    msg.includes('Unable to detect a Project Id') ||
    msg.includes('invalid_grant') ||
    msg.includes('UNAUTHENTICATED')
  ) {
    return true;
  }
  // When running with ambient ADC that has no IAM access to this Firebase project's Firestore
  if (
    cachedCredMode === 'adc' &&
    (code === 7 || code === 16 || msg.includes('PERMISSION_DENIED') || msg.includes('Missing or insufficient permissions'))
  ) {
    return true;
  }
  return false;
}

const URL_PATTERN =
  /https?:\/\/|www\.|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|org|net|io|co|me|app|gg|ly|link|xyz|info|biz|edu|gov|us|tv|dev)\b/i;
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_PATTERN = /\+?\d(?:[\s().-]?\d){6,}/;

export function validateWalkNote(
  note: unknown
): { ok: true; value: string | null; error?: undefined } | { ok: false; error: string; value?: undefined } {
  if (note === undefined || note === null || note === '') {
    return { ok: true, value: null };
  }
  if (typeof note !== 'string') {
    return { ok: false, error: 'Note must be text.' };
  }
  const trimmed = note.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (trimmed.length > 140) {
    return { ok: false, error: 'Note must be 140 characters or fewer.' };
  }
  if (URL_PATTERN.test(trimmed) || EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Notes cannot contain links, email addresses, or phone numbers.' };
  }
  return { ok: true, value: trimmed };
}

export function validateFirstName(
  firstName: unknown
): { ok: true; value: string; error?: undefined } | { ok: false; error: string; value?: undefined } {
  if (typeof firstName !== 'string') {
    return { ok: false, error: 'First name is required (1–30 characters).' };
  }
  const trimmed = firstName.replace(/[\r\n\t]+/g, ' ').trim();
  if (trimmed.length < 1 || trimmed.length > 30) {
    return { ok: false, error: 'First name must be between 1 and 30 characters.' };
  }
  if (URL_PATTERN.test(trimmed) || EMAIL_PATTERN.test(trimmed) || PHONE_PATTERN.test(trimmed)) {
    return { ok: false, error: 'Please enter a valid first name only.' };
  }
  return { ok: true, value: trimmed };
}

function toTimestampMs(val: any): number | null {
  if (!val) return null;
  if (typeof val?.toDate === 'function') {
    const ms = val.toDate().getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof val?.seconds === 'number') {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
  }
  if (typeof val === 'string') {
    const ms = new Date(val).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  if (typeof val === 'number' && !Number.isNaN(val)) {
    return val;
  }
  return null;
}

function getNyCalendarDayKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function cleanHubDisplayName(rawName: unknown, fallbackId: string): string {
  const base = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : fallbackId;
  return base.replace(/_HUB$/i, '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim() || fallbackId;
}

export interface WalkGroupsDeps {
  verifyIdToken?: (token: string) => Promise<DecodedIdToken>;
  getDb?: () => FirebaseFirestore.Firestore | any;
  now?: () => number;
}

class WalkHttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export function createWalkGroupsRouter(deps: WalkGroupsDeps = {}): Router {
  const router = express.Router();
  const getNow = deps.now ?? (() => Date.now());

  const createLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 15,
    message: 'Too many walk creation attempts. Please wait a minute.',
  });
  const joinLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 30,
    message: 'Too many join requests. Please wait a moment.',
  });
  const leaveLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 30,
    message: 'Too many leave requests. Please wait a moment.',
  });
  const cancelLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 20,
    message: 'Too many cancel requests. Please wait a moment.',
  });
  const reportLimiter = createRateLimiter({
    windowMs: 60_000,
    max: 15,
    message: 'Too many reports submitted. Please wait a minute.',
  });

  const verifyBearer = async (req: Request): Promise<DecodedIdToken> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new WalkHttpError(401, 'LOGIN_REQUIRED');
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
      throw new WalkHttpError(401, 'LOGIN_REQUIRED');
    }

    let decoded: DecodedIdToken;
    try {
      if (deps.verifyIdToken) {
        decoded = await deps.verifyIdToken(token);
      } else {
        const authApp = getAuthVerifierApp();
        decoded = await getAdminAuth(authApp).verifyIdToken(token);
      }
    } catch {
      throw new WalkHttpError(401, 'LOGIN_REQUIRED');
    }

    const signInProvider = (decoded as any)?.firebase?.sign_in_provider;
    if (!decoded?.uid || signInProvider === 'anonymous') {
      throw new WalkHttpError(401, 'LOGIN_REQUIRED');
    }

    return decoded;
  };

  const resolveAdminDb = () => {
    if (deps.getDb) {
      const injected = deps.getDb();
      if (!injected) {
        throw new WalkHttpError(503, 'WALKS_UNAVAILABLE');
      }
      return injected;
    }
    const { app, reason } = getOrInitWalkAdminApp();
    if (!app) {
      console.warn(`[WALK_GROUPS] Returning 503 WALKS_UNAVAILABLE: ${reason || 'No Admin credentials'}`);
      throw new WalkHttpError(503, 'WALKS_UNAVAILABLE');
    }
    return getAdminFirestore(app, DATABASE_ID);
  };

  const handleRouteError = (res: Response, err: any, routeLabel: string) => {
    if (err instanceof WalkHttpError) {
      return res.status(err.status).json({ error: err.code });
    }
    if (isUnavailableCredentialError(err)) {
      console.warn(
        `[WALK_GROUPS] ${routeLabel} unavailable — FIREBASE_SERVICE_ACCOUNT_JSON is missing and Application Default Credentials do not have Firestore access (${err?.message || err}).`
      );
      return res.status(503).json({ error: 'WALKS_UNAVAILABLE' });
    }
    console.error(`[WALK_GROUPS] Unexpected error in ${routeLabel}:`, err);
    return res.status(500).json({ error: 'Unable to process walk request right now.' });
  };

  // ── 1. CREATE COMMUNITY WALK ─────────────────────────────────────────
  router.post('/', createLimiter, async (req: Request, res: Response) => {
    try {
      const decoded = await verifyBearer(req);
      if (decoded.email_verified !== true) {
        throw new WalkHttpError(403, 'VERIFY_EMAIL');
      }

      const { first_name, node_id, departs_at, capacity: rawCapacity, note, device_id } = req.body ?? {};

      const nameCheck = validateFirstName(first_name);
      if (!nameCheck.ok) {
        return res.status(400).json({ error: nameCheck.error });
      }

      if (typeof node_id !== 'string' || !node_id.trim() || node_id.trim().length > 128) {
        return res.status(400).json({ error: 'A valid hub is required.' });
      }
      const cleanNodeId = node_id.trim();

      if (typeof departs_at !== 'string' || !departs_at.trim()) {
        return res.status(400).json({ error: 'Departure date and time are required.' });
      }
      const departsMs = new Date(departs_at).getTime();
      const nowMs = getNow();
      const minDepartsMs = nowMs + 30 * 60 * 1000;
      const maxDepartsMs = nowMs + 14 * 24 * 60 * 60 * 1000;
      if (Number.isNaN(departsMs) || departsMs < minDepartsMs || departsMs > maxDepartsMs) {
        return res.status(400).json({
          error: 'Departure time must be between 30 minutes and 14 days from now.',
        });
      }

      let capacity = 8;
      if (rawCapacity !== undefined && rawCapacity !== null && rawCapacity !== '') {
        const parsedCap = Number(rawCapacity);
        if (!Number.isInteger(parsedCap) || parsedCap < 2 || parsedCap > 15) {
          return res.status(400).json({ error: 'Group capacity must be a whole number between 2 and 15.' });
        }
        capacity = parsedCap;
      }

      const noteCheck = validateWalkNote(note);
      if (!noteCheck.ok) {
        return res.status(400).json({ error: noteCheck.error });
      }

      const cleanDeviceId =
        typeof device_id === 'string' && device_id.trim().length > 0 && device_id.trim().length <= 200
          ? device_id.trim()
          : null;

      const adminDb = resolveAdminDb();

      // Load existing hub strictly from `nodes`
      const nodeSnap = await adminDb.collection('nodes').doc(cleanNodeId).get();
      if (!nodeSnap.exists) {
        throw new WalkHttpError(404, 'HUB_NOT_FOUND');
      }

      const nodeData = nodeSnap.data() || {};
      const hubLat = Number(nodeData.latitude);
      const hubLng = Number(nodeData.longitude);
      if (Number.isNaN(hubLat) || Number.isNaN(hubLng)) {
        return res.status(400).json({ error: 'Selected hub does not have valid coordinates.' });
      }

      const hubDisplayName = cleanHubDisplayName(nodeData.name, nodeSnap.id);
      const hubAddress =
        typeof nodeData.address === 'string' && nodeData.address.trim()
          ? nodeData.address.trim()
          : hubDisplayName;

      const hostUidHash = sha256Hex(decoded.uid);
      const targetNyDay = getNyCalendarDayKey(departsMs);
      const targetMinuteBucket = Math.floor(departsMs / 60_000);

      // Enforce per-user open-walk limit (<= 2 open groups)
      const userWalksSnap = await adminDb
        .collection('broadcasts')
        .where('host_uid_hash', '==', hostUidHash)
        .get();

      let openUserWalks = 0;
      userWalksSnap.forEach((docSnap: any) => {
        const d = docSnap.data() || {};
        if (d.active === false || d.cancelled_at) return;
        const dep = toTimestampMs(d.departs_at) ?? toTimestampMs(d.starts_at);
        if (dep && dep + 15 * 60_000 > nowMs) {
          openUserWalks += 1;
        }
      });

      if (openUserWalks >= 2) {
        return res.status(429).json({
          error: 'You already have 2 upcoming walks scheduled. Cancel or finish one before starting another.',
        });
      }

      // Enforce per-hub limits: <= 3 community walks/day & <= 1 walk per hub per start time
      const hubWalksSnap = await adminDb
        .collection('broadcasts')
        .where('node_id', '==', nodeSnap.id)
        .get();

      let sameDayCommunityCount = 0;
      let hasSameStartTime = false;

      hubWalksSnap.forEach((docSnap: any) => {
        const d = docSnap.data() || {};
        if (d.type !== 'walking_event' || d.active === false || d.cancelled_at) return;
        const dep = toTimestampMs(d.departs_at) ?? toTimestampMs(d.starts_at);
        if (!dep) return;
        if (Math.floor(dep / 60_000) === targetMinuteBucket) {
          hasSameStartTime = true;
        }
        if (d.walk_kind === 'community' && getNyCalendarDayKey(dep) === targetNyDay) {
          sameDayCommunityCount += 1;
        }
      });

      if (hasSameStartTime) {
        return res.status(409).json({
          error: 'Another walk is already departing from this hub at that time.',
        });
      }

      if (sameDayCommunityCount >= 3) {
        return res.status(429).json({
          error: 'This hub already has 3 community walks scheduled for that day.',
        });
      }

      const departsIso = new Date(departsMs).toISOString();
      const startsTimestamp = Timestamp.fromMillis(departsMs);
      const expiresTimestamp = Timestamp.fromMillis(departsMs + 2 * 60 * 60 * 1000);

      const walkRef = adminDb.collection('broadcasts').doc();
      const spotsRemaining = capacity - 1;
      const memberPreview = [nameCheck.value];

      let hostMemberToken: string | undefined;

      const walkDoc = {
        type: 'walking_event',
        walk_kind: 'community',
        title: `Walk from ${hubDisplayName}`,
        host_name: nameCheck.value,
        host_uid_hash: hostUidHash,
        node_id: nodeSnap.id,
        venue: hubDisplayName,
        address: hubAddress,
        latitude: hubLat,
        longitude: hubLng,
        meeting_point: hubAddress,
        note: noteCheck.value,
        description: noteCheck.value || `Community walk starting at ${hubDisplayName}.`,
        departs_at: departsIso,
        starts_at: startsTimestamp,
        expires_at: expiresTimestamp,
        max_capacity: capacity,
        spots_remaining: spotsRemaining,
        joined_count: 1,
        member_preview: memberPreview,
        active: true,
        price: 0,
        payment_type: 'free',
        scope: 'single_hub',
        current_vibe: 'chill',
        created_at: FieldValue.serverTimestamp(),
      };

      if (cleanDeviceId) {
        hostMemberToken = crypto.randomBytes(24).toString('hex');
        const deviceHash = sha256Hex(cleanDeviceId);
        const memberRef = walkRef.collection('members').doc(deviceHash);
        await adminDb.runTransaction(async (tx: any) => {
          tx.set(walkRef, walkDoc);
          tx.set(memberRef, {
            first_name: nameCheck.value,
            spots: 1,
            member_token_hash: sha256Hex(hostMemberToken!),
            is_host: true,
            joined_at: FieldValue.serverTimestamp(),
          });
        });
      } else {
        await walkRef.set(walkDoc);
      }

      return res.status(201).json({
        ok: true,
        id: walkRef.id,
        ...(hostMemberToken ? { member_token: hostMemberToken, spots: 1 } : {}),
        joined_count: 1,
        spots_remaining: spotsRemaining,
        member_preview: memberPreview,
      });
    } catch (err) {
      return handleRouteError(res, err, 'POST /api/walk-groups');
    }
  });

  // ── 2. JOIN WALK (NO LOGIN REQUIRED, ATOMIC & IDEMPOTENT) ────────────
  router.post('/:id/join', joinLimiter, async (req: Request, res: Response) => {
    try {
      const walkId = String(req.params.id || '').trim();
      if (!walkId || walkId.length > 128) {
        return res.status(400).json({ error: 'Invalid walk ID.' });
      }

      const { first_name, spots: rawSpots, device_id } = req.body ?? {};

      const nameCheck = validateFirstName(first_name);
      if (!nameCheck.ok) {
        return res.status(400).json({ error: nameCheck.error });
      }

      const parsedSpots = rawSpots === undefined ? 1 : Number(rawSpots);
      if (!Number.isInteger(parsedSpots) || parsedSpots < 1 || parsedSpots > 4) {
        return res.status(400).json({ error: 'Spots must be a whole number between 1 and 4.' });
      }

      if (typeof device_id !== 'string' || !device_id.trim() || device_id.trim().length > 200) {
        return res.status(400).json({ error: 'A valid device_id is required.' });
      }

      const deviceHash = sha256Hex(device_id.trim());
      const adminDb = resolveAdminDb();
      const nowMs = getNow();

      const walkRef = adminDb.collection('broadcasts').doc(walkId);
      const memberRef = walkRef.collection('members').doc(deviceHash);

      const txResult = await adminDb.runTransaction(async (tx: any) => {
        const [walkSnap, memberSnap] = await Promise.all([tx.get(walkRef), tx.get(memberRef)]);

        if (!walkSnap.exists) {
          throw new WalkHttpError(404, 'WALK_NOT_FOUND');
        }

        const walkData = walkSnap.data() || {};
        if (walkData.type !== 'walking_event') {
          throw new WalkHttpError(400, 'NOT_A_WALK');
        }
        if (walkData.active === false || walkData.cancelled_at) {
          throw new WalkHttpError(410, 'This walk has been cancelled.');
        }
        if ((walkData.price ?? 0) > 0) {
          throw new WalkHttpError(400, 'Paid walks must be booked through checkout.');
        }

        if (!walkData.is_recurring) {
          const depMs = toTimestampMs(walkData.departs_at) ?? toTimestampMs(walkData.starts_at);
          if (depMs && nowMs > depMs) {
            throw new WalkHttpError(409, 'This walk has already departed.');
          }
        }

        // Idempotent per (broadcast, device): never double-decrement spots_remaining
        if (memberSnap.exists) {
          const existingMember = memberSnap.data() || {};
          const refreshedToken = crypto.randomBytes(24).toString('hex');
          tx.set(
            memberRef,
            {
              member_token_hash: sha256Hex(refreshedToken),
            },
            { merge: true }
          );
          return {
            ok: true,
            already_joined: true,
            member_token: refreshedToken,
            spots: typeof existingMember.spots === 'number' ? existingMember.spots : 1,
            joined_count: typeof walkData.joined_count === 'number' ? walkData.joined_count : 1,
            spots_remaining: typeof walkData.spots_remaining === 'number' ? walkData.spots_remaining : 0,
            member_preview: Array.isArray(walkData.member_preview) ? walkData.member_preview.slice(0, 5) : [],
          };
        }

        const currentJoined = typeof walkData.joined_count === 'number' ? walkData.joined_count : 0;
        const currentRemaining =
          typeof walkData.spots_remaining === 'number'
            ? walkData.spots_remaining
            : typeof walkData.max_capacity === 'number'
              ? Math.max(0, walkData.max_capacity - currentJoined)
              : Math.max(0, 20 - currentJoined);

        if (currentRemaining <= 0) {
          throw new WalkHttpError(409, 'Someone just took the last spot');
        }
        if (currentRemaining < parsedSpots) {
          throw new WalkHttpError(
            409,
            currentRemaining === 1
              ? 'Only 1 spot left on this walk.'
              : `Only ${currentRemaining} spots left on this walk.`
          );
        }

        const memberToken = crypto.randomBytes(24).toString('hex');
        const nextRemaining = currentRemaining - parsedSpots;
        const nextJoined = currentJoined + parsedSpots;

        const existingPreview: string[] = Array.isArray(walkData.member_preview)
          ? walkData.member_preview.filter((x: unknown): x is string => typeof x === 'string')
          : [];
        const nextPreview =
          existingPreview.length < 5
            ? [...existingPreview, nameCheck.value].slice(0, 5)
            : existingPreview.slice(0, 5);

        tx.set(memberRef, {
          first_name: nameCheck.value,
          spots: parsedSpots,
          member_token_hash: sha256Hex(memberToken),
          joined_at: FieldValue.serverTimestamp(),
        });

        tx.update(walkRef, {
          spots_remaining: nextRemaining,
          joined_count: nextJoined,
          member_preview: nextPreview,
        });

        return {
          ok: true,
          already_joined: false,
          member_token: memberToken,
          spots: parsedSpots,
          joined_count: nextJoined,
          spots_remaining: nextRemaining,
          member_preview: nextPreview,
        };
      });

      return res.json(txResult);
    } catch (err) {
      return handleRouteError(res, err, 'POST /api/walk-groups/:id/join');
    }
  });

  // ── 3. LEAVE WALK (NO LOGIN REQUIRED, TOKEN-VERIFIED) ────────────────
  router.post('/:id/leave', leaveLimiter, async (req: Request, res: Response) => {
    try {
      const walkId = String(req.params.id || '').trim();
      if (!walkId || walkId.length > 128) {
        return res.status(400).json({ error: 'Invalid walk ID.' });
      }

      const { device_id, member_token } = req.body ?? {};
      if (typeof device_id !== 'string' || !device_id.trim() || device_id.trim().length > 200) {
        return res.status(400).json({ error: 'A valid device_id is required.' });
      }
      if (typeof member_token !== 'string' || !member_token.trim() || member_token.trim().length > 256) {
        return res.status(400).json({ error: 'A valid member_token is required.' });
      }

      const deviceHash = sha256Hex(device_id.trim());
      const providedTokenHash = sha256Hex(member_token.trim());
      const adminDb = resolveAdminDb();

      const walkRef = adminDb.collection('broadcasts').doc(walkId);
      const memberRef = walkRef.collection('members').doc(deviceHash);

      const txResult = await adminDb.runTransaction(async (tx: any) => {
        const [walkSnap, memberSnap, sampleMembersSnap] = await Promise.all([
          tx.get(walkRef),
          tx.get(memberRef),
          tx.get(walkRef.collection('members').limit(6)),
        ]);

        if (!walkSnap.exists) {
          throw new WalkHttpError(404, 'WALK_NOT_FOUND');
        }
        if (!memberSnap.exists) {
          throw new WalkHttpError(404, 'MEMBERSHIP_NOT_FOUND');
        }

        const memberData = memberSnap.data() || {};
        const storedHash = String(memberData.member_token_hash || '');
        if (!safeEqualHex(providedTokenHash, storedHash)) {
          throw new WalkHttpError(403, 'INVALID_MEMBER_TOKEN');
        }

        const walkData = walkSnap.data() || {};
        const memberSpots = typeof memberData.spots === 'number' ? memberData.spots : 1;
        const currentRemaining = typeof walkData.spots_remaining === 'number' ? walkData.spots_remaining : 0;
        const maxCap = typeof walkData.max_capacity === 'number' ? walkData.max_capacity : undefined;
        const nextRemaining =
          maxCap !== undefined ? Math.min(maxCap, currentRemaining + memberSpots) : currentRemaining + memberSpots;
        const currentJoined = typeof walkData.joined_count === 'number' ? walkData.joined_count : memberSpots;
        const nextJoined = Math.max(0, currentJoined - memberSpots);

        // Remove one instance of leaving member's first_name and backfill up to 5 from remaining members
        const currentPreview: string[] = Array.isArray(walkData.member_preview)
          ? [...walkData.member_preview.filter((x: unknown): x is string => typeof x === 'string')]
          : [];
        const removeIdx = currentPreview.indexOf(String(memberData.first_name || ''));
        if (removeIdx !== -1) {
          currentPreview.splice(removeIdx, 1);
        }

        if (currentPreview.length < 5 && sampleMembersSnap?.docs) {
          for (const docSnap of sampleMembersSnap.docs) {
            if (docSnap.id === deviceHash) continue;
            const otherName = docSnap.data()?.first_name;
            if (typeof otherName === 'string' && otherName && !currentPreview.includes(otherName)) {
              currentPreview.push(otherName);
              if (currentPreview.length >= 5) break;
            }
          }
        }

        const nextPreview = nextJoined === 0 ? [] : currentPreview.slice(0, 5);

        tx.delete(memberRef);
        tx.update(walkRef, {
          spots_remaining: nextRemaining,
          joined_count: nextJoined,
          member_preview: nextPreview,
        });

        return {
          ok: true,
          joined_count: nextJoined,
          spots_remaining: nextRemaining,
          member_preview: nextPreview,
        };
      });

      return res.json(txResult);
    } catch (err) {
      return handleRouteError(res, err, 'POST /api/walk-groups/:id/leave');
    }
  });

  // ── 4. CANCEL WALK (HOST OR ADMIN ONLY) ──────────────────────────────
  router.post('/:id/cancel', cancelLimiter, async (req: Request, res: Response) => {
    try {
      const decoded = await verifyBearer(req);
      const walkId = String(req.params.id || '').trim();
      if (!walkId || walkId.length > 128) {
        return res.status(400).json({ error: 'Invalid walk ID.' });
      }

      const adminDb = resolveAdminDb();
      const walkRef = adminDb.collection('broadcasts').doc(walkId);
      const walkSnap = await walkRef.get();

      if (!walkSnap.exists) {
        throw new WalkHttpError(404, 'WALK_NOT_FOUND');
      }

      const walkData = walkSnap.data() || {};
      const callerUidHash = sha256Hex(decoded.uid);
      const isHost =
        typeof walkData.host_uid_hash === 'string' &&
        safeEqualHex(callerUidHash, walkData.host_uid_hash);

      let isAdmin =
        decoded.email_verified === true &&
        typeof decoded.email === 'string' &&
        (decoded.email === 'vannymwamba@gmail.com' ||
          decoded.email.toLowerCase().endsWith('@urban-hikers.com'));

      if (!isHost && !isAdmin) {
        const [adminDoc, userDoc] = await Promise.all([
          adminDb.collection('admins').doc(decoded.uid).get(),
          adminDb.collection('users').doc(decoded.uid).get(),
        ]);
        if (adminDoc.exists && adminDoc.data()?.role === 'super_admin') {
          isAdmin = true;
        } else if (
          userDoc.exists &&
          (userDoc.data()?.role === 'admin' || userDoc.data()?.role === 'super_admin')
        ) {
          isAdmin = true;
        }
      }

      if (!isHost && !isAdmin) {
        throw new WalkHttpError(403, 'FORBIDDEN');
      }

      await walkRef.update({
        active: false,
        cancelled_at: FieldValue.serverTimestamp(),
      });

      return res.json({ ok: true });
    } catch (err) {
      return handleRouteError(res, err, 'POST /api/walk-groups/:id/cancel');
    }
  });

  // ── 5. REPORT WALK ───────────────────────────────────────────────────
  router.post('/:id/report', reportLimiter, async (req: Request, res: Response) => {
    try {
      const walkId = String(req.params.id || '').trim();
      if (!walkId || walkId.length > 128) {
        return res.status(400).json({ error: 'Invalid walk ID.' });
      }

      const { reason } = req.body ?? {};
      if (typeof reason !== 'string' || !reason.trim()) {
        return res.status(400).json({ error: 'Please provide a short reason for the report.' });
      }
      const trimmedReason = reason.trim();
      if (trimmedReason.length > 200) {
        return res.status(400).json({ error: 'Report reason must be 200 characters or fewer.' });
      }

      const adminDb = resolveAdminDb();
      const walkSnap = await adminDb.collection('broadcasts').doc(walkId).get();
      if (!walkSnap.exists) {
        throw new WalkHttpError(404, 'WALK_NOT_FOUND');
      }

      await adminDb.collection('walk_reports').add({
        broadcast_id: walkId,
        reason: trimmedReason,
        created_at: FieldValue.serverTimestamp(),
      });

      return res.status(201).json({ ok: true });
    } catch (err) {
      return handleRouteError(res, err, 'POST /api/walk-groups/:id/report');
    }
  });

  return router;
}
