/// <reference types="expo/types" />
import { ApiClient, ApiRequestError } from '@ai-keyboard/shared-contracts/client';
import Constants from 'expo-constants';
import { AuthStore } from '../storage/auth';
import { asyncStorageJsonStore } from '../storage/kv';
import { PreferencesRepository } from '../storage/preferences';
import { ProviderKeyStore } from '../storage/providerKeys';
import { expoSecretStore } from '../storage/secrets';

/**
 * Local development overrides through `mobile/.env`, which EAS never uploads (it is
 * git-ignored), so the shipped value has to live in the tracked `app.json#extra`. A build
 * that resolves neither must fail at startup rather than quietly dial `localhost`.
 */
function resolveApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_BASE_URL ?? Constants.expoConfig?.extra?.apiBaseUrl ?? '';
  if (!/^https?:\/\/[^\s]+/.test(url)) {
    throw new Error(
      'No API base URL configured. Set EXPO_PUBLIC_API_BASE_URL locally, or app.json#extra.apiBaseUrl for builds.',
    );
  }
  return url.replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

export const authStore = new AuthStore(expoSecretStore, asyncStorageJsonStore);
export const providerKeys = new ProviderKeyStore(expoSecretStore, asyncStorageJsonStore);
export const preferences = new PreferencesRepository(asyncStorageJsonStore);

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/** Codes that mean the refresh token itself is dead, as opposed to the network being down. */
const FATAL_AUTH_CODES = new Set<string>([
  'UNAUTHENTICATED',
  'SESSION_EXPIRED',
  'REFRESH_TOKEN_REUSED',
  'SESSION_REVOKED',
  'INVALID_CREDENTIALS',
]);

function isAuthRejection(err: unknown): boolean {
  return err instanceof ApiRequestError && FATAL_AUTH_CODES.has(err.code);
}

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
    } catch (err) {
      // A dropped connection or an upstream 5xx must not log the user out — the refresh
      // token is still valid, so the next attempt can succeed.
      if (isAuthRejection(err)) await authStore.clearSession();
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
  onUnauthorized: async () => {
    // Any 401 on an authed call: try to rotate. The refresh response itself decides
    // whether the session is unrecoverable, so no 401 clears it directly.
    await refreshAccessToken();
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
