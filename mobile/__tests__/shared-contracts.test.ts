import { ApiClient } from '@ai-keyboard/shared-contracts/client';
import {
  GenerateRequestSchema,
  type GenerateRequestInput,
} from '@ai-keyboard/shared-contracts/schemas';

const VALID_REQUEST: GenerateRequestInput = {
  provider: 'openai',
  model: 'gpt-4o-mini',
  action: 'fix',
  text: 'their sentance',
};

const RESPONSE_OK = {
  requestId: 'req-1',
  success: true,
  provider: 'openai',
  model: 'gpt-4o-mini',
  result: 'their sentence',
};

describe('shared-contracts inside the Expo runtime', () => {
  it('accepts a valid generate request and rejects an unknown key', () => {
    expect(GenerateRequestSchema.parse(VALID_REQUEST).action).toBe('fix');
    expect(GenerateRequestSchema.safeParse({ ...VALID_REQUEST, stream: true }).success).toBe(false);
  });

  it('sends the provider key header and returns the typed response', async () => {
    const calls: { url: string; headers: Record<string, string> }[] = [];
    const client = new ApiClient({
      baseUrl: 'https://api.test',
      getProviderKey: () => 'sk-from-secure-store',
      newRequestId: () => 'req-1',
      fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
        calls.push({
          url: String(input),
          headers: (init?.headers as Record<string, string>) ?? {},
        });
        return new Response(JSON.stringify(RESPONSE_OK), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }) as unknown as typeof fetch,
    });

    const result = await client.generate(VALID_REQUEST);

    expect(calls[0]!.url).toBe('https://api.test/v1/ai/generate');
    expect(calls[0]!.headers['x-provider-key']).toBe('sk-from-secure-store');
    expect(result.result).toBe('their sentence');
  });
});
