import { describe, expect, it } from 'vitest';
import { parseEnv } from '../../src/config/env';

const SECRET = 'a'.repeat(32);

describe('parseEnv', () => {
  it('accepts a real secret in production', () => {
    expect(() =>
      parseEnv({ NODE_ENV: 'production', JWT_SECRET: SECRET, DATABASE_URL: 'postgres://x/y' }),
    ).not.toThrow();
  });

  it('refuses to boot production on the example secret', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('refuses a short secret in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('keeps the development default outside production', () => {
    expect(parseEnv({ NODE_ENV: 'development' }).JWT_SECRET).toBe('change-me-in-production');
  });
});
