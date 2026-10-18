import type { JsonStore } from '../../src/storage/kv';
import type { SecretStore } from '../../src/storage/secrets';

/** Backing maps are exposed so tests can assert what actually landed where. */
export class MemorySecretStore implements SecretStore {
  readonly values = new Map<string, string>();
  available = true;

  async read(name: string) {
    return this.values.get(name) ?? null;
  }
  async write(name: string, value: string) {
    this.values.set(name, value);
  }
  async remove(name: string) {
    this.values.delete(name);
  }
  async isAvailable() {
    return this.available;
  }
}

export class MemoryJsonStore implements JsonStore {
  readonly values = new Map<string, unknown>();

  async read<T>(name: string) {
    return (this.values.get(name) as T | undefined) ?? null;
  }
  async write<T>(name: string, value: T) {
    this.values.set(name, value);
  }
  async remove(name: string) {
    this.values.delete(name);
  }
}
