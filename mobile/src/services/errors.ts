import { ApiRequestError } from '@ai-keyboard/shared-contracts/client';
import type { ErrorCode } from '@ai-keyboard/shared-contracts/schemas';

/** Codes whose server message is written for logs, not for a person holding a phone. */
const ACTIONABLE: Partial<Record<ErrorCode, string>> = {
  INVALID_PROVIDER_KEY: 'Your provider rejected the API key. Update it in Provider Settings.',
  UNSUPPORTED_MODEL: 'That model is not available. Pick another one in Provider Settings.',
  MODEL_DEPRECATED: 'That model has been retired. Pick a newer one in Provider Settings.',
  REQUEST_TOO_LARGE: 'That text is too long. Shorten it and try again.',
  PROVIDER_UNAVAILABLE: 'The provider is unavailable right now. Try again in a minute.',
  PROVIDER_TIMEOUT: 'The provider took too long to answer. Try again.',
  PROVIDER_CONTENT_BLOCKED: 'The provider blocked this content. Try different text.',
  EMPTY_RESPONSE: 'The provider returned nothing. Try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
};

function retryWindow(seconds: number): string {
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} seconds`;
}

/** One-line, user-actionable text for any failure that reaches the UI. */
export function describeApiError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error ? error.message : fallback;
  }
  if (error.code === 'RATE_LIMITED') {
    return error.retryAfterSeconds
      ? `You have hit the request limit. Try again in ${retryWindow(error.retryAfterSeconds)}.`
      : 'You have hit the request limit. Try again shortly.';
  }
  return ACTIONABLE[error.code as ErrorCode] ?? error.message;
}
