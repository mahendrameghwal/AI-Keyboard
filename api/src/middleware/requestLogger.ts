import type { NextFunction, Request, Response } from 'express';
import { logger } from '../config/logger';

/**
 * The ONLY fields permitted in an access log line. Everything else — request
 * body (user text), headers (including `X-Provider-Key`), query strings — is
 * deliberately excluded (SRS §16.1, §8.6).
 */
export interface RequestLogEntry {
  requestId: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
}

export function buildRequestLogEntry(
  req: Request,
  status: number,
  durationMs: number,
): RequestLogEntry {
  return {
    requestId: req.requestId ?? 'unknown',
    method: req.method,
    // `req.path` (not `req.originalUrl`) so query params can never leak a key.
    path: req.path,
    status,
    durationMs,
    ip: req.ip ?? 'unknown',
  };
}

/**
 * Access logger. Emits a single allowlisted line per request on finish.
 *
 * Intentionally NOT using `pino-http`'s default serializers, which could
 * capture headers/body. There is no body logging on `/v1/ai/*`.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const entry = buildRequestLogEntry(req, res.statusCode, Math.round(durationMs * 100) / 100);
    logger.info(entry, 'request');
  });
  next();
}
