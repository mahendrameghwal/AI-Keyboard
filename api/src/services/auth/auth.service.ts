import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { requirePrisma } from '../../config/database';
import { env } from '../../config/env';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/codes';
import { hashPassword, verifyPassword } from './password';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from './tokens';

/** Grace window for racing refreshes before treating a token as reused. */
const REFRESH_GRACE_MS = 60_000;

export interface DeviceInput {
  platform: 'android' | 'ios';
  name?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: string;
}

export interface AuthResult extends AuthTokens {
  user: { id: string; email: string };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function absoluteExpiry(familyStartedAt: Date): Date {
  return new Date(familyStartedAt.getTime() + env.REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS * 1000);
}

async function createDevice(
  prisma: PrismaClient,
  userId: string,
  device?: DeviceInput,
): Promise<string | undefined> {
  if (!device) return undefined;
  const created = await prisma.device.create({
    data: { userId, platform: device.platform, name: device.name ?? null },
  });
  return created.id;
}

/** Mints a rotating refresh token + access token and persists the new session. */
async function issueTokens(
  prisma: PrismaClient,
  userId: string,
  familyId: string,
  familyStartedAt: Date,
  deviceId?: string,
): Promise<AuthTokens & { sessionId: string }> {
  const now = Date.now();
  const idleExpiry = new Date(now + env.REFRESH_TOKEN_TTL_SECONDS * 1000);
  const hardExpiry = absoluteExpiry(familyStartedAt);
  const expiresAt = idleExpiry < hardExpiry ? idleExpiry : hardExpiry;

  const refreshToken = generateRefreshToken();
  const session = await prisma.session.create({
    data: {
      userId,
      tokenFamilyId: familyId,
      familyStartedAt,
      tokenHash: hashRefreshToken(refreshToken),
      deviceId: deviceId ?? null,
      expiresAt,
    },
  });

  const accessToken = await signAccessToken({ sub: userId, sid: session.id });
  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenExpiresAt: expiresAt.toISOString(),
    sessionId: session.id,
  };
}

export async function register(input: {
  email: string;
  password: string;
  device?: DeviceInput;
}): Promise<AuthResult> {
  const prisma = requirePrisma();
  const email = normalizeEmail(input.email);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(ErrorCode.EMAIL_ALREADY_EXISTS, 'An account with this email already exists.');
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({ data: { email, passwordHash } });
  const deviceId = await createDevice(prisma, user.id, input.device);

  const tokens = await issueTokens(prisma, user.id, randomUUID(), new Date(), deviceId);
  return { user: { id: user.id, email: user.email }, ...stripSessionId(tokens) };
}

export async function login(input: {
  email: string;
  password: string;
  device?: DeviceInput;
}): Promise<AuthResult> {
  const prisma = requirePrisma();
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({ where: { email } });
  // Constant-ish behavior: always run a verify to reduce user enumeration.
  const ok = user ? await verifyPassword(user.passwordHash, input.password) : false;
  if (!user || !ok || user.status !== 'active') {
    throw new AppError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password.');
  }

  const deviceId = await createDevice(prisma, user.id, input.device);
  const tokens = await issueTokens(prisma, user.id, randomUUID(), new Date(), deviceId);
  return { user: { id: user.id, email: user.email }, ...stripSessionId(tokens) };
}

export async function refresh(input: { refreshToken: string }): Promise<AuthTokens> {
  const prisma = requirePrisma();
  const tokenHash = hashRefreshToken(input.refreshToken);
  const now = new Date();

  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) {
    throw new AppError(ErrorCode.SESSION_EXPIRED, 'The session has expired. Please sign in again.');
  }
  if (session.expiresAt <= now) {
    throw new AppError(ErrorCode.SESSION_EXPIRED, 'The session has expired. Please sign in again.');
  }
  if (absoluteExpiry(session.familyStartedAt) <= now) {
    throw new AppError(ErrorCode.SESSION_EXPIRED, 'The session has expired. Please sign in again.');
  }

  if (session.revokedAt) {
    const withinGrace = now.getTime() - session.revokedAt.getTime() <= REFRESH_GRACE_MS;
    if (!withinGrace) {
      // Reuse of a rotated/revoked token → assume compromise, kill the family.
      const hasActiveSuccessor = await prisma.session.findFirst({
        where: {
          tokenFamilyId: session.tokenFamilyId,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      });
      if (hasActiveSuccessor) {
        await revokeFamily(prisma, session.tokenFamilyId);
        throw new AppError(
          ErrorCode.REFRESH_TOKEN_REUSED,
          'This session was already used. For your security, all sessions on this device were signed out.',
        );
      }
      throw new AppError(ErrorCode.SESSION_REVOKED, 'This session has been revoked.');
    }
    // Within grace: benign race, allow re-rotation.
  }

  return prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: { revokedAt: now, lastUsedAt: now },
    });
    const tokens = await issueTokens(
      tx as PrismaClient,
      session.userId,
      session.tokenFamilyId,
      session.familyStartedAt,
      session.deviceId ?? undefined,
    );
    return stripSessionId(tokens);
  });
}

export async function logout(input: { refreshToken: string }): Promise<void> {
  const prisma = requirePrisma();
  const tokenHash = hashRefreshToken(input.refreshToken);
  const session = await prisma.session.findUnique({ where: { tokenHash } });
  if (!session) return; // Idempotent logout.
  await revokeFamily(prisma, session.tokenFamilyId);
}

export async function listSessions(userId: string, currentSessionId: string) {
  const prisma = requirePrisma();
  const now = new Date();
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { lastUsedAt: 'desc' },
    include: { device: true },
  });
  return sessions.map((s) => ({
    id: s.id,
    current: s.id === currentSessionId,
    createdAt: s.createdAt.toISOString(),
    lastUsedAt: s.lastUsedAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
    device: s.device
      ? { platform: s.device.platform, name: s.device.name }
      : null,
  }));
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  const prisma = requirePrisma();
  const session = await prisma.session.findFirst({ where: { id: sessionId, userId } });
  if (!session) {
    throw new AppError(ErrorCode.NOT_FOUND, 'Session not found.');
  }
  await revokeFamily(prisma, session.tokenFamilyId);
}

async function revokeFamily(prisma: PrismaClient, familyId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { tokenFamilyId: familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

function stripSessionId(tokens: AuthTokens & { sessionId: string }): AuthTokens {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresIn: tokens.accessTokenExpiresIn,
    refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
  };
}
