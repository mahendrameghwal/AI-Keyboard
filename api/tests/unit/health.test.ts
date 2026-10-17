import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app';

const db = vi.hoisted(() => ({ up: false }));

vi.mock('../../src/config/database', () => ({
  getPrisma: () => (db.up ? { $queryRaw: async () => [] } : null),
  requirePrisma: () => {
    throw new Error('database is not configured in this test');
  },
  checkDatabase: async () => db.up,
  disconnectDatabase: async () => undefined,
}));

describe('health endpoints', () => {
  const app = createApp();

  beforeEach(() => {
    db.up = false;
  });

  it('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('echoes a request id header', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  it('honours a well-formed incoming request id', async () => {
    const res = await request(app).get('/health').set('X-Request-Id', 'abc12345-abc12345');
    expect(res.headers['x-request-id']).toBe('abc12345-abc12345');
  });

  it('GET /v1/health/ready returns 503 when the database is unreachable', async () => {
    const res = await request(app).get('/v1/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: 'degraded', dependencies: { database: false } });
  });

  it('GET /v1/health/ready returns 200 when the database is reachable', async () => {
    db.up = true;
    const res = await request(app).get('/v1/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ready', dependencies: { database: true } });
  });

  it('unknown route returns canonical error envelope', async () => {
    const res = await request(app).get('/v1/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', retryable: false });
    expect(res.body.error.requestId).toBeTruthy();
  });
});
