import { ApiClient } from '@ai-keyboard/shared-contracts/client';

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

export interface Call {
  url: string;
  headers: Record<string, string>;
}

/** Records requests and answers them with the contract shapes, so tests exercise the real client. */
export function makeClientFactory(calls: Call[], testResult: unknown = { valid: true }) {
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, headers });
    const body = url.endsWith('/providers/test') ? testResult : CATALOG;
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  return (providerKey?: string) =>
    new ApiClient({
      baseUrl: 'https://api.test',
      fetchImpl,
      getProviderKey: providerKey === undefined ? undefined : async () => providerKey,
    });
}
