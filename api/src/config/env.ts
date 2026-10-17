import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load `.env` for local development (Node >= 20.12). Skipped in tests so they
// can set DATABASE_URL explicitly, and skipped in production where real env
// vars are injected by the platform.
if (process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'production' && existsSync('.env')) {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore malformed/missing env files; validation below reports real issues.
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  DATABASE_URL: z.string().min(1).optional(),

  CORS_ORIGINS: z.string().default(''),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(2592000),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),

  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_GENERATE_ANON: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_GENERATE_AUTHED: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_PROVIDER_TEST: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_ATTEMPTS: z.coerce.number().int().positive().default(5),

  MAX_REQUEST_BODY_BYTES: z.coerce.number().int().positive().default(65536),
  MAX_TEXT_CHARS: z.coerce.number().int().positive().default(8000),
  MAX_SUMMARIZE_TEXT_CHARS: z.coerce.number().int().positive().default(12000),
  MAX_CUSTOM_INSTRUCTIONS: z.coerce.number().int().positive().default(10),
  MAX_CUSTOM_INSTRUCTION_CHARS: z.coerce.number().int().positive().default(300),

  PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  MODEL_CATALOG_PATH: z.string().optional(),
  MODEL_CATALOG_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  DISABLED_PROVIDERS: z.string().default(''),

  BACKGROUND_JOBS_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),

  RATE_LIMIT_AUTH_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  USAGE_TRACKING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  STREAMING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
