import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { disconnectDatabase } from './config/database';
import { startBackgroundJobs } from './workers/backgroundJobs';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, env: env.NODE_ENV }, 'AI Keyboard API listening');
});

const stopJobs = startBackgroundJobs();

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Shutting down');
  stopJobs();
  server.close(() => {
    void disconnectDatabase().finally(() => process.exit(0));
  });
  // Force-exit if graceful shutdown stalls.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
