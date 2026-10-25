import { AuthStore } from '../src/storage/auth';
import { MemoryJsonStore, MemorySecretStore } from '../test/helpers/memoryStores';

describe('AuthStore', () => {
  it('saves and restores full auth session', async () => {
    const store = new AuthStore(new MemorySecretStore(), new MemoryJsonStore());

    expect(await store.getSession()).toBeNull();

    await store.saveSession({
      user: { id: 'usr-123', email: 'test@example.com' },
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });

    const session = await store.getSession();
    expect(session).toEqual({
      user: { id: 'usr-123', email: 'test@example.com' },
      accessToken: 'access-token-abc',
      refreshToken: 'refresh-token-xyz',
    });

    expect(await store.getAccessToken()).toBe('access-token-abc');
    expect(await store.getRefreshToken()).toBe('refresh-token-xyz');
  });

  it('updates tokens and clears session', async () => {
    const store = new AuthStore(new MemorySecretStore(), new MemoryJsonStore());

    await store.saveSession({
      user: { id: 'usr-123', email: 'test@example.com' },
      accessToken: 'old-access',
      refreshToken: 'old-refresh',
    });

    await store.updateTokens({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });

    expect(await store.getAccessToken()).toBe('new-access');
    expect(await store.getRefreshToken()).toBe('new-refresh');

    await store.clearSession();
    expect(await store.getSession()).toBeNull();
    expect(await store.getAccessToken()).toBeNull();
    expect(await store.getUser()).toBeNull();
  });
});
