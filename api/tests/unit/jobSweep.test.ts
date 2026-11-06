import { describe, expect, it, vi } from 'vitest';
import { env } from '../../src/config/env';

vi.mock('../../src/config/database', () => ({ getPrisma: () => null }));
vi.mock('../../src/workers/accountDeletionWorker', () => ({
  processDueJobs: vi.fn().mockResolvedValue({ processed: 0, succeeded: 0, failed: 0 }),
}));

const { launchJobSweep } = await import('../../src/workers/backgroundJobs');

const intervalMs = env.BACKGROUND_JOBS_INTERVAL_MINUTES * 60_000;

describe('job sweep throttling', () => {
  it('launches once per interval, not once per request', async () => {
    const base = Date.now() + 10_000_000;
    expect(launchJobSweep(base)).toBe(true);
    expect(launchJobSweep(base + 1_000)).toBe(false);

    await new Promise((resolve) => setImmediate(resolve)); // let the cycle finish
    expect(launchJobSweep(base + intervalMs)).toBe(true);
  });
});
