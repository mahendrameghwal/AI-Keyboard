import type { Request, Response } from 'express';
import { requirePrisma } from '../config/database';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { scheduleAccountDeletion } from '../services/account/account.service';
import { requireUser } from '../utils/requireUser';

export async function getProfile(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const prisma = requirePrisma();
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record) {
    throw new AppError(ErrorCode.NOT_FOUND, 'User not found.');
  }
  res.status(200).json({
    id: record.id,
    email: record.email,
    status: record.status,
    createdAt: record.createdAt.toISOString(),
  });
}

export async function deleteAccount(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const job = await scheduleAccountDeletion(user.id);
  res.status(202).json({
    message: 'Account deletion has been scheduled. All sessions have been signed out.',
    deletion: job,
  });
}
