/**
 * rateLimiter.ts
 * Lightweight in-memory rate limiter — no Redis, no extra deps.
 * Safe for single-process Node.js (Railway, AI Studio).
 *
 * Usage:
 *   import { createRateLimiter } from './rateLimiter.ts';
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });
 *   app.post('/api/creator/ignite', limiter, async (req, res) => { ... });
 */

import type { Request, Response, NextFunction } from 'express';

interface RateLimiterOptions {
  windowMs: number;   // Rolling window in milliseconds
  max: number;        // Max requests per IP per window
  message?: string;   // Optional custom error message
}

interface HitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter({ windowMs, max, message }: RateLimiterOptions) {
  const store = new Map<string, HitRecord>();

  // Prune expired entries every windowMs to prevent memory leak
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (record.resetAt <= now) store.delete(key);
    }
  }, windowMs);

  return function rateLimiter(req: Request, res: Response, next: NextFunction) {
    // Prefer X-Forwarded-For (Railway/Vercel proxy) over socket IP
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';

    const now = Date.now();
    const record = store.get(ip);

    if (!record || record.resetAt <= now) {
      // First hit in this window
      store.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: message ?? 'Too many requests. Please wait before igniting again.',
        retryAfterSeconds: retryAfterSec,
      });
    }

    record.count += 1;
    return next();
  };
}
