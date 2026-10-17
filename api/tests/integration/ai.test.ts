import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { resetRateLimits } from '../../src/middleware/rateLimit';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const OPENAI_OK = {
  model: 'gpt-4o-mini',
  choices: [{ message: { content: 'Hello there.' } }],
  usage: { prompt_tokens: 2, completion_tokens: 3 },
};

const app = createApp();

beforeEach(() => {
  resetRateLimits();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('POST /v1/ai/generate', () => {
  it('requires a provider key', async () => {
    const res = await request(app)
      .post('/v1/ai/generate')
      .send({ provider: 'openai', model: 'gpt-4o-mini', action: 'rewrite', text: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('generates text and sets rate-limit + request-id headers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(OPENAI_OK)));

    const res = await request(app)
      .post('/v1/ai/generate')
      .set('X-Provider-Key', 'sk-test')
      .send({ provider: 'openai', model: 'gpt-4o-mini', action: 'rewrite', text: 'hello' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      provider: 'openai',
      result: 'Hello there.',
      usage: { inputTokens: 2, outputTokens: 3 },
    });
    expect(res.headers['x-ratelimit-limit']).toBeDefined();
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('returns structured email output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          model: 'gpt-4o-mini',
          choices: [
            { message: { content: '{"subject":"Leave","body":"Dear Sir, I request leave."}' } },
          ],
        }),
      ),
    );

    const res = await request(app)
      .post('/v1/ai/generate')
      .set('X-Provider-Key', 'sk-test')
      .send({ provider: 'openai', model: 'gpt-4o-mini', action: 'email', text: 'ask leave' });

    expect(res.status).toBe(200);
    expect(res.body.email).toEqual({ subject: 'Leave', body: 'Dear Sir, I request leave.' });
  });

  it('rejects streaming requests', async () => {
    const res = await request(app)
      .post('/v1/ai/generate')
      .set('X-Provider-Key', 'sk-test')
      .send({
        provider: 'openai',
        model: 'gpt-4o-mini',
        action: 'rewrite',
        text: 'hi',
        options: { stream: true },
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('STREAM_NOT_SUPPORTED');
  });

  it('rejects an unknown model', async () => {
    const res = await request(app)
      .post('/v1/ai/generate')
      .set('X-Provider-Key', 'sk-test')
      .send({ provider: 'openai', model: 'nope', action: 'rewrite', text: 'hi' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNSUPPORTED_MODEL');
  });

  it('rejects an unsupported provider via validation', async () => {
    const res = await request(app)
      .post('/v1/ai/generate')
      .set('X-Provider-Key', 'sk-test')
      .send({ provider: 'azure', model: 'x', action: 'rewrite', text: 'hi' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('maps an upstream auth failure to INVALID_PROVIDER_KEY', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
    const res = await request(app)
      .post('/v1/ai/generate')
      .set('X-Provider-Key', 'bad')
      .send({ provider: 'openai', model: 'gpt-4o-mini', action: 'rewrite', text: 'hi' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('INVALID_PROVIDER_KEY');
  });

  it('enforces the per-IP rate limit', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(OPENAI_OK)));

    const send = () =>
      request(app)
        .post('/v1/ai/generate')
        .set('X-Provider-Key', 'sk-test')
        .send({ provider: 'openai', model: 'gpt-4o-mini', action: 'rewrite', text: 'hi' });

    let last = await send();
    for (let i = 1; i < 31; i++) last = await send();

    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('RATE_LIMITED');
    expect(last.headers['retry-after']).toBeDefined();
  });
});

describe('provider catalog and validation', () => {
  it('lists providers with models', async () => {
    const res = await request(app).get('/v1/ai/providers');
    expect(res.status).toBe(200);
    const ids = res.body.providers.map((p: { id: string }) => p.id);
    expect(ids).toEqual(expect.arrayContaining(['openai', 'gemini', 'anthropic']));
  });

  it('validates provider credentials', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: [] })));
    const res = await request(app)
      .post('/v1/ai/providers/test')
      .set('X-Provider-Key', 'sk-test')
      .send({ provider: 'openai' });
    expect(res.status).toBe(200);
    expect(res.body.valid).toBe(true);
  });

  it('reports usage as disabled by default', async () => {
    const res = await request(app).get('/v1/ai/usage');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, events: [] });
  });
});
