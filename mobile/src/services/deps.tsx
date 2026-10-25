import { createContext, useContext, type PropsWithChildren } from 'react';
import type { ApiClient } from '@ai-keyboard/shared-contracts/client';
import type { AuthStore } from '../storage/auth';
import type { PreferencesRepository } from '../storage/preferences';
import type { ProviderKeyStore } from '../storage/providerKeys';

/** Everything a screen is allowed to touch. Tests provide fakes; the app provides the real ones. */
export interface AppDeps {
  api: ApiClient;
  auth: AuthStore;
  providerKeys: ProviderKeyStore;
  preferences: PreferencesRepository;
  /** Signs one request with a key that is not the stored default yet. */
  clientWithKey(providerKey: string): ApiClient;
}

const DepsContext = createContext<AppDeps | null>(null);

export function DepsProvider({
  deps,
  children,
}: PropsWithChildren<{ deps: AppDeps }>): React.JSX.Element {
  return <DepsContext.Provider value={deps}>{children}</DepsContext.Provider>;
}

export function useAppDeps(): AppDeps {
  const deps = useContext(DepsContext);
  if (!deps) throw new Error('useAppDeps must be used inside DepsProvider.');
  return deps;
}
