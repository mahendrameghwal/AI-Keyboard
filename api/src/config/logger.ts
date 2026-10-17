import pino from 'pino';
import { env, isProduction } from './env';

/**
 * Logger with strict redaction.
 *
 * Provider API keys and auth credentials must NEVER appear in logs (SRS §16.1).
 * Log bodies must not contain user text; we redact credential-bearing headers
 * and query params at the logger level as defense in depth.
 */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-provider-key"]',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.authorization',
      '*.apiKey',
      '*.api_key',
      '*.providerKey',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
  transport: isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
});
