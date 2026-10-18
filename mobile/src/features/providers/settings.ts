import type { ApiClient } from '@ai-keyboard/shared-contracts/client';
import {
  PROVIDERS,
  type Provider,
  type ProviderCatalogOutput,
} from '@ai-keyboard/shared-contracts/schemas';
import type { ProviderKeyStore } from '../../storage/providerKeys';

/** One entry of the server-maintained catalog (plan: ids are not pinned to the app build). */
export type CatalogProvider = ProviderCatalogOutput['providers'][number];

/** The typed client only accepts contract-known ids; anything newer is shown but not testable here. */
function asKnownProvider(id: string): Provider | null {
  return (PROVIDERS as readonly string[]).includes(id) ? (id as Provider) : null;
}

export interface ProviderRow {
  provider: CatalogProvider;
  configured: boolean;
  maskedKey?: string;
  activeModels: string[];
  deprecatedModels: string[];
}

export interface TestOutcome {
  valid: boolean;
  /** Safe to show verbatim: either the provider's own message or a contract error message. */
  message: string;
}

export interface ProviderSettingsDeps {
  api: ApiClient;
  providerKeys: ProviderKeyStore;
  clientWithKey(providerKey: string): ApiClient;
}

/**
 * Headless logic behind the Provider Settings screen — kept out of the view so the key
 * handling rules are testable without rendering.
 */
export class ProviderSettings {
  constructor(private readonly deps: ProviderSettingsDeps) {}

  async rows(): Promise<ProviderRow[]> {
    const [catalog, stored] = await Promise.all([
      this.deps.api.providers(),
      this.deps.providerKeys.summaries(),
    ]);
    const masked = new Map(stored.map((entry) => [entry.provider, entry.masked]));
    return catalog.providers.map((provider) => ({
      provider,
      configured: masked.has(provider.id),
      maskedKey: masked.get(provider.id),
      activeModels: provider.models.filter((m) => m.status === 'active').map((m) => m.id),
      deprecatedModels: provider.models.filter((m) => m.status === 'deprecated').map((m) => m.id),
    }));
  }

  /** Verifies a key before it is stored; a failed test leaves nothing behind. */
  async test(provider: CatalogProvider, rawKey: string): Promise<TestOutcome> {
    const key = rawKey.trim();
    if (key.length === 0) return { valid: false, message: 'Enter an API key first.' };
    const known = asKnownProvider(provider.id);
    if (!known) {
      return {
        valid: false,
        message: `This build does not know the "${provider.id}" provider yet.`,
      };
    }
    try {
      const result = await this.deps.clientWithKey(key).testProvider(known);
      return {
        valid: result.valid,
        message: result.message ?? (result.valid ? 'Connection verified.' : 'Key rejected.'),
      };
    } catch (error) {
      return {
        valid: false,
        message: error instanceof Error ? error.message : 'The test request failed.',
      };
    }
  }

  /** Stores the key in secure storage and makes this provider/model the active selection. */
  async saveAndSelect(input: {
    provider: CatalogProvider;
    rawKey: string;
    model?: string;
  }): Promise<void> {
    await this.deps.providerKeys.save(input.provider.id, input.rawKey);
    const model = input.model ?? input.provider.defaultModel;
    if (!this.knownModel(input.provider, model)) {
      await this.deps.providerKeys.remove(input.provider.id);
      throw new Error(`Model "${model}" is not offered by this provider.`);
    }
    await this.deps.providerKeys.setDefault({ provider: input.provider.id, model });
  }

  async remove(providerId: string): Promise<void> {
    await this.deps.providerKeys.remove(providerId);
  }

  private knownModel(provider: CatalogProvider, model: string): boolean {
    return provider.models.some((entry) => entry.id === model);
  }
}
