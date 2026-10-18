import { z } from 'zod';
import type { JsonStore } from './kv';
import type { SecretStore } from './secrets';

const INDEX_ENTRY = 'provider-keys.index';
const DEFAULT_ENTRY = 'provider-keys.default';

/**
 * Provider ids come from the server-maintained catalog, so they are not pinned to a
 * compile-time enum here — a new provider must work without an app update.
 */
const ProviderId = z.string().min(1).max(64);
const IndexSchema = z.array(ProviderId);
const DefaultSchema = z.object({
  provider: ProviderId,
  model: z.string().min(1).max(120).optional(),
});

const secretName = (provider: string) => `provider-key.${provider}`;

export interface StoredKeySummary {
  provider: string;
  /** Last four characters only; the raw key never leaves the SecretStore. */
  masked: string;
}

export interface DefaultSelection {
  provider: string;
  model?: string;
}

export function maskKey(rawKey: string): string {
  const tail = rawKey.slice(-4);
  return tail.length < rawKey.length ? `••••${tail}` : '••••';
}

export class ProviderKeyStore {
  constructor(
    private readonly secrets: SecretStore,
    private readonly kv: JsonStore,
  ) {}

  async save(provider: string, rawKey: string): Promise<void> {
    const id = ProviderId.parse(provider);
    const trimmed = rawKey.trim();
    if (trimmed.length === 0) throw new Error('An API key cannot be empty.');
    await this.secrets.write(secretName(id), trimmed);
    await this.writeIndex(this.addedTo(await this.listIds(), id));
  }

  /** Raw key for request signing only. Never render the result in a screen. */
  async read(provider: string): Promise<string | undefined> {
    const value = await this.secrets.read(secretName(ProviderId.parse(provider)));
    return value ?? undefined;
  }

  async summaries(): Promise<StoredKeySummary[]> {
    const ids = await this.listIds();
    const results = await Promise.all(
      ids.map(async (provider) => {
        const raw = await this.secrets.read(secretName(provider));
        // A configured-but-unreadable entry (locked keychain) still shows so the user can replace it.
        return { provider, masked: raw ? maskKey(raw) : '••••' };
      }),
    );
    return results;
  }

  async remove(provider: string): Promise<void> {
    const id = ProviderId.parse(provider);
    await this.secrets.remove(secretName(id));
    await this.writeIndex(this.removedFrom(await this.listIds(), id));
    const selected = await this.getDefault();
    if (selected?.provider === id) await this.kv.remove(DEFAULT_ENTRY);
  }

  async getDefault(): Promise<DefaultSelection | null> {
    const parsed = DefaultSchema.safeParse(await this.kv.read(DEFAULT_ENTRY));
    return parsed.success ? parsed.data : null;
  }

  async setDefault(selection: DefaultSelection): Promise<void> {
    const parsed = DefaultSchema.parse(selection);
    if ((await this.read(parsed.provider)) === undefined) {
      throw new Error(`No API key is stored for "${parsed.provider}".`);
    }
    await this.kv.write(DEFAULT_ENTRY, parsed);
  }

  /** What the ApiClient calls per request; undefined means the request cannot be signed. */
  keyForRequest = async (): Promise<string | undefined> => {
    const selection = await this.getDefault();
    if (!selection) return undefined;
    return this.read(selection.provider);
  };

  private async listIds(): Promise<string[]> {
    const parsed = IndexSchema.safeParse(await this.kv.read(INDEX_ENTRY));
    return parsed.success ? parsed.data : [];
  }

  private async writeIndex(ids: string[]): Promise<void> {
    await this.kv.write(INDEX_ENTRY, IndexSchema.parse(ids));
  }

  private addedTo(ids: string[], id: string): string[] {
    return ids.includes(id) ? ids : [...ids, id];
  }

  private removedFrom(ids: string[], id: string): string[] {
    return ids.filter((entry) => entry !== id);
  }
}
