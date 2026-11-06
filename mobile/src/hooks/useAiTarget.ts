import { useQuery } from '@tanstack/react-query';
import { asKnownProvider } from '../features/providers/settings';
import { useAppDeps } from '../services/deps';
import { DEFAULT_PREFERENCES } from '../storage/preferences';
import type { PreferencesOutput, Provider } from '@ai-keyboard/shared-contracts/schemas';

export interface AiTarget {
  provider: Provider;
  model: string;
}

/**
 * The two device-side facts every generation call needs: which provider/model the user
 * selected, and the writing preferences that must travel with the request (FR-05/06/18).
 * A selection is only usable when it names a contract-known provider and carries a model —
 * guessing one (the old `?? 'gpt-4o-mini'`) would send an OpenAI id to Gemini.
 */
export function useAiTarget(): {
  target: AiTarget | null;
  preferences: PreferencesOutput;
  isLoading: boolean;
} {
  const deps = useAppDeps();

  const stored = useQuery({
    queryKey: ['default-provider-target'],
    queryFn: () => deps.providerKeys.getDefault(),
  });
  const prefs = useQuery({
    queryKey: ['local-preferences'],
    queryFn: () => deps.preferences.load(),
  });

  const known = stored.data ? asKnownProvider(stored.data.provider) : null;
  const target: AiTarget | null =
    known && stored.data?.model ? { provider: known, model: stored.data.model } : null;

  return {
    target,
    preferences: prefs.data ?? DEFAULT_PREFERENCES,
    isLoading: stored.isPending || prefs.isPending,
  };
}
