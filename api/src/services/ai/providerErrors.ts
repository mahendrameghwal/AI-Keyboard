import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/codes';

/**
 * Maps an upstream provider HTTP status to a canonical, client-safe error.
 * Raw provider bodies/exceptions are never surfaced (SRS §13.7).
 */
export function mapProviderHttpError(status: number, provider: string): AppError {
  if (status === 401 || status === 403) {
    return new AppError(
      ErrorCode.INVALID_PROVIDER_KEY,
      `The ${provider} API key was rejected. Check the key and try again.`,
    );
  }
  if (status === 429) {
    return new AppError(
      ErrorCode.PROVIDER_RATE_LIMITED,
      `The AI provider (${provider}) is temporarily rate-limiting requests.`,
    );
  }
  if (status === 400 || status === 404) {
    // Usually an unsupported/unknown model or malformed provider request.
    return new AppError(
      ErrorCode.UNSUPPORTED_MODEL,
      `The selected model is not available for ${provider}.`,
    );
  }
  if (status >= 500) {
    return new AppError(
      ErrorCode.PROVIDER_UNAVAILABLE,
      `The AI provider (${provider}) is currently unavailable.`,
    );
  }
  return new AppError(
    ErrorCode.PROVIDER_UNAVAILABLE,
    `The AI provider (${provider}) returned an unexpected response.`,
  );
}

/** Distinguishes a timeout abort from a client-disconnect abort. */
export function mapAbortError(err: unknown, provider: string): AppError {
  if (err instanceof Error && err.name === 'TimeoutError') {
    return new AppError(
      ErrorCode.PROVIDER_TIMEOUT,
      `The AI provider (${provider}) took too long to respond.`,
    );
  }
  return new AppError(
    ErrorCode.PROVIDER_TIMEOUT,
    `The request to ${provider} was cancelled.`,
  );
}

export async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}
