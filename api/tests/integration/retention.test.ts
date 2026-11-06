import { existsSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';

// Load .env for local DB tests, then force test mode (the file sets NODE_ENV=development).
if (existsSync('.env')) process.loadEnvFile();
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

const hasDb = Boolean(process.env.DATABASE_URL);
const RUN = `ret-${Date.now()}-`;

let prisma: PrismaClient;

async function createUser(name: string) {
  return prisma.user.create({
    data: { email: `${RUN}${name}@example.com`, passwordHash: 'not-real-hash' },
  });
}

describe.skipIf(!hasDb)('retention + account deletion (database-backed)', () => {
  beforeAll(async () => {
    prisma = (await import('../../src/config/database')).requirePrisma();
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
      await prisma.$disconnect();
    }
  });

  it('pruneExpiredSessions removes expired rows and keeps live ones', async () => {
    const user = await createUser('prune');
    const now = new Date();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenFamilyId: randomUUID(),
        tokenHash: `${RUN}expired-${randomUUID()}`,
        expiresAt: new Date(now.getTime() - 60_000),
      },
    });
    const live = await prisma.session.create({
      data: {
        userId: user.id,
        tokenFamilyId: randomUUID(),
        tokenHash: `${RUN}live-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 60 * 60_000),
      },
    });

    const { pruneExpiredSessions } = await import('../../src/workers/backgroundJobs');
    const removed = await pruneExpiredSessions(now);
    expect(removed).toBeGreaterThanOrEqual(1);

    const remaining = await prisma.session.findMany({ where: { userId: user.id } });
    expect(remaining.map((s) => s.id)).toEqual([live.id]);
  });

  it('pruneUsageEvents drops metric rows past the retention window', async () => {
    // Five years old: older than any retention window an operator would configure.
    const stale = new Date(Date.now() - 5 * 365 * 86_400_000);
    const old = await prisma.usageEvent.create({
      data: {
        action: 'rewrite',
        provider: 'openai',
        model: 'gpt-4o-mini',
        latencyMs: 100,
        status: 'success',
        createdAt: stale,
      },
    });
    const fresh = await prisma.usageEvent.create({
      data: {
        action: 'rewrite',
        provider: 'openai',
        model: 'gpt-4o-mini',
        latencyMs: 100,
        status: 'success',
      },
    });

    const { pruneUsageEvents } = await import('../../src/workers/backgroundJobs');
    // Assert the rows, not the returned count: another suite's request-triggered sweep
    // can prune the same stale rows first, and then this prune legitimately returns 0.
    await pruneUsageEvents();

    expect(await prisma.usageEvent.count({ where: { id: old.id } })).toBe(0);
    expect(await prisma.usageEvent.count({ where: { id: fresh.id } })).toBe(1);
    await prisma.usageEvent.delete({ where: { id: fresh.id } });
  });

  it('purgeUser cascades sessions, devices and preferences', async () => {
    const user = await createUser('purge');
    const device = await prisma.device.create({ data: { userId: user.id, platform: 'android' } });
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenFamilyId: randomUUID(),
        deviceId: device.id,
        tokenHash: `${RUN}purge-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    await prisma.userPreference.create({ data: { userId: user.id } });

    const { purgeUser } = await import('../../src/services/account/purge.service');
    const result = await purgeUser(user.id);

    expect(result.userDeleted).toBe(true);
    expect(result.sessionsDeleted).toBe(1);
    expect(result.devicesDeleted).toBe(1);
    expect(result.preferencesDeleted).toBe(true);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.device.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.userPreference.count({ where: { userId: user.id } })).toBe(0);
  });

  it('purgeUser is idempotent for an already-purged user', async () => {
    const user = await createUser('idempotent');
    const { purgeUser } = await import('../../src/services/account/purge.service');
    await purgeUser(user.id);
    const again = await purgeUser(user.id);
    expect(again).toMatchObject({ userDeleted: true, sessionsDeleted: 0, devicesDeleted: 0 });
  });

  it('processDueJobs runs due deletion jobs and leaves future ones alone', async () => {
    const due = await createUser('due');
    const future = await createUser('future');
    await prisma.accountDeletionJob.create({
      data: { userId: due.id, scheduledFor: new Date(Date.now() - 1000) },
    });
    const futureJob = await prisma.accountDeletionJob.create({
      data: { userId: future.id, scheduledFor: new Date(Date.now() + 5 * 60_000) },
    });

    const { processDueJobs } = await import('../../src/workers/accountDeletionWorker');
    const result = await processDueJobs(50);

    expect(result.succeeded).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.findUnique({ where: { id: due.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: future.id } })).not.toBeNull();
    // The job row cascades away with the user; nothing must be left retrying.
    expect(await prisma.accountDeletionJob.count({ where: { userId: due.id } })).toBe(0);
    expect(
      await prisma.accountDeletionJob.count({ where: { userId: future.id, status: 'pending' } }),
    ).toBe(1);

    await prisma.accountDeletionJob.delete({ where: { id: futureJob.id } });
  });

  it('scheduleAccountDeletion + runJobCycle purges end to end', async () => {
    const user = await createUser('cycle');
    const { scheduleAccountDeletion } = await import('../../src/services/account/account.service');
    await scheduleAccountDeletion(user.id);
    // The real grace period is 30 days; pull the job forward to exercise the cycle.
    await prisma.accountDeletionJob.updateMany({
      where: { userId: user.id },
      data: { scheduledFor: new Date(Date.now() - 1000) },
    });

    const { runJobCycle } = await import('../../src/workers/backgroundJobs');
    const cycle = await runJobCycle();

    expect(cycle.jobs.succeeded).toBeGreaterThanOrEqual(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });
});
