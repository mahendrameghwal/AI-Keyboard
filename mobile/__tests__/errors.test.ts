import { ApiRequestError } from '@ai-keyboard/shared-contracts/client';
import { describeApiError } from '../src/services/errors';

describe('describeApiError', () => {
  it('turns a rate limit into a wait time the user can act on', () => {
    const err = new ApiRequestError({
      status: 429,
      code: 'RATE_LIMITED',
      message: 'Too many requests',
      retryable: true,
      retryAfterSeconds: 120,
    });
    expect(describeApiError(err)).toBe('You have hit the request limit. Try again in 2 min.');
  });

  it('names the screen to fix when the provider rejects the key', () => {
    const err = new ApiRequestError({
      status: 401,
      code: 'INVALID_PROVIDER_KEY',
      message: 'Provider rejected the key',
    });
    expect(describeApiError(err)).toBe(
      'Your provider rejected the API key. Update it in Provider Settings.',
    );
  });

  it('passes through a message the server already wrote for humans', () => {
    const err = new ApiRequestError({
      status: 400,
      code: 'VALIDATION_ERROR',
      message: 'The request is invalid.',
    });
    expect(describeApiError(err, 'fallback')).toBe('The request is invalid.');
  });

  it('keeps plain errors and uses the fallback for anything else', () => {
    expect(describeApiError(new Error('boom'))).toBe('boom');
    expect(describeApiError('not an error', 'fallback')).toBe('fallback');
  });
});
