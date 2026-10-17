import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { ErrorCode, HTTP_STATUS_BY_CODE } from '../errors/codes';
import { logger } from '../config/logger';

interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    retryable: boolean;
    details?: unknown;
  };
}

function toEnvelope(
  code: string,
  message: string,
  requestId: string,
  retryable: boolean,
  details?: unknown,
): ErrorEnvelope {
  const envelope: ErrorEnvelope = { error: { code, message, requestId, retryable } };
  if (details !== undefined) envelope.error.details = details;
  return envelope;
}

/**
 * Terminal error handler. Never leaks stack traces, raw provider exceptions,
 * or credentials (SRS §13.7, §18).
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? 'unknown';

  if (err instanceof ZodError) {
    res
      .status(HTTP_STATUS_BY_CODE.VALIDATION_ERROR)
      .json(
        toEnvelope(
          ErrorCode.VALIDATION_ERROR,
          'The request is invalid.',
          requestId,
          false,
          err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
        ),
      );
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) logger.error({ err, requestId }, err.message);
    res
      .status(err.status)
      .json(toEnvelope(err.code, err.message, requestId, err.retryable, err.details));
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  res
    .status(HTTP_STATUS_BY_CODE.INTERNAL_ERROR)
    .json(
      toEnvelope(
        ErrorCode.INTERNAL_ERROR,
        'An unexpected error occurred.',
        requestId,
        true,
      ),
    );
}
