import { z } from 'zod';

/**
 * Client-side mirror of the backend's frozen validation limits (plan §1.4).
 * The server always re-validates; these exist so the keyboard/app can reject
 * obviously invalid input before a request is paid for.
 */
export const LIMITS = {
  maxTextChars: 8_000,
  maxSummarizeTextChars: 12_000,
  maxCustomInstructions: 10,
  maxCustomInstructionChars: 300,
  maxRequestBodyBytes: 65_536,
  maxModelIdChars: 128,
  maxPasswordChars: 128,
  minPasswordChars: 8,
} as const;

export const PROVIDERS = ['openai', 'gemini', 'anthropic'] as const;
export const ACTIONS = [
  'fix',
  'rewrite',
  'shorten',
  'expand',
  'summarize',
  'explain',
  'continue',
  'email',
  'reply',
] as const;
export const TONES = [
  'professional',
  'casual',
  'polite',
  'funny',
  'friendly',
  'romantic',
  'confident',
  'empathetic',
  'neutral',
] as const;
export const TONE_STRENGTHS = ['soft', 'balanced', 'hard'] as const;
export const FORMALITIES = ['formal', 'neutral', 'informal'] as const;
export const LENGTHS = ['very_short', 'short', 'normal', 'detailed', 'elaborate'] as const;
export const PLATFORMS = ['android', 'ios'] as const;
export const LANGUAGE_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/** Canonical error codes (plan §1.3). Kept in sync by tests/unit drift checks. */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_PROVIDER_KEY',
  'UNSUPPORTED_MODEL',
  'MODEL_DEPRECATED',
  'PROVIDER_CONTENT_BLOCKED',
  'EMPTY_RESPONSE',
  'PROVIDER_RATE_LIMITED',
  'PROVIDER_UNAVAILABLE',
  'PROVIDER_TIMEOUT',
  'RATE_LIMITED',
  'REQUEST_TOO_LARGE',
  'STREAM_NOT_SUPPORTED',
  'PREFERENCES_VERSION_CONFLICT',
  'SESSION_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'SESSION_REVOKED',
  'EMAIL_ALREADY_EXISTS',
  'INVALID_CREDENTIALS',
  'INTERNAL_ERROR',
] as const;

export type Provider = (typeof PROVIDERS)[number];
export type Action = (typeof ACTIONS)[number];
export type Tone = (typeof TONES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];

const SettingsSchema = z
  .object({
    tone: z.enum(TONES).optional(),
    toneStrength: z.enum(TONE_STRENGTHS).optional(),
    formality: z.enum(FORMALITIES).optional(),
    length: z.enum(LENGTHS).optional(),
    language: z.string().regex(LANGUAGE_PATTERN, 'Invalid language tag.').optional(),
  })
  .strict();

export const GenerateRequestSchema = z
  .object({
    provider: z.enum(PROVIDERS),
    model: z.string().min(1).max(LIMITS.maxModelIdChars),
    action: z.enum(ACTIONS),
    text: z.string().min(1).max(LIMITS.maxSummarizeTextChars),
    settings: SettingsSchema.optional(),
    customInstructions: z
      .array(z.string().min(1).max(LIMITS.maxCustomInstructionChars))
      .max(LIMITS.maxCustomInstructions)
      .optional(),
    options: z.object({ stream: z.boolean().optional() }).strict().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.action !== 'summarize' && value.text.length > LIMITS.maxTextChars) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: `text must be at most ${LIMITS.maxTextChars} characters for action "${value.action}".`,
      });
    }
  });

export const ProviderTestSchema = z.object({ provider: z.enum(PROVIDERS) }).strict();

export const PreferencesSchema = z
  .object({
    writingStyle: z.enum(TONES),
    toneStrength: z.enum(TONE_STRENGTHS),
    formality: z.enum(FORMALITIES),
    defaultLength: z.enum(LENGTHS),
    language: z.string().regex(LANGUAGE_PATTERN),
    version: z.number().int().positive(),
  })
  .strict();

/** `PUT` body: the five synced fields plus the version the client last read. */
export const PreferencesUpdateSchema = PreferencesSchema;

export const DeviceSchema = z
  .object({
    platform: z.enum(PLATFORMS),
    name: z.string().min(1).max(100).optional(),
  })
  .strict();

const EmailSchema = z.string().email().max(254);
const RefreshTokenSchema = z.string().min(1).max(512);

export const RegisterSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(LIMITS.minPasswordChars).max(LIMITS.maxPasswordChars),
    device: DeviceSchema.optional(),
  })
  .strict();

export const LoginSchema = z
  .object({
    email: EmailSchema,
    password: z.string().min(1).max(LIMITS.maxPasswordChars),
    device: DeviceSchema.optional(),
  })
  .strict();

export const RefreshSchema = z.object({ refreshToken: RefreshTokenSchema }).strict();
export const LogoutSchema = z.object({ refreshToken: RefreshTokenSchema }).strict();

export const SessionSchema = z.object({
  id: z.string().uuid(),
  deviceId: z.string().uuid().nullable().optional(),
  device: z
    .object({ platform: z.enum(PLATFORMS), name: z.string().nullable().optional() })
    .nullable()
    .optional(),
  createdAt: z.string(),
  lastUsedAt: z.string(),
  expiresAt: z.string(),
  refreshTokenExpiresAt: z.string().optional(),
});

export const SessionListSchema = z.object({ sessions: z.array(SessionSchema) }).strict();

export const ErrorEnvelopeSchema = z.object({
  error: z
    .object({
      code: z.enum(ERROR_CODES),
      message: z.string(),
      requestId: z.string().optional(),
      retryable: z.boolean(),
      details: z.unknown().optional(),
    })
    .strict(),
});

/** `POST /v1/ai/generate` success payload; `result` and `email` are mutually exclusive in practice. */
export const GenerateResponseSchema = z
  .object({
    requestId: z.string(),
    success: z.boolean(),
    provider: z.enum(PROVIDERS),
    model: z.string(),
    result: z.string().optional(),
    email: z.object({ subject: z.string(), body: z.string() }).strict().optional(),
    usage: z
      .object({
        inputTokens: z.number().int().optional(),
        outputTokens: z.number().int().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ProviderCatalogSchema = z.object({
  providers: z.array(
    z
      .object({
        id: z.string(),
        name: z.string(),
        defaultModel: z.string(),
        fallbackModel: z.string().optional(),
        models: z.array(
          z
            .object({
              id: z.string(),
              status: z.enum(['active', 'deprecated']),
              capabilities: z.array(z.string()),
            })
            .strict(),
        ),
      })
      .strict(),
  ),
});

export const AuthTokensSchema = z
  .object({
    user: z.object({ id: z.string().uuid(), email: z.string() }).strict(),
    accessToken: z.string(),
    refreshToken: z.string(),
    accessTokenExpiresIn: z.number().int().positive(),
  })
  .strict();

export type GenerateRequestInput = z.infer<typeof GenerateRequestSchema>;
export type GenerateResponseOutput = z.infer<typeof GenerateResponseSchema>;
export type PreferencesOutput = z.infer<typeof PreferencesSchema>;
export type ProviderCatalogOutput = z.infer<typeof ProviderCatalogSchema>;
export type AuthTokensOutput = z.infer<typeof AuthTokensSchema>;
export type ErrorEnvelopeOutput = z.infer<typeof ErrorEnvelopeSchema>;
export type DeviceInput = z.infer<typeof DeviceSchema>;
