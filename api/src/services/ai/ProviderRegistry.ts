import type { AIProvider } from './AIProvider';
import type { CatalogProvider } from './modelCatalog';
import { listCatalog } from './modelCatalog';
import { OpenAIProvider } from './OpenAIProvider';
import { GeminiProvider } from './GeminiProvider';
import { AnthropicProvider } from './AnthropicProvider';

/**
 * Central registry of AI provider adapters (SRS §12.3).
 *
 * Adding a provider requires implementing `AIProvider`, registering it here,
 * seeding the model catalog, and adding tests — the mobile UI needs no change.
 */
class ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>();

  register(provider: AIProvider): this {
    this.providers.set(provider.providerId, provider);
    return this;
  }

  get(providerId: string): AIProvider | undefined {
    return this.providers.get(providerId);
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  ids(): string[] {
    return [...this.providers.keys()];
  }

  /** Adapters that actually exist, in catalog order. */
  catalog(): CatalogProvider[] {
    return listCatalog().filter((entry) => this.providers.has(entry.id));
  }
}

export const providerRegistry = new ProviderRegistry()
  .register(new OpenAIProvider())
  .register(new GeminiProvider())
  .register(new AnthropicProvider());
