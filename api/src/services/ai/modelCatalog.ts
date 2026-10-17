import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../config/logger';

export type ModelStatus = 'active' | 'deprecated';

export interface CatalogModel {
  id: string;
  status: ModelStatus;
  capabilities: string[];
}

export interface CatalogProvider {
  id: string;
  name: string;
  defaultModel: string;
  fallbackModel?: string;
  models: CatalogModel[];
}

/**
 * Built-in floor for the catalog. Operators change it in production through
 * `MODEL_CATALOG_PATH`, never by shipping a client update (plan §1.7).
 */
const BUILTIN_CATALOG: CatalogProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultModel: 'gpt-4o-mini',
    fallbackModel: 'gpt-4o',
    models: [
      { id: 'gpt-4o-mini', status: 'active', capabilities: ['chat', 'system-prompt'] },
      { id: 'gpt-4o', status: 'active', capabilities: ['chat', 'system-prompt'] },
    ],
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-1.5-flash',
    fallbackModel: 'gemini-1.5-pro',
    models: [
      { id: 'gemini-1.5-flash', status: 'active', capabilities: ['chat', 'system-prompt'] },
      { id: 'gemini-1.5-pro', status: 'active', capabilities: ['chat', 'system-prompt'] },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    defaultModel: 'claude-3-5-sonnet-latest',
    fallbackModel: 'claude-3-5-haiku-latest',
    models: [
      { id: 'claude-3-5-sonnet-latest', status: 'active', capabilities: ['chat', 'system-prompt'] },
      { id: 'claude-3-5-haiku-latest', status: 'active', capabilities: ['chat', 'system-prompt'] },
    ],
  },
];

const CatalogFileSchema = z.object({
  providers: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      defaultModel: z.string().min(1),
      fallbackModel: z.string().min(1).optional(),
      models: z.array(
        z.object({
          id: z.string().min(1),
          status: z.enum(['active', 'deprecated']),
          capabilities: z.array(z.string()).default([]),
        }),
      ),
    }),
  ),
});

interface CacheEntry {
  providers: CatalogProvider[];
  loadedAt: number;
}

let cache: CacheEntry | null = null;

function disabledProviders(): Set<string> {
  return new Set(
    env.DISABLED_PROVIDERS.split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function loadFromDisk(): CatalogProvider[] | null {
  const path = env.MODEL_CATALOG_PATH;
  if (!path || !existsSync(path)) return null;
  try {
    const parsed = CatalogFileSchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    return parsed.providers;
  } catch (err) {
    logger.error({ err, path }, 'Model catalog override is invalid; keeping previous catalog');
    return null;
  }
}

function load(): CacheEntry {
  return { providers: loadFromDisk() ?? BUILTIN_CATALOG, loadedAt: Date.now() };
}

function current(): CacheEntry {
  const cached = cache;
  if (cached && Date.now() - cached.loadedAt < env.MODEL_CATALOG_TTL_SECONDS * 1000) {
    return cached;
  }
  const reloaded = load();
  cache = reloaded;
  return reloaded;
}

/** Providers that are both known and not killed by `DISABLED_PROVIDERS`. */
export function listCatalog(): CatalogProvider[] {
  const disabled = disabledProviders();
  return current().providers.filter((p) => !disabled.has(p.id));
}

export function isProviderEnabled(providerId: string): boolean {
  return !disabledProviders().has(providerId);
}

export function findModel(providerId: string, modelId: string): CatalogModel | undefined {
  return current()
    .providers.find((p) => p.id === providerId)
    ?.models.find((m) => m.id === modelId);
}

/** Default model, falling back when the default itself is deprecated. */
export function defaultModelFor(providerId: string): string | undefined {
  const provider = current().providers.find((p) => p.id === providerId);
  if (!provider) return undefined;
  const models = new Map(provider.models.map((m) => [m.id, m.status]));
  const preferred = [provider.defaultModel, provider.fallbackModel].filter(
    (id): id is string => Boolean(id),
  );
  return preferred.find((id) => models.get(id) === 'active') ?? provider.defaultModel;
}

/** Test seam: forces the next read to reload from disk. */
export function resetCatalogCache(): void {
  cache = null;
}
