import { Router } from 'express';
import { env } from '../config/env';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import { login, logout, refresh, register } from '../controllers/auth.controller';

export const authRouter = Router();

const authLimit = rateLimit({
  scope: 'auth',
  windowSeconds: env.RATE_LIMIT_AUTH_WINDOW_SECONDS,
  max: env.RATE_LIMIT_AUTH_ATTEMPTS,
});

authRouter.post('/v1/auth/register', authLimit, asyncHandler(register));
authRouter.post('/v1/auth/login', authLimit, asyncHandler(login));
authRouter.post('/v1/auth/refresh', asyncHandler(refresh));
authRouter.post('/v1/auth/logout', asyncHandler(logout));
