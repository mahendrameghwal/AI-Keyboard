import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';

const app = createApp();

describe('CORS policy (deny by default)', () => {
  it('emits no allow-origin header for arbitrary origins', async () => {
    const res = await request(app).get('/health').set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    expect(res.headers.vary).toContain('Origin');
  });

  it('rejects preflight when no origin is allowlisted', async () => {
    const res = await request(app)
      .options('/v1/ai/generate')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(res.status).toBe(403);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('security headers', () => {
  it('sets helmet defaults including HSTS and nosniff', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('request body limits', () => {
  it('answers an oversized body with 413, not 500', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'x@example.com', password: 'a'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('REQUEST_TOO_LARGE');
  });

  it('answers a malformed body with 400, not 500', async () => {
    const res = await request(app)
      .post('/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "x@example.com", ');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('session endpoint throttling', () => {
  it('rate limits refresh and logout', async () => {
    for (const path of ['/v1/auth/refresh', '/v1/auth/logout']) {
      const res = await request(app).post(path).send({ refreshToken: 'not-a-token' });
      expect(res.headers['x-ratelimit-limit']).toBe(String(env.RATE_LIMIT_SESSION_ATTEMPTS));
    }
  });
});
