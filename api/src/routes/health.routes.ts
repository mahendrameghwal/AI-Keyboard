import { Router } from 'express';
import { checkDatabase } from '../config/database';

export const healthRouter = Router();

/** Liveness — process is up. Must not depend on external services. */
healthRouter.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

/** Readiness — dependencies reachable. Never calls AI providers. */
healthRouter.get('/v1/health/ready', async (_req, res) => {
  const database = await checkDatabase();
  const status = database ? 'ready' : 'degraded';
  res.status(database ? 200 : 503).json({
    status,
    dependencies: { database },
  });
});
