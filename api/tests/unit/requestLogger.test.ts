import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { buildRequestLogEntry } from '../../src/middleware/requestLogger';

function fakeReq(overrides: Partial<Request> = {}): Request {
  return {
    requestId: 'req-1',
    method: 'POST',
    path: '/v1/ai/generate',
    ip: '203.0.113.7',
    ...overrides,
  } as Request;
}

describe('buildRequestLogEntry', () => {
  it('emits exactly the allowlisted fields', () => {
    const entry = buildRequestLogEntry(fakeReq(), 200, 12.34);
    expect(Object.keys(entry).sort()).toEqual([
      'durationMs',
      'ip',
      'method',
      'path',
      'requestId',
      'status',
    ]);
  });

  it('never includes user text, provider keys, or full URLs', () => {
    const req = fakeReq({
      // Simulate a request carrying sensitive data on the wire.
      body: { text: 'TOP SECRET USER DRAFT' },
      headers: { 'x-provider-key': 'sk-live-DEADBEEF' },
      url: '/v1/ai/generate?key=sk-live-DEADBEEF',
    } as Partial<Request>);

    const serialized = JSON.stringify(buildRequestLogEntry(req, 200, 5));

    expect(serialized).not.toContain('TOP SECRET');
    expect(serialized).not.toContain('sk-live-DEADBEEF');
    expect(serialized).not.toContain('?');
    expect(serialized).not.toContain('key=');
  });
});
