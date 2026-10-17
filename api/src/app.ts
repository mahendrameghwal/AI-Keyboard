import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env';
import { apiRouter } from './routes';
import { requestId } from './middleware/requestId';
import { requestLogger } from './middleware/requestLogger';
import { cors } from './middleware/cors';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind HTTPS ingress (SRS §22.1)

  app.use(helmet()); // includes HSTS, nosniff, frameguard, etc.
  app.use(cors);
  app.use(express.json({ limit: env.MAX_REQUEST_BODY_BYTES }));

  app.use(requestId);
  // Allowlisted access logging only — never bodies, headers, or query strings.
  app.use(requestLogger);
  app.use(apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
