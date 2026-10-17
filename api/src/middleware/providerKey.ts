import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';

/**
 * Extracts the user-supplied provider API key from the request-scoped header.
 * The key is attached to `req` for the lifetime of the request only and is
 * never logged or persisted (SRS §16.1).
 */
export function requireProviderKey(req: Request, _res: Response, next: NextFunction): void {
  const key = req.header('x-provider-key');
  if (!key || key.trim() === '') {
    next(
      new AppError(
        ErrorCode.VALIDATION_ERROR,
        'A provider API key is required. Add one in provider settings.',
      ),
    );
    return;
  }
  req.providerKey = key.trim();
  next();
}
