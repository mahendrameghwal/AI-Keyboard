import type { Prisma } from '@prisma/client';
import { requirePrisma } from '../../config/database';

export interface PurgeResult {
  userDeleted: boolean;
  sessionsDeleted: number;
  devicesDeleted: number;
  preferencesDeleted: boolean;
  jobsDeleted: number;
  usageEventsOrphaned: number;
}

/**
 * Executes the purge phase for a scheduled account deletion.
 *
 * Deletion scope (per plan §7.5 / §14): removes the user row and cascades
 * sessions, devices, preferences, and pending/completed deletion jobs. Usage
 * events remain (userId set to NULL via ON DELETE SET NULL) and contain no
 * message text.
 */
export async function purgeUser(userId: string): Promise<PurgeResult> {
  const prisma = requirePrisma();
  const now = new Date();

  return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Idempotent: user already purged.
      return {
        userDeleted: true,
        sessionsDeleted: 0,
        devicesDeleted: 0,
        preferencesDeleted: false,
        jobsDeleted: 0,
        usageEventsOrphaned: 0,
      };
    }

    const [sessions, devices, prefs, jobs] = await Promise.all([
      tx.session.count({ where: { userId } }),
      tx.device.count({ where: { userId } }),
      tx.userPreference.count({ where: { userId } }),
      tx.accountDeletionJob.count({ where: { userId } }),
    ]);

    await tx.user.delete({ where: { id: userId } });

    const orphaned = await tx.usageEvent.count({
      where: { userId: null, createdAt: { lte: now } },
    });

    return {
      userDeleted: true,
      sessionsDeleted: sessions,
      devicesDeleted: devices,
      preferencesDeleted: prefs > 0,
      jobsDeleted: jobs,
      usageEventsOrphaned: orphaned,
    };
  }, {
    timeout: 20000,
    maxWait: 10000,
  });
}
