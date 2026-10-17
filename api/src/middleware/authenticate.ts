import type { NextFunction, Request, Response } from 'express';
import { requirePrisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { verifyAccessToken } from '../services/auth/tokens';

/**
 * Verifies the Bearer access token and the backing session, then attaches
 * `req.user`. Access tokens are short-lived; session revocation is enforced
 * here so revoked sessions cannot be used until expiry (SRS §15).
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.header('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Missing or malformed Authorization header.');
    }

    const claims = await verifyAccessToken(token);
    const prisma = requirePrisma();
    const session = await prisma.session.findUnique({ where: { id: claims.sid } });

    if (!session || session.userId !== claims.sub) {
      throw new AppError(ErrorCode.SESSION_EXPIRED, 'The session has expired. Please sign in again.');
    }
    if (session.revokedAt) {
      throw new AppError(ErrorCode.SESSION_REVOKED, 'This session has been revoked.');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(ErrorCode.SESSION_EXPIRED, 'The session has expired. Please sign in again.');
    }

    req.user = { id: claims.sub, sessionId: claims.sid };
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Best-effort variant of {@link authenticate}: identifies a signed-in caller
 * when a usable Bearer token is present, otherwise continues anonymously.
 * Used for tiered rate limits, never for authorization.
 */
export async function optionalAuthenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    next();
    return;
  }
  try {
    const claims = await verifyAccessToken(token);
    const session = await requirePrisma().session.findUnique({ where: { id: claims.sid } });
    if (
      session &&
      session.userId === claims.sub &&
      !session.revokedAt &&
      session.expiresAt.getTime() > Date.now()
    ) {
      req.user = { id: claims.sub, sessionId: claims.sid };
    }
  } catch {
    // Unusable token: treated as anonymous.
  }
  next();
}
