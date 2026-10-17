import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const HEADER = 'x-request-id';
const SAFE_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Generates (or trusts a well-formed client-supplied) request id and echoes it
 * on every response so failures can be correlated across mobile and backend.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER);
  const id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
