import { getPrisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/env';
import { processDueJobs, type ProcessResult } from './accountDeletionWorker';

export interface JobCycleResult {
  prunedSessions: number;
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

export async function runJobCycle(): Promise<JobCycleResult> {
  const prunedSessions = await pruneExpiredSessions();
  const jobs = await processDueJobs();
  return { prunedSessions, jobs };
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

  let busy = false;
  const tick = async (): Promise<void> => {
    if (busy) return;
    busy = true;
    try {
      const result = await runJobCycle();
      if (result.prunedSessions > 0 || result.jobs.processed > 0) {
        logger.info(result, 'Background job cycle');
      }
    } catch (err) {
      logger.error({ err }, 'Background job cycle failed');
    } finally {
      busy = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), env.BACKGROUND_JOBS_INTERVAL_MINUTES * 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
