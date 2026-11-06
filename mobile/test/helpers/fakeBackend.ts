import { ApiClient, type ApiClientOptions } from '@ai-keyboard/shared-contracts/client';

export const KEY = 'sk-live-abcdef9876';

export const CATALOG = {
  providers: [
    {
      id: 'openai',
      name: 'OpenAI',
      defaultModel: 'gpt-4o-mini',
      models: [
        { id: 'gpt-4o-mini', status: 'active', capabilities: ['chat'] },
        { id: 'gpt-4o', status: 'deprecated', capabilities: ['chat'] },
      ],
    },
  ],
};

export const GENERATE_RESULT = {
  requestId: 'test-request-1',
  success: true,
  provider: 'openai',
  model: 'gpt-4o',
  result: 'Rewritten text.',
};

export interface Call {
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** Records requests and answers them with the contract shapes, so tests exercise the real client. */
export function makeClientFactory(calls: Call[], testResult: unknown = { valid: true }) {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ url, headers, body });

    const payload = url.endsWith('/providers/test')
      ? testResult
      : url.endsWith('/ai/generate')
        ? GENERATE_RESULT
        : CATALOG;
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  /** Pass a key for one ad-hoc client, or a resolver to mirror how the app signs requests. */
  return (keyOrResolver?: string | NonNullable<ApiClientOptions['getProviderKey']>): ApiClient =>
    new ApiClient({
      baseUrl: 'https://api.test',
      fetchImpl,
      getProviderKey:
        typeof keyOrResolver === 'function'
          ? keyOrResolver
          : keyOrResolver === undefined
            ? undefined
            : async () => keyOrResolver,
    });
}
