import { PreferencesSchema, type PreferencesOutput } from '@ai-keyboard/shared-contracts/schemas';
import type { JsonStore } from './kv';

const ENTRY = 'preferences.local';

/** Matches the five fields the backend syncs (plan D7) plus the local version counter. */
export const DEFAULT_PREFERENCES: PreferencesOutput = {
  writingStyle: 'professional',
  toneStrength: 'balanced',
  formality: 'neutral',
  defaultLength: 'normal',
  language: 'en',
  version: 1,
};

export class PreferencesRepository {
  constructor(private readonly kv: JsonStore) {}

  /** Invalid or unreadable stored data falls back to defaults rather than blocking the app. */
  async load(): Promise<PreferencesOutput> {
    const parsed = PreferencesSchema.safeParse(await this.kv.read(ENTRY));
    return parsed.success ? parsed.data : DEFAULT_PREFERENCES;
  }

  async save(preferences: PreferencesOutput): Promise<void> {
    await this.kv.write(ENTRY, PreferencesSchema.parse(preferences));
  }
}
