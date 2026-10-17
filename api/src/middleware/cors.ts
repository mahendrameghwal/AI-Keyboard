import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

const ALLOW_HEADERS = 'content-type, x-provider-key, x-request-id';
const ALLOW_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

function parseAllowlist(): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

/**
 * CORS policy (SRS §16.2): deny by default. The only intended client is the
 * mobile app, which is not a browser and needs no CORS at all. Headers are
 * emitted solely for explicitly allowlisted origins.
 */
export function cors(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Vary', 'Origin');

  const origin = req.header('origin');
  const allowlist = parseAllowlist();
  if (origin && allowlist.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', ALLOW_HEADERS);
    res.setHeader('Access-Control-Allow-Methods', ALLOW_METHODS);
    res.setHeader('Access-Control-Max-Age', '600');
  }

  if (req.method === 'OPTIONS') {
    // No allowlisted origin → no CORS headers → the preflight fails in-browser.
    res.status(allowlist.length > 0 && origin ? 204 : 403).end();
    return;
  }

  next();
}
