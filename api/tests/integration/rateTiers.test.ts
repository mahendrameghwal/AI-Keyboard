import { existsSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';

// Load .env for local DB tests, then force test mode (the file sets NODE_ENV=development).
if (existsSync('.env')) process.loadEnvFile();
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `tier-${Date.now()}-`;

let app: Express;
let prisma: PrismaClient;
let resetRateLimits: () => void;

describe.skipIf(!hasDb)('rate-limit tiers (database-backed)', () => {
  beforeAll(async () => {
    const [{ createApp }, limits] = await Promise.all([
      import('../../src/app'),
      import('../../src/middleware/rateLimit'),
    ]);
    app = createApp();
    prisma = (await import('../../src/config/database')).requirePrisma();
    resetRateLimits = limits.resetRateLimits;
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
      await prisma.$disconnect();
    }
  });

  beforeEach(() => {
    resetRateLimits();
  });

  const generateWithKey = (token?: string) => {
    const call = request(app).post('/v1/ai/generate').set('X-Provider-Key', 'sk-not-a-real-key');
    return call
      .set('Authorization', token ? `Bearer ${token}` : 'Bearer invalid.token.here')
      .send({});
  };

  it('applies the anonymous ceiling without a valid session', async () => {
    const res = await generateWithKey();
    expect(res.headers['x-ratelimit-limit']).toBe('30');
  });

  it('applies the authenticated ceiling for a live access token', async () => {
    const reg = await request(app)
      .post('/v1/auth/register')
      .send({ email: `${RUN}user@example.com`, password: 'Password123!' });
    expect(reg.status).toBe(201);

    const res = await generateWithKey(reg.body.accessToken);
    expect(res.headers['x-ratelimit-limit']).toBe('120');
  });

  it('uses a one-minute window for auth attempts', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email: `${RUN}window@example.com`, password: 'short' });
    // Validation runs after the limiter, so the window header is already set.
    expect(Number(res.headers['x-ratelimit-reset'])).toBeLessThanOrEqual(
      Math.floor(Date.now() / 1000) + 61,
    );
    expect(res.headers['x-ratelimit-limit']).toBe('5');
  });
});
