import { z } from 'zod';
import { TONES, TONE_STRENGTHS, FORMALITIES, LENGTHS, LANGUAGE_PATTERN } from './ai.validators';

// The five synced preference fields (plan D7). Custom instructions are
// intentionally excluded — they never leave the device.
export const PreferencesUpdateSchema = z
  .object({
    writingStyle: z.enum(TONES),
    toneStrength: z.enum(TONE_STRENGTHS),
    formality: z.enum(FORMALITIES),
    defaultLength: z.enum(LENGTHS),
    language: z.string().regex(LANGUAGE_PATTERN, 'Invalid language tag.'),
    version: z.number().int().positive(),
  })
  .strict();

export type PreferencesUpdateInput = z.infer<typeof PreferencesUpdateSchema>;
