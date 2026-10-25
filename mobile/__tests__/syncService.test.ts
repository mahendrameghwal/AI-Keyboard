import { ApiRequestError } from '@ai-keyboard/shared-contracts/client';
import type { PreferencesOutput } from '@ai-keyboard/shared-contracts/schemas';
import { SyncService } from '../src/features/sync/syncService';
import { AuthStore } from '../src/storage/auth';
import { DEFAULT_PREFERENCES, PreferencesRepository } from '../src/storage/preferences';
import { ProviderKeyStore } from '../src/storage/providerKeys';
import type { AppDeps } from '../src/services/deps';
import { MemoryJsonStore, MemorySecretStore } from '../test/helpers/memoryStores';

describe('SyncService', () => {
  function makeDeps(overrides: Partial<AppDeps> = {}): AppDeps {
    const json = new MemoryJsonStore();
    const secrets = new MemorySecretStore();
    return {
      api: {
        getPreferences: jest.fn(),
        putPreferences: jest.fn(),
      } as unknown as AppDeps['api'],
      auth: new AuthStore(secrets, json),
      providerKeys: new ProviderKeyStore(secrets, json),
      preferences: new PreferencesRepository(json),
      clientWithKey: jest.fn() as unknown as AppDeps['clientWithKey'],
      ...overrides,
    };
  }

  it('falls back to local preferences when signed out', async () => {
    const deps = makeDeps();
    const service = new SyncService(deps);

    const outcome = await service.pull();
    expect(outcome.synced).toBe(false);
    expect(outcome.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(outcome.message).toContain('Sign in');
  });

  it('pulls remote preferences when remote version is newer', async () => {
    const remotePrefs: PreferencesOutput = {
      writingStyle: 'casual',
      toneStrength: 'soft',
      formality: 'informal',
      defaultLength: 'short',
      language: 'en-IN',
      version: 5,
    };

    const deps = makeDeps({
      api: {
        getPreferences: jest.fn().mockResolvedValue(remotePrefs),
      } as unknown as AppDeps['api'],
    });

    // Simulate authenticated session
    await deps.auth.saveSession({
      user: { id: 'usr-1', email: 'a@b.com' },
      accessToken: 'acc',
      refreshToken: 'ref',
    });

    const service = new SyncService(deps);
    const outcome = await service.pull();

    expect(outcome.synced).toBe(true);
    expect(outcome.preferences).toEqual(remotePrefs);
    expect(await deps.preferences.load()).toEqual(remotePrefs);
  });

  it('reconciles on 409 PREFERENCES_VERSION_CONFLICT by reloading server state', async () => {
    const serverState: PreferencesOutput = {
      writingStyle: 'polite',
      toneStrength: 'balanced',
      formality: 'neutral',
      defaultLength: 'normal',
      language: 'en',
      version: 3,
    };

    const conflictError = new ApiRequestError({
      status: 409,
      code: 'PREFERENCES_VERSION_CONFLICT',
      message: 'Conflict',
    });

    const deps = makeDeps({
      api: {
        putPreferences: jest.fn().mockRejectedValue(conflictError),
        getPreferences: jest.fn().mockResolvedValue(serverState),
      } as unknown as AppDeps['api'],
    });

    await deps.auth.saveSession({
      user: { id: 'usr-1', email: 'a@b.com' },
      accessToken: 'acc',
      refreshToken: 'ref',
    });

    const service = new SyncService(deps);
    const outcome = await service.push({
      ...DEFAULT_PREFERENCES,
      version: 1,
    });

    expect(outcome.synced).toBe(false);
    expect(outcome.preferences).toEqual(serverState);
    expect(outcome.message).toContain('Conflict');
    expect(await deps.preferences.load()).toEqual(serverState);
  });
});
