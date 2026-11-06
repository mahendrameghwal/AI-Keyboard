import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import { Platform } from 'react-native';
import type { AuthUser } from '../../storage/auth';
import { useAppDeps } from '../../services/deps';

/** What the API records for the device; the app also runs on web during development. */
const DEVICE_PLATFORM = Platform.OS === 'ios' ? 'ios' : 'android';

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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    deps.auth
      .getSession()
      .then((session) => {
        if (isMounted) {
          setUser(session?.user ?? null);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [deps]);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await deps.api.login({
        email,
        password,
        device: { platform: DEVICE_PLATFORM, name: 'AI Keyboard Mobile' },
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
        device: { platform: DEVICE_PLATFORM, name: 'AI Keyboard Mobile' },
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
    // Cached queries belong to the account that just signed out.
    queryClient.clear();
    setUser(null);
  }, [deps, queryClient]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return ctx;
}
