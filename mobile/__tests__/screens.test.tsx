import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  type RenderResult,
} from '@testing-library/react-native';
import type { ReactNode } from 'react';
import Providers from '../src/app/providers';
import Welcome from '../src/app/index';
import { DepsProvider, type AppDeps } from '../src/services/deps';
import { AuthStore } from '../src/storage/auth';
import { PreferencesRepository } from '../src/storage/preferences';
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

function buildDeps(calls: Call[]): AppDeps {
  const make = makeClientFactory(calls);
  return {
    api: make(),
    auth: new AuthStore(new MemorySecretStore(), new MemoryJsonStore()),
    providerKeys: new ProviderKeyStore(new MemorySecretStore(), new MemoryJsonStore()),
    preferences: new PreferencesRepository(new MemoryJsonStore()),
    clientWithKey: (key) => make(key),
  };
}

/** The first render in this file pays a cold Babel transform of the whole screen graph, which
 * routinely exceeds Jest's 5 s default on this host. */
jest.setTimeout(30_000);

/** Test QueryClients are destroyed in afterEach; leaking them keeps timers alive. */
const queryClients: QueryClient[] = [];

/** render() is async in testing-library 14 — `screen` is only populated once it resolves. */
async function renderScreen(node: ReactNode, calls: Call[] = []): Promise<RenderResult> {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  queryClients.push(queryClient);
  return render(
    <DepsProvider deps={buildDeps(calls)}>
      <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
    </DepsProvider>,
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
