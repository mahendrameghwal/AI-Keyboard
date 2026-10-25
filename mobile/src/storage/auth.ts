import type { JsonStore } from './kv';
import type { SecretStore } from './secrets';

export interface AuthUser {
  id: string;
  email: string;
}

export interface StoredSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

const ACCESS_TOKEN_KEY = 'auth.access_token';
const REFRESH_TOKEN_KEY = 'auth.refresh_token';
const USER_KEY = 'auth.user';

export class AuthStore {
  constructor(
    private readonly secrets: SecretStore,
    private readonly json: JsonStore,
  ) {}

  async getAccessToken(): Promise<string | null> {
    return this.secrets.read(ACCESS_TOKEN_KEY);
  }

  async getRefreshToken(): Promise<string | null> {
    return this.secrets.read(REFRESH_TOKEN_KEY);
  }

  async getUser(): Promise<AuthUser | null> {
    return this.json.read<AuthUser>(USER_KEY);
  }

  async getSession(): Promise<StoredSession | null> {
    const [accessToken, refreshToken, user] = await Promise.all([
      this.getAccessToken(),
      this.getRefreshToken(),
      this.getUser(),
    ]);

    if (!accessToken || !refreshToken || !user) {
      return null;
    }

    return { accessToken, refreshToken, user };
  }

  async saveSession(session: StoredSession): Promise<void> {
    await Promise.all([
      this.secrets.write(ACCESS_TOKEN_KEY, session.accessToken),
      this.secrets.write(REFRESH_TOKEN_KEY, session.refreshToken),
      this.json.write(USER_KEY, session.user),
    ]);
  }

  async updateTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
    await Promise.all([
      this.secrets.write(ACCESS_TOKEN_KEY, tokens.accessToken),
      this.secrets.write(REFRESH_TOKEN_KEY, tokens.refreshToken),
    ]);
  }

  async clearSession(): Promise<void> {
    await Promise.all([
      this.secrets.remove(ACCESS_TOKEN_KEY),
      this.secrets.remove(REFRESH_TOKEN_KEY),
      this.json.remove(USER_KEY),
    ]);
  }
}
