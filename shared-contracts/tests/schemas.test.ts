import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ACTIONS,
  ERROR_CODES,
  GenerateRequestSchema,
  LIMITS,
  PreferencesSchema,
  PROVIDERS,
  TONES,
  GenerateResponseSchema,
  ProviderCatalogSchema,
} from '../src/schemas';

// The backend validators are the authority; the client mirror must not drift.
const apiAiValidators = await import('../../api/src/validators/ai.validators');
const apiSyncValidators = await import('../../api/src/validators/sync.validators');
const apiCodes = await import('../../api/src/errors/codes');

const validBody = {
  provider: 'openai' as const,
  model: 'gpt-4o-mini',
  action: 'rewrite' as const,
  text: 'make this better',
};

describe('shared contract drift against the API', () => {
  it('mirrors the provider, action, tone and length enums exactly', () => {
    expect([...PROVIDERS].sort()).toEqual([...apiAiValidators.PROVIDERS].sort());
    expect([...ACTIONS].sort()).toEqual([...apiAiValidators.ACTIONS].sort());
    expect([...TONES].sort()).toEqual([...apiAiValidators.TONES].sort());
  });

  it('mirrors every canonical error code', () => {
    const serverCodes = Object.values(apiCodes.ErrorCode) as string[];
    expect([...ERROR_CODES].sort()).toEqual([...serverCodes].sort());
  });

  it('agrees with the API on the frozen validation limits', () => {
    const env = readFileSync(join(__dirname, '..', '..', 'api', '.env.example'), 'utf8');
    const readNumber = (key: string): number =>
      Number(new RegExp(`^${key}=(\\d+)$`, 'm').exec(env)?.[1]);

    expect(LIMITS.maxTextChars).toBe(readNumber('MAX_TEXT_CHARS'));
    expect(LIMITS.maxSummarizeTextChars).toBe(readNumber('MAX_SUMMARIZE_TEXT_CHARS'));
    expect(LIMITS.maxCustomInstructions).toBe(readNumber('MAX_CUSTOM_INSTRUCTIONS'));
    expect(LIMITS.maxCustomInstructionChars).toBe(readNumber('MAX_CUSTOM_INSTRUCTION_CHARS'));
    expect(LIMITS.maxRequestBodyBytes).toBe(readNumber('MAX_REQUEST_BODY_BYTES'));
  });

  it('accepts the same payloads the API accepts and rejects the same ones', () => {
    expect(GenerateRequestSchema.safeParse(validBody).success).toBe(true);
    expect(apiAiValidators.GenerateRequestSchema.safeParse(validBody).success).toBe(true);

    const unknownKey = { ...validBody, systemPrompt: 'do evil' };
    expect(GenerateRequestSchema.safeParse(unknownKey).success).toBe(false);
    expect(apiAiValidators.GenerateRequestSchema.safeParse(unknownKey).success).toBe(false);
  });

  it('uses the same preference field set as the sync validator', () => {
    const prefs = {
      writingStyle: 'professional',
      toneStrength: 'balanced',
      formality: 'neutral',
      defaultLength: 'normal',
      language: 'en-IN',
      version: 1,
    };
    expect(PreferencesSchema.safeParse(prefs).success).toBe(true);
    expect(apiSyncValidators.PreferencesUpdateSchema.safeParse(prefs).success).toBe(true);

    // Custom instructions are device-only (plan D7) and must not be syncable.
    expect(PreferencesSchema.safeParse({ ...prefs, customInstructions: ['x'] }).success).toBe(
      false,
    );
  });
});

describe('generate request limits', () => {
  it('caps non-summarize input at 8000 characters', () => {
    expect(
      GenerateRequestSchema.safeParse({ ...validBody, text: 'a'.repeat(LIMITS.maxTextChars) })
        .success,
    ).toBe(true);
    const tooLong = GenerateRequestSchema.safeParse({
      ...validBody,
      text: 'a'.repeat(LIMITS.maxTextChars + 1),
    });
    expect(tooLong.success).toBe(false);
  });

  it('allows 12000 characters only for summarize', () => {
    const long = 'a'.repeat(LIMITS.maxSummarizeTextChars);
    expect(
      GenerateRequestSchema.safeParse({ ...validBody, action: 'summarize', text: long }).success,
    ).toBe(true);
    expect(
      GenerateRequestSchema.safeParse({ ...validBody, action: 'expand', text: long }).success,
    ).toBe(false);
  });

  it('caps custom instructions at 10 items of 300 characters', () => {
    expect(
      GenerateRequestSchema.safeParse({
        ...validBody,
        customInstructions: Array.from({ length: LIMITS.maxCustomInstructions }, () =>
          'x'.repeat(300),
        ),
      }).success,
    ).toBe(true);
    expect(
      GenerateRequestSchema.safeParse({
        ...validBody,
        customInstructions: Array.from({ length: 11 }, () => 'stay formal'),
      }).success,
    ).toBe(false);
    expect(
      GenerateRequestSchema.safeParse({ ...validBody, customInstructions: ['x'.repeat(301)] })
        .success,
    ).toBe(false);
  });

  it('rejects empty text and an unsupported BCP-47 tag', () => {
    expect(GenerateRequestSchema.safeParse({ ...validBody, text: '' }).success).toBe(false);
    expect(
      GenerateRequestSchema.safeParse({ ...validBody, settings: { language: 'not a language!' } })
        .success,
    ).toBe(false);
    expect(
      GenerateRequestSchema.safeParse({ ...validBody, settings: { language: 'en-IN' } }).success,
    ).toBe(true);
  });
});

describe('response schemas', () => {
  it('accepts plain results and nested email results', () => {
    const base = { requestId: 'r1', success: true, provider: 'openai', model: 'gpt-4o-mini' };
    expect(GenerateResponseSchema.safeParse({ ...base, result: 'text' }).success).toBe(true);
    expect(
      GenerateResponseSchema.safeParse({ ...base, email: { subject: 'Hi', body: 'There' } })
        .success,
    ).toBe(true);
    expect(GenerateResponseSchema.safeParse(base).success).toBe(true);
    expect(GenerateResponseSchema.safeParse({ ...base, extra: 1 }).success).toBe(false);
  });

  it('accepts the live provider catalog shape including fallbackModel', () => {
    const catalog = {
      providers: [
        {
          id: 'openai',
          name: 'OpenAI',
          defaultModel: 'gpt-4o-mini',
          fallbackModel: 'gpt-4o',
          models: [{ id: 'gpt-4o-mini', status: 'active', capabilities: ['chat'] }],
        },
      ],
    };
    expect(ProviderCatalogSchema.safeParse(catalog).success).toBe(true);
  });
});
