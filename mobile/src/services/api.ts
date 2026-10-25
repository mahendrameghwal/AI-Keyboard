/// <reference types="expo/types" />
import { ApiClient } from '@ai-keyboard/shared-contracts/client';
import { AuthStore } from '../storage/auth';
import { asyncStorageJsonStore } from '../storage/kv';
import { PreferencesRepository } from '../storage/preferences';
import { ProviderKeyStore } from '../storage/providerKeys';
import { expoSecretStore } from '../storage/secrets';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const authStore = new AuthStore(expoSecretStore, asyncStorageJsonStore);
export const providerKeys = new ProviderKeyStore(expoSecretStore, asyncStorageJsonStore);
export const preferences = new PreferencesRepository(asyncStorageJsonStore);

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await authStore.getRefreshToken();
  if (!refreshToken) return null;

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshed = await api.refresh(refreshToken);
      await authStore.updateTokens({
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
      });
      return refreshed.accessToken;
    } catch {
      await authStore.clearSession();
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * The only network entry point. Connects to the backend using:
 * - Request-scoped provider key header (X-Provider-Key)
 * - Bearer access token when authenticated
 * - Automatic refresh rotation on 401 expiration
 */
export const api: ApiClient = new ApiClient({
  baseUrl: API_BASE_URL,
  getProviderKey: providerKeys.keyForRequest,
  getAccessToken: async () => authStore.getAccessToken(),
  onUnauthorized: async (code) => {
    if (code === 'SESSION_EXPIRED' || code === 'UNAUTHENTICATED') {
      await refreshAccessToken();
    } else {
      await authStore.clearSession();
    }
  },
});

/** Signs a request with a key that is not the stored default yet (verifying before saving). */
export function clientWithKey(providerKey: string): ApiClient {
  return new ApiClient({
    baseUrl: API_BASE_URL,
    getProviderKey: async () => providerKey,
    getAccessToken: async () => authStore.getAccessToken(),
  });
}
