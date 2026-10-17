import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type CatalogModule = typeof import('../../src/services/ai/modelCatalog');

async function loadCatalog(envOverrides: Record<string, string>): Promise<CatalogModule> {
  Object.assign(process.env, envOverrides);
  vi.resetModules();
  return import('../../src/services/ai/modelCatalog');
}

const dir = mkdtempSync(join(tmpdir(), 'aik-catalog-'));

afterEach(() => {
  delete process.env.MODEL_CATALOG_PATH;
  delete process.env.MODEL_CATALOG_TTL_SECONDS;
  delete process.env.DISABLED_PROVIDERS;
});

describe('model catalog', () => {
  it('serves the built-in catalog when no override is configured', async () => {
    const { listCatalog, findModel } = await loadCatalog({});
    const ids = listCatalog().map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'gemini', 'anthropic']));
    expect(findModel('openai', 'gpt-4o-mini')?.status).toBe('active');
  });

  it('hides a provider killed by DISABLED_PROVIDERS and blocks its requests', async () => {
    const { listCatalog, isProviderEnabled, findModel } = await loadCatalog({
      DISABLED_PROVIDERS: 'gemini',
    });
    expect(listCatalog().map((p) => p.id)).not.toContain('gemini');
    expect(isProviderEnabled('gemini')).toBe(false);
    expect(isProviderEnabled('openai')).toBe(true);
    // findModel still sees it so callers can distinguish "unknown model" from "disabled".
    expect(findModel('gemini', 'gemini-1.5-flash')).toBeDefined();
  });

  it('loads an override file and marks deprecated models', async () => {
    const path = join(dir, 'catalog.json');
    writeFileSync(
      path,
      JSON.stringify({
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            defaultModel: 'gpt-4o',
            fallbackModel: 'gpt-4o-mini',
            models: [
              { id: 'gpt-4o-mini', status: 'deprecated', capabilities: ['chat'] },
              { id: 'gpt-4o', status: 'active', capabilities: ['chat'] },
              { id: 'gpt-5-nano', status: 'active', capabilities: ['chat'] },
            ],
          },
        ],
      }),
    );

    const mod = await loadCatalog({ MODEL_CATALOG_PATH: path });
    expect(mod.listCatalog().map((p) => p.id)).toEqual(['openai']);
    expect(mod.findModel('openai', 'gpt-5-nano')?.status).toBe('active');
    expect(mod.findModel('openai', 'gpt-4o-mini')?.status).toBe('deprecated');
    expect(mod.findModel('gemini', 'gemini-1.5-flash')).toBeUndefined();
    expect(mod.defaultModelFor('openai')).toBe('gpt-4o');
  });

  it('skips a default model that is deprecated and falls back', async () => {
    const path = join(dir, 'fallback.json');
    writeFileSync(
      path,
      JSON.stringify({
        providers: [
          {
            id: 'anthropic',
            name: 'Anthropic',
            defaultModel: 'claude-3-5-sonnet-latest',
            fallbackModel: 'claude-3-5-haiku-latest',
            models: [
              { id: 'claude-3-5-sonnet-latest', status: 'deprecated', capabilities: [] },
              { id: 'claude-3-5-haiku-latest', status: 'active', capabilities: [] },
            ],
          },
        ],
      }),
    );

    const { defaultModelFor } = await loadCatalog({ MODEL_CATALOG_PATH: path });
    expect(defaultModelFor('anthropic')).toBe('claude-3-5-haiku-latest');
  });

  it('keeps the previous catalog when the override file is invalid JSON', async () => {
    const path = join(dir, 'broken.json');
    writeFileSync(path, '{ not json');
    const mod = await loadCatalog({ MODEL_CATALOG_PATH: path });
    expect(mod.listCatalog().map((p) => p.id)).toEqual(
      expect.arrayContaining(['openai', 'gemini', 'anthropic']),
    );
  });

  it('re-reads the source after resetCatalogCache', async () => {
    const path = join(dir, 'reload.json');
    writeFileSync(
      path,
      JSON.stringify({
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            defaultModel: 'gpt-4o-mini',
            models: [{ id: 'gpt-4o-mini', status: 'active', capabilities: [] }],
          },
        ],
      }),
    );
    const mod = await loadCatalog({ MODEL_CATALOG_PATH: path, MODEL_CATALOG_TTL_SECONDS: '1' });
    expect(mod.listCatalog()).toHaveLength(1);

    writeFileSync(
      path,
      JSON.stringify({
        providers: [
          {
            id: 'openai',
            name: 'OpenAI',
            defaultModel: 'gpt-4o-mini',
            models: [
              { id: 'gpt-4o-mini', status: 'active', capabilities: [] },
              { id: 'gpt-4.1', status: 'active', capabilities: [] },
            ],
          },
        ],
      }),
    );
    expect(mod.findModel('openai', 'gpt-4.1')).toBeUndefined();

    mod.resetCatalogCache();
    expect(mod.findModel('openai', 'gpt-4.1')?.status).toBe('active');
  });
});
