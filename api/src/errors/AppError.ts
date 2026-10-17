import { ErrorCode, type ErrorCodeValue, HTTP_STATUS_BY_CODE, isRetryable } from './codes';

/**
 * Application-level error carrying a canonical code. `details` must never
 * contain user text, provider keys, or raw provider exceptions (SRS §13.7).
 */
export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(code: ErrorCodeValue, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = HTTP_STATUS_BY_CODE[code];
    this.retryable = isRetryable(code);
    this.details = details;
  }
}

export const validationError = (message = 'The request is invalid.', details?: unknown) =>
  new AppError(ErrorCode.VALIDATION_ERROR, message, details);

export const notFound = (message = 'The requested resource was not found.') =>
  new AppError(ErrorCode.NOT_FOUND, message);

export const internalError = (message = 'An unexpected error occurred.') =>
  new AppError(ErrorCode.INTERNAL_ERROR, message);
