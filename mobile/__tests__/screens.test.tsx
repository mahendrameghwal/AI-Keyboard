import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  type RenderResult,
} from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import Assistant from '../src/app/assistant';
import Providers from '../src/app/providers';
import Welcome from '../src/app/index';
import { Card } from '../src/components/ui';
import { AuthProvider } from '../src/features/auth/AuthContext';
import { DepsProvider, type AppDeps } from '../src/services/deps';
import { AuthStore } from '../src/storage/auth';
import { DEFAULT_PREFERENCES, PreferencesRepository } from '../src/storage/preferences';
import { ProviderKeyStore } from '../src/storage/providerKeys';
import { type Call, KEY, makeClientFactory } from '../test/helpers/fakeBackend';
import { MemoryJsonStore, MemorySecretStore } from '../test/helpers/memoryStores';

jest.mock('expo-router', () => {
  const { Text } = require('react-native') as typeof import('react-native');
  return {
    Link: ({ href, children }: { href: string; children: ReactNode }) => (
      <Text testID={`link-${href}`}>{children}</Text>
    ),
  };
});

/** Screens read safe-area insets; in the app expo-router supplies the provider, tests must. */
const INITIAL_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

interface Seeded {
  deps: AppDeps;
  providerKeys: ProviderKeyStore;
  preferences: PreferencesRepository;
}

function buildDeps(calls: Call[]): Seeded {
  const make = makeClientFactory(calls);
  const providerKeys = new ProviderKeyStore(new MemorySecretStore(), new MemoryJsonStore());
  const preferences = new PreferencesRepository(new MemoryJsonStore());
  return {
    providerKeys,
    preferences,
    deps: {
      // Mirrors src/services/api.ts: the client asks the key store per request.
      api: make(() => providerKeys.keyForRequest()),
      auth: new AuthStore(new MemorySecretStore(), new MemoryJsonStore()),
      providerKeys,
      preferences,
      clientWithKey: (key) => make(key),
    },
  };
}

/** The first render in this file pays a cold Babel transform of the whole screen graph, which
 * routinely exceeds Jest's 5 s default on this host. */
jest.setTimeout(30_000);

/** Test QueryClients are destroyed in afterEach; leaking them keeps timers alive. */
const queryClients: QueryClient[] = [];

/** render() is async in testing-library 14 — `screen` is only populated once it resolves. */
async function renderScreen(
  node: ReactNode,
  calls: Call[] = [],
  deps?: AppDeps,
): Promise<RenderResult> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  queryClients.push(queryClient);
  return render(
    <SafeAreaProvider initialMetrics={INITIAL_METRICS}>
      <DepsProvider deps={deps ?? buildDeps(calls).deps}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>{node}</AuthProvider>
        </QueryClientProvider>
      </DepsProvider>
    </SafeAreaProvider>,
  );
}

afterEach(() => {
  // v5 QueryClient has no destroy(); clearing the cache is what drops its GC timers.
  while (queryClients.length) queryClients.pop()?.clear();
});

/** Text actually rendered on screen; the key field's own `value` prop is expected to hold the key. */
function visibleText(node: unknown): string {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(visibleText).join('');
  if (node && typeof node === 'object') {
    const json = node as { children?: unknown; props?: { children?: unknown } };
    return visibleText(json.children ?? json.props?.children);
  }
  return '';
}

describe('Welcome screen', () => {
  it('shows the disclosure and the setup links', async () => {
    await renderScreen(<Welcome />);

    expect(screen.getByTestId('welcome-title')).toHaveTextContent('AI Keyboard');
    expect(screen.getByTestId('welcome-disclosure')).toBeTruthy();
    expect(screen.getByTestId('link-/providers')).toBeTruthy();
    expect(screen.getByTestId('link-/keyboard-setup')).toBeTruthy();
    expect(screen.getByTestId('link-/privacy')).toBeTruthy();
  });

  it('points at the configured API base url', async () => {
    await renderScreen(<Welcome />);
    expect(screen.getByTestId('api-target')).toHaveTextContent('API: http://localhost:3000');
  });
});

describe('Provider settings screen', () => {
  it('loads the catalog and reports no key stored', async () => {
    await renderScreen(<Providers />);

    await waitFor(() => expect(screen.getByTestId('provider-row-openai')).toBeTruthy());
    expect(screen.getByTestId('provider-key-state-openai')).toHaveTextContent('No key stored');
  });

  it('tests a typed key against the backend and never renders it', async () => {
    const calls: Call[] = [];
    const rendered = await renderScreen(<Providers />, calls);

    await waitFor(() => expect(screen.getByTestId('provider-row-openai')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('provider-row-openai'));
    await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
    await fireEvent.press(screen.getByTestId('test-button'));

    await waitFor(() =>
      expect(screen.getByTestId('test-outcome')).toHaveTextContent('Connection verified.'),
    );
    const testCall = calls.find((call) => call.url.endsWith('/providers/test'));
    expect(testCall?.headers['x-provider-key']).toBe(KEY);
    expect(visibleText(rendered.toJSON())).not.toContain(KEY);
  });

  it('saves the key and shows only the masked tail', async () => {
    const rendered = await renderScreen(<Providers />);

    await waitFor(() => expect(screen.getByTestId('provider-row-openai')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('provider-row-openai'));
    await fireEvent.changeText(screen.getByTestId('key-input'), KEY);
    await fireEvent.press(screen.getByTestId('save-button'));

    await waitFor(() =>
      expect(screen.getByTestId('provider-key-state-openai')).toHaveTextContent(
        `Key stored: ••••${KEY.slice(-4)}`,
      ),
    );
    expect(JSON.stringify(rendered.toJSON())).not.toContain(KEY);
  });
});

describe('Writing assistant screen', () => {
  /** Non-default values everywhere, so a hardcoded request body can never pass. */
  const SAVED_PREFS = {
    ...DEFAULT_PREFERENCES,
    writingStyle: 'confident',
    toneStrength: 'hard',
    formality: 'formal',
    defaultLength: 'detailed',
    language: 'en-IN',
  } as const;

  async function seed(calls: Call[], withModel: boolean) {
    const seeded = buildDeps(calls);
    await seeded.providerKeys.save('openai', KEY);
    if (withModel) {
      await seeded.providerKeys.setDefault({ provider: 'openai', model: 'gpt-4o' });
    }
    await seeded.preferences.save(SAVED_PREFS);
    return seeded.deps;
  }

  it('sends the stored model, the stored key and the saved preferences', async () => {
    const calls: Call[] = [];
    await renderScreen(<Assistant />, calls, await seed(calls, true));

    await fireEvent.changeText(screen.getByTestId('assistant-input-text'), 'Fix this sentance');
    await fireEvent.press(screen.getByTestId('assistant-generate-button'));
    await waitFor(() =>
      expect(screen.getByTestId('text-result')).toHaveTextContent('Rewritten text.'),
    );

    const generate = calls.find((call) => call.url.endsWith('/v1/ai/generate'));
    expect(generate?.headers['x-provider-key']).toBe(KEY);
    expect(generate?.body).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      action: 'rewrite',
      settings: {
        tone: 'confident',
        toneStrength: 'hard',
        formality: 'formal',
        length: 'detailed',
        language: 'en-IN',
      },
    });
  });

  it('refuses to send anything when a key is stored but no model is selected', async () => {
    const calls: Call[] = [];
    await renderScreen(<Assistant />, calls, await seed(calls, false));

    await fireEvent.changeText(screen.getByTestId('assistant-input-text'), 'Some text');
    await fireEvent.press(screen.getByTestId('assistant-generate-button'));

    expect(screen.getByText('No AI Provider Configured')).toBeTruthy();
    expect(calls.some((call) => call.url.endsWith('/v1/ai/generate'))).toBe(false);
  });
});

describe('Card', () => {
  it('forwards the press handler that <Link asChild> injects', async () => {
    const onPress = jest.fn();
    await renderScreen(
      <Card testID="card-link" onPress={onPress}>
        <Text>Rewrite, Fix &amp; Expand</Text>
      </Card>,
    );

    await fireEvent.press(screen.getByTestId('card-link'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
