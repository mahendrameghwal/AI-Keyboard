import { existsSync } from 'node:fs';
import { z } from 'zod';

// Load `.env` for local development (Node >= 20.12). Skipped in tests so they
// can set DATABASE_URL explicitly, and skipped in production where real env
// vars are injected by the platform.
if (
  process.env.NODE_ENV !== 'test' &&
  process.env.NODE_ENV !== 'production' &&
  existsSync('.env')
) {
  try {
    process.loadEnvFile();
  } catch {
    // Ignore malformed/missing env files; validation below reports real issues.
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1).optional(),

  CORS_ORIGINS: z.string().default(''),

  /**
   * Proxy hops in front of the app. The rate limiter and logs key on req.ip, so one hop too
   * few makes every visitor share the proxy's IP and one hop too many lets XFF be spoofed.
   * Cloudflare in front of Render is 2; bare Render or a single ingress is 1.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),

  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(604800),
  REFRESH_TOKEN_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().positive().default(2592000),
  JWT_SECRET: z.string().min(1).default('change-me-in-production'),

  RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(3600),
  RATE_LIMIT_GENERATE_ANON: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_GENERATE_AUTHED: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_PROVIDER_TEST: z.coerce.number().int().positive().default(10),
  RATE_LIMIT_AUTH_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Refresh and logout are routine traffic, but token guessing must still be capped. */
  RATE_LIMIT_SESSION_ATTEMPTS: z.coerce.number().int().positive().default(60),

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
  /** Metrics rows are not user data, but they still grow forever without a cutoff. */
  USAGE_EVENT_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  STREAMING_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

export type Env = z.infer<typeof EnvSchema>;

/** A deployed service that signs tokens with a known secret has no authentication at all. */
const GuardedEnvSchema = EnvSchema.superRefine((value, ctx) => {
  if (
    value.NODE_ENV === 'production' &&
    (value.JWT_SECRET === 'change-me-in-production' || value.JWT_SECRET.length < 32)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['JWT_SECRET'],
      message:
        "Production requires JWT_SECRET to be a unique secret of at least 32 characters. Generate one with `node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"`.",
    });
  }
});

export function parseEnv(raw: NodeJS.ProcessEnv = process.env): Env {
  const parsed = GuardedEnvSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

const env: Env = parseEnv();
export { env };

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
