import { requirePrisma } from '../config/database';
import { purgeUser } from '../services/account/purge.service';

const MAX_ATTEMPTS = 5;

export interface ProcessResult {
  processed: number;
  succeeded: number;
  failed: number;
}

/**
 * Processes due account deletion jobs (status pending/processing and
 * scheduledFor <= now). Claimed jobs are marked as processing and retried
 * up to MAX_ATTEMPTS. Actual purge runs inside a transaction in purgeUser.
 */
export async function processDueJobs(batchSize = 10): Promise<ProcessResult> {
  const prisma = requirePrisma();
  const now = new Date();

  const due = await prisma.accountDeletionJob.findMany({
    where: {
      status: { in: ['pending', 'processing'] },
      scheduledFor: { lte: now },
    },
    orderBy: { scheduledFor: 'asc' },
    take: batchSize,
  });

  let succeeded = 0;
  let failed = 0;

  for (const job of due) {
    try {
      await prisma.accountDeletionJob.update({
        where: { id: job.id },
        data: { status: 'processing' },
      });

      await purgeUser(job.userId);

      // Deleting the user cascades this job row away, so record completion only
      // when the row is still present (updateMany tolerates zero matches).
      await prisma.accountDeletionJob.updateMany({
        where: { id: job.id },
        data: { status: 'completed', completedAt: new Date(), error: null },
      });
      succeeded += 1;
    } catch (err) {
      const attempts = job.attempts + 1;
      const message = err instanceof Error ? err.message : 'Unknown error';
      await prisma.accountDeletionJob.updateMany({
        where: { id: job.id },
        data: {
          attempts,
          status: attempts >= MAX_ATTEMPTS ? 'failed' : 'pending',
          error: message.slice(0, 200),
        },
      });
      failed += 1;
    }
  }

  return { processed: due.length, succeeded, failed };
}
