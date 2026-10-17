import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiRequestError } from '../src/client';

interface Recorded {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function harness(
  handler: (record: Recorded) => Promise<Response> | Response,
  options: Partial<ConstructorParameters<typeof ApiClient>[0]> = {},
) {
  const calls: Recorded[] = [];
  const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const record = {
      url: String(input),
      method: (init?.method ?? 'GET').toUpperCase(),
      headers: Object.fromEntries(
        Object.entries((init?.headers as Record<string, string> | undefined) ?? {}),
      ),
      body: init?.body ? String(init.body) : undefined,
    };
    calls.push(record);
    return handler(record);
  }) as unknown as typeof fetch;

  const client = new ApiClient({
    baseUrl: 'https://api.test',
    fetchImpl,
    getProviderKey: () => 'sk-provider-secret',
    getAccessToken: () => 'access-token',
    newRequestId: () => 'req-fixed',
    ...options,
  });

  return { client, calls };
}

const GENERATE_OK = {
  requestId: 'req-fixed',
  success: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  result: 'Rewritten text',
};

describe('ApiClient requests', () => {
  it('posts generate with the provider key, request id and JSON body', async () => {
    const { client, calls } = harness(() => jsonResponse(GENERATE_OK));

    const out = await client.generate({
      provider: 'openai',
      model: 'gpt-4o-mini',
      action: 'rewrite',
      text: 'raw text',
      settings: { tone: 'professional' },
    });

    expect(calls[0]!.url).toBe('https://api.test/v1/ai/generate');
    expect(calls[0]!.method).toBe('POST');
    expect(calls[0]!.headers['x-provider-key']).toBe('sk-provider-secret');
    expect(calls[0]!.headers['x-request-id']).toBe('req-fixed');
    expect(calls[0]!.headers['authorization']).toBe('Bearer access-token');
    expect(calls[0]!.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0]!.body!).text).toBe('raw text');
    expect(out.result).toBe('Rewritten text');
  });

  it('refuses to send generate without a provider key', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;
    const client = new ApiClient({ baseUrl: 'https://api.test', fetchImpl: fetchSpy });

    await expect(
      client.generate({ provider: 'openai', model: 'gpt-4o-mini', action: 'fix', text: 'x' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 0 });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('validates the outgoing body before the network is touched', async () => {
    const fetchSpy = vi.fn(async () => jsonResponse({})) as unknown as typeof fetch;
    const client = new ApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: fetchSpy,
      getProviderKey: () => 'k',
    });

    await expect(
      client.generate({
        provider: 'openai',
        model: 'gpt-4o-mini',
        action: 'fix',
        text: 'x'.repeat(8_001),
      } as never),
    ).rejects.toBeInstanceOf(Error);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends no authorization header when signed out', async () => {
    const { client, calls } = harness(() => jsonResponse({ providers: [] }), {
      getAccessToken: () => null,
    });
    await client.providers();
    expect(calls[0]!.headers['authorization']).toBeUndefined();
  });

  it('escapes a session id in the revoke path', async () => {
    const { client, calls } = harness(() => new Response(null, { status: 204 }));
    await client.revokeSession('a/b');
    expect(calls[0]!.url).toBe('https://api.test/v1/users/me/sessions/a%2Fb');
  });
});

describe('ApiClient error normalization', () => {
  it('maps the canonical envelope including Retry-After', async () => {
    const { client } = harness(
      () =>
        jsonResponse(
          { error: { code: 'RATE_LIMITED', message: 'Slow down', retryable: true } },
          429,
          { 'retry-after': '120' },
        ),
      { getProviderKey: () => 'k' },
    );

    const err = await client
      .generate({ provider: 'openai', model: 'gpt-4o-mini', action: 'fix', text: 'x' })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err).toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryable: true,
      retryAfterSeconds: 120,
    });
  });

  it('notifies onUnauthorized so the app can refresh the session', async () => {
    const onUnauthorized = vi.fn();
    const { client } = harness(
      () =>
        jsonResponse(
          { error: { code: 'SESSION_EXPIRED', message: 'Expired', retryable: false } },
          401,
        ),
      { onUnauthorized },
    );

    await expect(client.getPreferences()).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
      status: 401,
    });
    expect(onUnauthorized).toHaveBeenCalledWith('SESSION_EXPIRED');
  });

  it('surfaces a preference version conflict with the server state', async () => {
    const { client } = harness(() =>
      jsonResponse(
        {
          error: {
            code: 'PREFERENCES_VERSION_CONFLICT',
            message: 'Server state is newer',
            retryable: false,
            details: { server: { version: 7 } },
          },
        },
        409,
      ),
    );

    const err = (await client
      .putPreferences({
        writingStyle: 'casual',
        toneStrength: 'balanced',
        formality: 'neutral',
        defaultLength: 'normal',
        language: 'en-IN',
        version: 3,
      })
      .catch((e: unknown) => e)) as ApiRequestError;

    expect(err.code).toBe('PREFERENCES_VERSION_CONFLICT');
    expect(err.details).toEqual({ server: { version: 7 } });
  });

  it('classifies transport failures as retryable', async () => {
    const { client } = harness(() => {
      throw new TypeError('offline');
    });
    const err = (await client.health().catch((e: unknown) => e)) as ApiRequestError;
    expect(err.code).toBe('NETWORK_ERROR');
    expect(err.retryable).toBe(true);
  });

  it('reports a timeout when the request exceeds its budget', async () => {
    const slowFetch = ((..._args: unknown[]) =>
      new Promise<Response>((_, reject) =>
        setTimeout(() => reject(new Error('aborted')), 20),
      )) as unknown as typeof fetch;
    const client = new ApiClient({
      baseUrl: 'https://api.test',
      fetchImpl: slowFetch,
      requestTimeoutMs: 5,
    });

    const err = (await client.health().catch((e: unknown) => e)) as ApiRequestError;
    expect(err.code).toBe('TIMEOUT');
  });

  it('rejects a success payload that violates the contract', async () => {
    const { client } = harness(() =>
      jsonResponse({ requestId: 'r', success: 'yes', provider: 'openai' }),
    );
    const err = (await client
      .generate({ provider: 'openai', model: 'gpt-4o-mini', action: 'fix', text: 'x' })
      .catch((e: unknown) => e)) as ApiRequestError;
    expect(err.code).toBe('UNPARSEABLE_RESPONSE');
  });

  it('treats 204 logout as success without a body', async () => {
    const { client } = harness(() => new Response(null, { status: 204 }));
    await expect(client.logout('refresh-token')).resolves.toBeUndefined();
  });
});
