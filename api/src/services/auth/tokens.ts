import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/codes';

const secret = new TextEncoder().encode(env.JWT_SECRET);

export interface AccessTokenClaims {
  sub: string;
  sid: string;
}

export async function signAccessToken(claims: AccessTokenClaims): Promise<string> {
  return new SignJWT({ sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    const { sub, sid } = payload as { sub?: unknown; sid?: unknown };
    if (typeof sub !== 'string' || typeof sid !== 'string') {
      throw new AppError(ErrorCode.UNAUTHENTICATED, 'Invalid access token.');
    }
    return { sub, sid };
  } catch (err) {
    if (err instanceof AppError) throw err;
    const expired = err instanceof Error && err.name === 'JWTExpired';
    throw new AppError(
      expired ? ErrorCode.SESSION_EXPIRED : ErrorCode.UNAUTHENTICATED,
      expired ? 'The session has expired. Please sign in again.' : 'Invalid access token.',
    );
  }
}

/** Opaque, high-entropy refresh token (never stored in plaintext). */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Refresh tokens are stored only as a SHA-256 hash. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
