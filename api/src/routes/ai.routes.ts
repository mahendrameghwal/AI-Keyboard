import { Router } from 'express';
import { env } from '../config/env';
import { optionalAuthenticate } from '../middleware/authenticate';
import { requireProviderKey } from '../middleware/providerKey';
import { rateLimit } from '../middleware/rateLimit';
import { asyncHandler } from '../utils/asyncHandler';
import {
  generate,
  listProviders,
  testProvider,
  usage,
} from '../controllers/ai.controller';

export const aiRouter = Router();

aiRouter.post(
  '/v1/ai/generate',
  optionalAuthenticate,
  requireProviderKey,
  rateLimit({
    scope: 'generate',
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    max: (req) => (req.user ? env.RATE_LIMIT_GENERATE_AUTHED : env.RATE_LIMIT_GENERATE_ANON),
  }),
  asyncHandler(generate),
);

aiRouter.get('/v1/ai/providers', listProviders);

aiRouter.post(
  '/v1/ai/providers/test',
  requireProviderKey,
  rateLimit({
    scope: 'providers-test',
    windowSeconds: env.RATE_LIMIT_WINDOW_SECONDS,
    max: env.RATE_LIMIT_PROVIDER_TEST,
  }),
  asyncHandler(testProvider),
);

aiRouter.get('/v1/ai/usage', usage);
