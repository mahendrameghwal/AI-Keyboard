import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import { listSessions, revokeSession } from '../controllers/auth.controller';
import { deleteAccount, getProfile } from '../controllers/users.controller';

export const usersRouter = Router();

usersRouter.get('/v1/users/me', authenticate, asyncHandler(getProfile));
usersRouter.delete('/v1/users/me', authenticate, asyncHandler(deleteAccount));

usersRouter.get('/v1/users/me/sessions', authenticate, asyncHandler(listSessions));
usersRouter.delete('/v1/users/me/sessions/:id', authenticate, asyncHandler(revokeSession));
