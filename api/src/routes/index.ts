import { Router } from 'express';
import { healthRouter } from './health.routes';
import { aiRouter } from './ai.routes';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { syncRouter } from './sync.routes';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(aiRouter);
apiRouter.use(authRouter);
apiRouter.use(usersRouter);
apiRouter.use(syncRouter);
