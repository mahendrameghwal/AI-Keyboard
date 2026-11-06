import { getPrisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { processDueJobs, type ProcessResult } from './accountDeletionWorker';

export interface JobCycleResult {
  prunedSessions: number;
  prunedUsageEvents: number;
  jobs: ProcessResult;
}

/**
 * Hard-deletes sessions past their expiry. Expired tokens can never be rotated
 * (auth.service refuses them) so the rows have no remaining purpose (plan §1.10).
 * Revoked-but-unexpired rows are kept: the refresh grace window still reads them.
 */
export async function pruneExpiredSessions(now = new Date()): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;
  const { count } = await prisma.session.deleteMany({ where: { expiresAt: { lte: now } } });
  return count;
}

/** Drops metric rows past USAGE_EVENT_RETENTION_DAYS; nothing else bounds their growth. */
export async function pruneUsageEvents(now = new Date()): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) return 0;
  const cutoff = new Date(now.getTime() - env.USAGE_EVENT_RETENTION_DAYS * 86_400_000);
  const { count } = await prisma.usageEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return count;
}

export async function runJobCycle(): Promise<JobCycleResult> {
  const prunedSessions = await pruneExpiredSessions();
  const prunedUsageEvents = await pruneUsageEvents();
  const jobs = await processDueJobs();
  return { prunedSessions, prunedUsageEvents, jobs };
}

let sweepInFlight = false;
let lastSweepMs = 0;

/**
 * Runs a cycle if the interval has elapsed and returns whether it started.
 * A hosted instance sleeps between requests, so the timer alone can starve
 * housekeeping; letting ordinary traffic pay for the sweep fixes that without
 * a second service.
 */
export function launchJobSweep(now = Date.now()): boolean {
  if (sweepInFlight || now - lastSweepMs < env.BACKGROUND_JOBS_INTERVAL_MINUTES * 60_000) {
    return false;
  }
  lastSweepMs = now;
  sweepInFlight = true;
  void runJobCycle()
    .then((result) => {
      if (result.prunedSessions > 0 || result.prunedUsageEvents > 0 || result.jobs.processed > 0) {
        logger.info(result, 'Background job cycle');
      }
    })
    .catch((err) => logger.error({ err }, 'Background job cycle failed'))
    .finally(() => {
      sweepInFlight = false;
    });
  return true;
}

/**
 * Starts the in-process retention/deletion loop and returns a stop function.
 * Single-instance only, like the in-memory rate limiter (plan §0.1); move to a
 * scheduled job or queue before running more than one instance.
 */
export function startBackgroundJobs(): () => void {
  if (!env.DATABASE_URL) {
    logger.warn('Background jobs not started: no DATABASE_URL configured.');
    return () => undefined;
  }

  launchJobSweep();
  const timer = setInterval(
    () => void launchJobSweep(),
    env.BACKGROUND_JOBS_INTERVAL_MINUTES * 60_000,
  );
  timer.unref();
  return () => clearInterval(timer);
}
