import { ProviderSettings } from '../src/features/providers/settings';
import { ProviderKeyStore } from '../src/storage/providerKeys';
import { type Call, KEY, makeClientFactory } from '../test/helpers/fakeBackend';
import { MemoryJsonStore, MemorySecretStore } from '../test/helpers/memoryStores';

const build = (calls: Call[], testResult?: unknown) => {
  const make = makeClientFactory(calls, testResult);
  const providerKeys = new ProviderKeyStore(new MemorySecretStore(), new MemoryJsonStore());
  return {
    providerKeys,
    settings: new ProviderSettings({
      api: make(),
      providerKeys,
      clientWithKey: (key) => make(key),
    }),
  };
};

describe('ProviderSettings.rows', () => {
  it('merges the server catalog with stored key state', async () => {
    const { settings, providerKeys } = build([]);
    await providerKeys.save('openai', KEY);

    const rows = await settings.rows();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      provider: { id: 'openai' },
      configured: true,
      maskedKey: `••••${KEY.slice(-4)}`,
      activeModels: ['gpt-4o-mini'],
      deprecatedModels: ['gpt-4o'],
    });
  });
});

describe('ProviderSettings.test', () => {
  it('sends the entered key as the provider header', async () => {
    const calls: Call[] = [];
    const { settings } = build(calls);
    const rows = await settings.rows();

    const outcome = await settings.test(rows[0].provider, ` ${KEY} `);
    expect(outcome.valid).toBe(true);
    expect(calls.at(-1)?.url).toBe('https://api.test/v1/ai/providers/test');
    expect(calls.at(-1)?.headers['x-provider-key']).toBe(KEY);
  });

  it('makes no request for an empty key', async () => {
    const calls: Call[] = [];
    const { settings } = build(calls);
    const rows = await settings.rows();

    const outcome = await settings.test(rows[0].provider, '');
    expect(outcome).toEqual({ valid: false, message: 'Enter an API key first.' });
    expect(calls.filter((call) => call.url.endsWith('/providers/test'))).toHaveLength(0);
  });

  it('reports an invalid key without storing anything', async () => {
    const calls: Call[] = [];
    const { settings, providerKeys } = build(calls, {
      valid: false,
      message: 'Key not recognised',
    });
    const rows = await settings.rows();

    const outcome = await settings.test(rows[0].provider, KEY);
    expect(outcome).toEqual({ valid: false, message: 'Key not recognised' });
    expect(await providerKeys.read('openai')).toBeUndefined();
  });
});

describe('ProviderSettings.saveAndSelect', () => {
  it('stores the key and makes it the request default', async () => {
    const { settings, providerKeys } = build([]);
    const rows = await settings.rows();

    await settings.saveAndSelect({ provider: rows[0].provider, rawKey: KEY });
    expect(await providerKeys.read('openai')).toBe(KEY);
    expect(await providerKeys.getDefault()).toEqual({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(await providerKeys.keyForRequest()).toBe(KEY);
  });

  it('rolls back when the model is not in the catalog', async () => {
    const { settings, providerKeys } = build([]);
    const rows = await settings.rows();

    await expect(
      settings.saveAndSelect({ provider: rows[0].provider, rawKey: KEY, model: 'gpt-9' }),
    ).rejects.toThrow('Model "gpt-9" is not offered by this provider.');
    expect(await providerKeys.read('openai')).toBeUndefined();
    expect(await providerKeys.summaries()).toEqual([]);
  });
});
