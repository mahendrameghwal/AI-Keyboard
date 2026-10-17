import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ErrorCode } from '../errors/codes';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Logical scope, keeps buckets for different routes separate. */
  scope: string;
  windowSeconds: number;
  /** Fixed ceiling, or a per-request ceiling (e.g. account holders get a higher tier). */
  max: number | ((req: Request) => number);
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

/**
 * Fixed-window, per-IP rate limiter.
 *
 * NOTE (plan §0.1 / §2.9): this is in-process state and assumes a single
 * backend instance for the MVP. Before horizontal scaling, move the counter to
 * a shared store (Postgres/Redis) or enforce limits at the ingress.
 */
export function rateLimit(options: RateLimitOptions): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    if (buckets.size > MAX_BUCKETS) pruneExpired(now);

    const max = typeof options.max === 'number' ? options.max : options.max(req);
    const key = `${options.scope}:${req.ip ?? 'unknown'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowSeconds * 1000 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: {
          code: ErrorCode.RATE_LIMITED,
          message: 'Too many requests. Please try again later.',
          requestId: req.requestId,
          retryable: true,
          details: { retryAfter },
        },
      });
      return;
    }

    next();
  };
}

function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
