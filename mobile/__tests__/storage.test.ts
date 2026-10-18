import { PreferencesRepository } from '../src/storage/preferences';
import { ProviderKeyStore, maskKey } from '../src/storage/providerKeys';
import { MemoryJsonStore, MemorySecretStore } from '../test/helpers/memoryStores';

const SECRET = 'sk-secret-value-1234';

const build = () => {
  const secrets = new MemorySecretStore();
  const json = new MemoryJsonStore();
  return { secrets, json, store: new ProviderKeyStore(secrets, json) };
};

describe('maskKey', () => {
  it('keeps only the tail', () => {
    expect(maskKey(SECRET)).toBe(`••••${SECRET.slice(-4)}`);
    expect(maskKey('ab')).toBe('••••');
  });
});

describe('ProviderKeyStore', () => {
  it('puts key material in secure storage only, never in the JSON index', async () => {
    const { secrets, json, store } = build();
    await store.save('openai', SECRET);

    expect(secrets.values.get('provider-key.openai')).toBe(SECRET);
    expect(JSON.stringify([...json.values.values()])).not.toContain(SECRET);
  });

  it('rejects an empty key', async () => {
    const { store } = build();
    await expect(store.save('openai', '   ')).rejects.toThrow('An API key cannot be empty.');
  });

  it('summaries lists configured providers with masked keys', async () => {
    const { store } = build();
    await store.save('openai', SECRET);
    await store.save('anthropic', 'anth-key-wxyz');

    const rows = await store.summaries();
    expect(rows.map((row) => row.provider).sort()).toEqual(['anthropic', 'openai']);
    expect(rows.find((row) => row.provider === 'openai')?.masked).toBe(`••••${SECRET.slice(-4)}`);
    expect(JSON.stringify(rows)).not.toContain(SECRET);
  });

  it('shows an entry as configured when the secret is unreadable', async () => {
    const { secrets, store } = build();
    await store.save('openai', SECRET);
    secrets.values.delete('provider-key.openai');

    await expect(store.summaries()).resolves.toEqual([{ provider: 'openai', masked: '••••' }]);
  });

  it('keyForRequest signs with the default selection and stops after removal', async () => {
    const { store } = build();
    await store.save('openai', SECRET);
    expect(await store.keyForRequest()).toBeUndefined();

    await store.setDefault({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(await store.keyForRequest()).toBe(SECRET);

    await store.remove('openai');
    expect(await store.getDefault()).toBeNull();
    expect(await store.keyForRequest()).toBeUndefined();
  });

  it('refuses to select a provider with no stored key', async () => {
    const { store } = build();
    await expect(store.setDefault({ provider: 'gemini' })).rejects.toThrow(
      'No API key is stored for "gemini".',
    );
  });
});

describe('PreferencesRepository', () => {
  it('round-trips contract-valid defaults', async () => {
    const repo = new PreferencesRepository(new MemoryJsonStore());
    const loaded = await repo.load();
    expect(loaded.writingStyle).toBe('professional');

    await repo.save({ ...loaded, formality: 'informal', version: 2 });
    await expect(repo.load()).resolves.toMatchObject({ formality: 'informal', version: 2 });
  });

  it('falls back to defaults when stored JSON is invalid', async () => {
    const json = new MemoryJsonStore();
    json.values.set('preferences.local', { writingStyle: 'shouty' });
    const repo = new PreferencesRepository(json);

    await expect(repo.load()).resolves.toMatchObject({ writingStyle: 'professional', version: 1 });
  });
});
