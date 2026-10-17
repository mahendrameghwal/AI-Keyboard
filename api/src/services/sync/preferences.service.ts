import type { UserPreference } from '@prisma/client';
import { requirePrisma } from '../../config/database';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/codes';
import type { PreferencesUpdateInput } from '../../validators/sync.validators';

export interface PreferencesView {
  writingStyle: string;
  toneStrength: string;
  formality: string;
  defaultLength: string;
  language: string;
  version: number;
  updatedAt: string;
}

function toView(pref: UserPreference): PreferencesView {
  return {
    writingStyle: pref.writingStyle,
    toneStrength: pref.toneStrength,
    formality: pref.formality,
    defaultLength: pref.defaultLength,
    language: pref.language,
    version: pref.version,
    updatedAt: pref.updatedAt.toISOString(),
  };
}

/** Returns the user's preferences, creating server defaults on first access. */
export async function getPreferences(userId: string): Promise<PreferencesView> {
  const prisma = requirePrisma();
  const existing = await prisma.userPreference.findUnique({ where: { userId } });
  if (existing) return toView(existing);
  const created = await prisma.userPreference.create({ data: { userId } });
  return toView(created);
}

/**
 * Optimistic-concurrency update. A stale `version` yields 409 with the current
 * server state so the client can reconcile (SRS §15.3, plan T7.3).
 */
export async function updatePreferences(
  userId: string,
  input: PreferencesUpdateInput,
): Promise<PreferencesView> {
  const prisma = requirePrisma();
  const current = await ensureRow(userId);

  if (current.version !== input.version) {
    throw new AppError(
      ErrorCode.PREFERENCES_VERSION_CONFLICT,
      'Preferences were changed on another device. Refresh and try again.',
      { currentVersion: current.version, current: toView(current) },
    );
  }

  const updated = await prisma.userPreference.update({
    where: { userId },
    data: {
      writingStyle: input.writingStyle,
      toneStrength: input.toneStrength,
      formality: input.formality,
      defaultLength: input.defaultLength,
      language: input.language,
      version: current.version + 1,
    },
  });
  return toView(updated);
}

async function ensureRow(userId: string): Promise<UserPreference> {
  const prisma = requirePrisma();
  const existing = await prisma.userPreference.findUnique({ where: { userId } });
  if (existing) return existing;
  return prisma.userPreference.create({ data: { userId } });
}
