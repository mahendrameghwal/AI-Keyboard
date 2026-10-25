import { ApiRequestError } from '@ai-keyboard/shared-contracts/client';
import type { PreferencesOutput } from '@ai-keyboard/shared-contracts/schemas';
import type { AppDeps } from '../../services/deps';

export interface SyncOutcome {
  synced: boolean;
  preferences: PreferencesOutput;
  message: string;
}

export class SyncService {
  constructor(private readonly deps: AppDeps) {}

  /**
   * Pulls remote preferences if remote version > local version.
   * If remote version matches, returns current state.
   */
  async pull(): Promise<SyncOutcome> {
    const token = await this.deps.auth.getAccessToken();
    if (!token) {
      const local = await this.deps.preferences.load();
      return { synced: false, preferences: local, message: 'Sign in to sync preferences.' };
    }

    try {
      const remote = await this.deps.api.getPreferences();
      const local = await this.deps.preferences.load();

      if (remote.version >= local.version) {
        await this.deps.preferences.save(remote);
        return { synced: true, preferences: remote, message: 'Preferences synced with cloud.' };
      }

      return { synced: true, preferences: local, message: 'Local preferences up to date.' };
    } catch (err) {
      const local = await this.deps.preferences.load();
      return {
        synced: false,
        preferences: local,
        message: err instanceof Error ? err.message : 'Sync failed.',
      };
    }
  }

  /**
   * Pushes local preferences to cloud using optimistic concurrency.
   * On 409 conflict, adopts server state and informs the user.
   */
  async push(newPreferences: PreferencesOutput): Promise<SyncOutcome> {
    const token = await this.deps.auth.getAccessToken();
    if (!token) {
      await this.deps.preferences.save(newPreferences);
      return {
        synced: false,
        preferences: newPreferences,
        message: 'Saved locally (sign in to sync with cloud).',
      };
    }

    try {
      const result = await this.deps.api.putPreferences(newPreferences);
      await this.deps.preferences.save(result);
      return { synced: true, preferences: result, message: 'Saved and synced to cloud.' };
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === 'PREFERENCES_VERSION_CONFLICT') {
        // Re-read latest server state
        const serverState = await this.deps.api.getPreferences();
        await this.deps.preferences.save(serverState);
        return {
          synced: false,
          preferences: serverState,
          message: 'Conflict: Preferences were updated on another device. Reloaded latest version.',
        };
      }

      // Save locally as fallback
      await this.deps.preferences.save(newPreferences);
      return {
        synced: false,
        preferences: newPreferences,
        message: 'Saved locally (could not reach cloud sync).',
      };
    }
  }
}
