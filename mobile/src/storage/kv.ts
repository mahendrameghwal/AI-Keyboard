import AsyncStorage from '@react-native-async-storage/async-storage';

/** Non-secret JSON state on device (key index, preferences). Never store a provider key here. */
export interface JsonStore {
  read<T>(name: string): Promise<T | null>;
  write<T>(name: string, value: T): Promise<void>;
  remove(name: string): Promise<void>;
}

export const asyncStorageJsonStore: JsonStore = {
  async read<T>(name: string) {
    const raw = await AsyncStorage.getItem(name);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupt JSON is unrecoverable; dropping the entry lets the caller fall back to defaults.
      await AsyncStorage.removeItem(name);
      return null;
    }
  },
  write: <T>(name: string, value: T) => AsyncStorage.setItem(name, JSON.stringify(value)),
  remove: (name) => AsyncStorage.removeItem(name),
};
