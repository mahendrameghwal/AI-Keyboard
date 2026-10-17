import type { Request } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

/** Returns the authenticated principal or throws if the route is unprotected. */
export function requireUser(req: Request): { id: string; sessionId: string } {
  if (!req.user) {
    throw new AppError(ErrorCode.UNAUTHENTICATED, 'Authentication required.');
  }
  return req.user;
}
