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
const RUN = `itest-${Date.now()}-`;
const PASSWORD = 'Password123!';

let app: Express;
let prisma: PrismaClient;
let resetRateLimits: () => void;

describe.skipIf(!hasDb)('auth + sync (database-backed)', () => {
  beforeAll(async () => {
    const [{ createApp }, { requirePrisma }, limits] = await Promise.all([
      import('../../src/app'),
      import('../../src/config/database'),
      import('../../src/middleware/rateLimit'),
    ]);
    app = createApp();
    prisma = requirePrisma();
    resetRateLimits = limits.resetRateLimits;
  });

  beforeEach(() => {
    resetRateLimits();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
      await prisma.$disconnect();
    }
  });

  const email = (name: string) => `${RUN}${name}@example.com`;

  async function registerUser(name: string) {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email: email(name), password: PASSWORD, device: { platform: 'android', name: 'Pixel' } });
    return res;
  }

  it('registers a user and normalizes the email', async () => {
    const res = await request(app)
      .post('/v1/auth/register')
      .send({ email: `${RUN}Case@Example.com`, password: PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(`${RUN}case@example.com`);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.accessTokenExpiresIn).toBe(900);
  });

  it('rejects duplicate registration', async () => {
    await registerUser('dup');
    const res = await registerUser('dup');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  it('rejects a wrong password', async () => {
    await registerUser('login');
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: email('login'), password: 'WrongPassword1' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh tokens and detects reuse', async () => {
    const reg = await registerUser('rotate');
    const oldRefresh = reg.body.refreshToken as string;
    const userId = reg.body.user.id as string;

    const rotated = await request(app).post('/v1/auth/refresh').send({ refreshToken: oldRefresh });
    expect(rotated.status).toBe(200);
    expect(rotated.body.refreshToken).not.toBe(oldRefresh);

    // Backdate the revoked session beyond the grace window to simulate reuse.
    await prisma.session.updateMany({
      where: { userId, revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 120_000) },
    });

    const reused = await request(app).post('/v1/auth/refresh').send({ refreshToken: oldRefresh });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('REFRESH_TOKEN_REUSED');

    // Family must be fully revoked after reuse detection.
    const active = await prisma.session.count({ where: { userId, revokedAt: null } });
    expect(active).toBe(0);
  });

  it('requires auth for protected routes', async () => {
    const res = await request(app).get('/v1/sync/preferences');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('handles preferences with optimistic concurrency', async () => {
    const reg = await registerUser('prefs');
    const token = reg.body.accessToken as string;

    const initial = await request(app)
      .get('/v1/sync/preferences')
      .set('Authorization', `Bearer ${token}`);
    expect(initial.status).toBe(200);
    expect(initial.body.version).toBe(1);

    const updated = await request(app)
      .put('/v1/sync/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        writingStyle: 'professional',
        toneStrength: 'soft',
        formality: 'formal',
        defaultLength: 'short',
        language: 'en-US',
        version: 1,
      });
    expect(updated.status).toBe(200);
    expect(updated.body.version).toBe(2);

    const conflict = await request(app)
      .put('/v1/sync/preferences')
      .set('Authorization', `Bearer ${token}`)
      .send({
        writingStyle: 'casual',
        toneStrength: 'balanced',
        formality: 'neutral',
        defaultLength: 'normal',
        language: 'en-US',
        version: 1,
      });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('PREFERENCES_VERSION_CONFLICT');
    expect(conflict.body.error.details.currentVersion).toBe(2);
  });

  it('lists and revokes sessions', async () => {
    const reg = await registerUser('sessions');
    const token = reg.body.accessToken as string;
    const sessionId = reg.body.sessionId ?? undefined;

    const list = await request(app)
      .get('/v1/users/me/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(1);
    expect(list.body.sessions[0].current).toBe(true);

    const targetId = sessionId ?? list.body.sessions[0].id;
    const revoked = await request(app)
      .delete(`/v1/users/me/sessions/${targetId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(revoked.status).toBe(204);

    const after = await request(app)
      .get('/v1/users/me/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_REVOKED');
  });

  it('schedules account deletion and revokes sessions', async () => {
    const reg = await registerUser('delete');
    const token = reg.body.accessToken as string;

    const del = await request(app)
      .delete('/v1/users/me')
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(202);
    expect(del.body.deletion.status).toBe('pending');

    const after = await request(app)
      .get('/v1/sync/preferences')
      .set('Authorization', `Bearer ${token}`);
    expect(after.status).toBe(401);
    expect(after.body.error.code).toBe('SESSION_REVOKED');
  });
});
