import { requirePrisma } from '../../config/database';

/** Account deletion is scheduled, not immediate (plan T7.5). */
const DELETION_GRACE_DAYS = 30;

export interface DeletionJobView {
  id: string;
  status: string;
  requestedAt: string;
  scheduledFor: string;
}

/**
 * Schedules asynchronous account deletion for the next purge run and revokes
 * all of the user's active sessions immediately. The purge itself is performed
 * by the background job loop (`workers/backgroundJobs.ts`) and is idempotent
 * per job.
 */
export async function scheduleAccountDeletion(userId: string): Promise<DeletionJobView> {
  const prisma = requirePrisma();
  const now = new Date();
  const scheduledFor = new Date(now.getTime() + DELETION_GRACE_DAYS * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.accountDeletionJob.findFirst({
      where: { userId, status: { in: ['pending', 'processing'] } },
    });
    const job =
      existing ??
      (await tx.accountDeletionJob.create({
        data: { userId, scheduledFor },
      }));

    await tx.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: now },
    });

    return {
      id: job.id,
      status: job.status,
      requestedAt: job.requestedAt.toISOString(),
      scheduledFor: job.scheduledFor.toISOString(),
    };
  });
}
