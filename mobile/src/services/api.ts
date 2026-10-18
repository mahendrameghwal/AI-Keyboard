/// <reference types="expo/types" />
import { ApiClient } from '@ai-keyboard/shared-contracts/client';
import { asyncStorageJsonStore } from '../storage/kv';
import { PreferencesRepository } from '../storage/preferences';
import { ProviderKeyStore } from '../storage/providerKeys';
import { expoSecretStore } from '../storage/secrets';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const providerKeys = new ProviderKeyStore(expoSecretStore, asyncStorageJsonStore);
export const preferences = new PreferencesRepository(asyncStorageJsonStore);

/**
 * The only network entry point. The provider key is read from secure storage per request
 * and is never cached here (plan D1: BYOK header, not persisted or logged).
 */
export const api = new ApiClient({
  baseUrl: API_BASE_URL,
  getProviderKey: providerKeys.keyForRequest,
});

/** Signs a request with a key that is not the stored default yet (verifying before saving). */
export function clientWithKey(providerKey: string): ApiClient {
  return new ApiClient({ baseUrl: API_BASE_URL, getProviderKey: async () => providerKey });
}
