import { PrismaClient } from '@prisma/client';
import { env } from './env';
import { logger } from './logger';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

let prisma: PrismaClient | null = null;

/**
 * Returns a lazily-initialized Prisma client, or null when no DATABASE_URL is
 * configured (e.g. unit tests that only exercise pure logic / health).
 */
export function getPrisma(): PrismaClient | null {
  if (!env.DATABASE_URL) return null;
  if (!prisma) {
    prisma = new PrismaClient({ log: ['warn', 'error'] });
  }
  return prisma;
}

/** Like {@link getPrisma} but throws when no database is configured. */
export function requirePrisma(): PrismaClient {
  const client = getPrisma();
  if (!client) {
    throw new AppError(
      ErrorCode.INTERNAL_ERROR,
      'The database is not configured for this deployment.',
    );
  }
  return client;
}

export async function checkDatabase(): Promise<boolean> {
  const client = getPrisma();
  if (!client) return false;
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.warn({ err }, 'Database readiness check failed');
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
