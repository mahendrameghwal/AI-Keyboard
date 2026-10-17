import { describe, it, expect, vi } from 'vitest';
import { OpenAIProvider } from '../../src/services/ai/OpenAIProvider';
import { GeminiProvider } from '../../src/services/ai/GeminiProvider';
import { AnthropicProvider } from '../../src/services/ai/AnthropicProvider';
import { AppError } from '../../src/errors/AppError';

type Captured = { url: string; init: RequestInit };

function fakeFetch(response: Response, captured: Captured[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    captured.push({ url: String(input), init: init ?? {} });
    return response;
  }) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const REQUEST = {
  model: 'test-model',
  systemPrompt: 'SYSTEM',
  userText: 'USER',
  temperature: 0.4,
  maxOutputTokens: 512,
};

describe('OpenAIProvider', () => {
  it('maps the request and parses the response', async () => {
    const captured: Captured[] = [];
    const provider = new OpenAIProvider(
      fakeFetch(
        jsonResponse({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: '  hi  ' } }],
          usage: { prompt_tokens: 3, completion_tokens: 4 },
        }),
        captured,
      ),
    );

    const result = await provider.generate(REQUEST, 'sk-test');

    expect(result.text).toBe('hi');
    expect(result.inputTokens).toBe(3);
    expect(result.outputTokens).toBe(4);
    const headers = captured[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe('Bearer sk-test');
    const body = JSON.parse(captured[0]!.init.body as string);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'SYSTEM' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'USER' });
  });

  it('maps 429 to PROVIDER_RATE_LIMITED', async () => {
    const provider = new OpenAIProvider(fakeFetch(jsonResponse({}, 429), []));
    await expect(provider.generate(REQUEST, 'k')).rejects.toMatchObject({
      name: 'AppError',
      code: 'PROVIDER_RATE_LIMITED',
    });
  });

  it('maps 401 to INVALID_PROVIDER_KEY', async () => {
    const provider = new OpenAIProvider(fakeFetch(jsonResponse({}, 401), []));
    await expect(provider.generate(REQUEST, 'k')).rejects.toBeInstanceOf(AppError);
    await expect(provider.generate(REQUEST, 'k')).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_KEY',
    });
  });

  it('throws EMPTY_RESPONSE on blank content', async () => {
    const provider = new OpenAIProvider(
      fakeFetch(jsonResponse({ choices: [{ message: { content: '   ' } }] }), []),
    );
    await expect(provider.generate(REQUEST, 'k')).rejects.toMatchObject({
      code: 'EMPTY_RESPONSE',
    });
  });
});

describe('GeminiProvider', () => {
  it('sends the key in a header, never the URL', async () => {
    const captured: Captured[] = [];
    const provider = new GeminiProvider(
      fakeFetch(
        jsonResponse({
          candidates: [{ content: { parts: [{ text: 'hello' }] } }],
          usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2 },
        }),
        captured,
      ),
    );

    await provider.generate({ ...REQUEST, model: 'gemini-1.5-flash' }, 'gemini-key');

    expect(captured[0]!.url).not.toContain('key=');
    const headers = captured[0]!.init.headers as Record<string, string>;
    expect(headers['x-goog-api-key']).toBe('gemini-key');
  });
});

describe('AnthropicProvider', () => {
  it('maps system/messages and version header', async () => {
    const captured: Captured[] = [];
    const provider = new AnthropicProvider(
      fakeFetch(
        jsonResponse({
          model: 'claude-3-5-sonnet-latest',
          content: [{ type: 'text', text: 'ok' }],
          usage: { input_tokens: 5, output_tokens: 6 },
        }),
        captured,
      ),
    );

    const result = await provider.generate(REQUEST, 'anthropic-key');

    expect(result.text).toBe('ok');
    const headers = captured[0]!.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('anthropic-key');
    expect(headers['anthropic-version']).toBeTruthy();
    const body = JSON.parse(captured[0]!.init.body as string);
    expect(body.system).toBe('SYSTEM');
    expect(body.messages).toEqual([{ role: 'user', content: 'USER' }]);
  });
});
