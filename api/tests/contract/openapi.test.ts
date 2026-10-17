import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';

const SPEC_PATH = join(__dirname, '..', '..', '..', 'shared-contracts', 'openapi.yaml');
const PARAM_VALUE = '00000000-0000-0000-0000-000000000000';

/** Endpoint inventory frozen in implementation-plan.md §1.1. */
const EXPECTED_OPS = [
  'GET /health',
  'GET /v1/health/ready',
  'POST /v1/ai/generate',
  'GET /v1/ai/providers',
  'POST /v1/ai/providers/test',
  'GET /v1/ai/usage',
  'POST /v1/auth/register',
  'POST /v1/auth/login',
  'POST /v1/auth/refresh',
  'POST /v1/auth/logout',
  'GET /v1/users/me',
  'DELETE /v1/users/me',
  'GET /v1/users/me/sessions',
  'DELETE /v1/users/me/sessions/{id}',
  'GET /v1/sync/preferences',
  'PUT /v1/sync/preferences',
];

function specOperations(yaml: string): string[] {
  const ops: string[] = [];
  let currentPath: string | null = null;
  for (const line of yaml.split('\n')) {
    if (/^components:/.test(line)) break;
    const pathMatch = /^ {2}(\/[^:]+):\s*$/.exec(line);
    if (pathMatch) {
      currentPath = pathMatch[1];
      continue;
    }
    const methodMatch = /^ {4}(get|post|put|patch|delete):\s*$/.exec(line);
    if (methodMatch && currentPath) ops.push(`${methodMatch[1].toUpperCase()} ${currentPath}`);
  }
  return ops;
}

describe('OpenAPI contract', () => {
  let specOps: string[];
  let app: Express;

  beforeAll(async () => {
    specOps = specOperations(readFileSync(SPEC_PATH, 'utf8'));
    app = (await import('../../src/app')).createApp();
  });

  it('documents exactly the frozen endpoint inventory', () => {
    expect([...specOps].sort()).toEqual([...EXPECTED_OPS].sort());
  });

  it.each(EXPECTED_OPS)('%s is routed by the API', async (op) => {
    const [method, template] = op.split(' ');
    const path = template.replace(/\{[^}]+\}/, PARAM_VALUE);
    const call = request(app)[method.toLowerCase() as 'get'](path);
    const res = method === 'POST' || method === 'PUT' ? await call.send({}) : await call;

    // Unregistered paths answer with the canonical NOT_FOUND envelope; every
    // real route answers 200 or a domain status (401/400/404-on-missing-row).
    const unrouted =
      res.status === 404 &&
      res.body?.error?.code === 'NOT_FOUND' &&
      res.body.error.message === 'The requested resource was not found.';
    expect(unrouted).toBe(false);
  });
});
