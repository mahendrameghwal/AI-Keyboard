import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { AuthUser } from '../../storage/auth';
import { useAppDeps } from '../../services/deps';

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren): React.JSX.Element {
  const deps = useAppDeps();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = useCallback(async () => {
    try {
      const session = await deps.auth.getSession();
      setUser(session?.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [deps]);

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await deps.api.login({
        email,
        password,
        device: { platform: 'android', name: 'AI Keyboard Mobile' },
      });
      await deps.auth.saveSession({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setUser(result.user);
    },
    [deps],
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const result = await deps.api.register({
        email,
        password,
        device: { platform: 'android', name: 'AI Keyboard Mobile' },
      });
      await deps.auth.saveSession({
        user: result.user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      setUser(result.user);
    },
    [deps],
  );

  const logout = useCallback(async () => {
    const refreshToken = await deps.auth.getRefreshToken();
    if (refreshToken) {
      try {
        await deps.api.logout(refreshToken);
      } catch {
        // Idempotent client cleanup even if remote call fails
      }
    }
    await deps.auth.clearSession();
    setUser(null);
  }, [deps]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      user: null,
      isLoading: false,
      login: async () => {},
      register: async () => {},
      logout: async () => {},
    };
  }
  return ctx;
}
