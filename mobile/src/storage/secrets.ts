import * as SecureStore from 'expo-secure-store';

/**
 * Device secret storage seam. Screens and services depend on this interface so the
 * native module stays injectable in tests; provider keys must never be read or written
 * anywhere else.
 */
export interface SecretStore {
  read(name: string): Promise<string | null>;
  write(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
  /** False when the platform refuses secure storage (e.g. no device lock on Android). */
  isAvailable(): Promise<boolean>;
}

export const expoSecretStore: SecretStore = {
  read: (name) => SecureStore.getItemAsync(name),
  write: (name, value) => SecureStore.setItemAsync(name, value),
  remove: (name) => SecureStore.deleteItemAsync(name),
  isAvailable: () => SecureStore.isAvailableAsync(),
};
