import { z } from 'zod';
import { env } from '../config/env';

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

export const LANGUAGE_PATTERN = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

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
    model: z.string().min(1).max(128),
    action: z.enum(ACTIONS),
    text: z.string().min(1).max(env.MAX_SUMMARIZE_TEXT_CHARS),
    settings: SettingsSchema.optional(),
    customInstructions: z
      .array(z.string().min(1).max(env.MAX_CUSTOM_INSTRUCTION_CHARS))
      .max(env.MAX_CUSTOM_INSTRUCTIONS)
      .optional(),
    options: z.object({ stream: z.boolean().optional() }).strict().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    // Summarization may accept longer input than other actions.
    if (value.action !== 'summarize' && value.text.length > env.MAX_TEXT_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['text'],
        message: `text must be at most ${env.MAX_TEXT_CHARS} characters for action "${value.action}".`,
      });
    }
  });

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const ProviderTestSchema = z
  .object({
    provider: z.enum(PROVIDERS),
  })
  .strict();

export type ProviderTestRequest = z.infer<typeof ProviderTestSchema>;
