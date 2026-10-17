import type { NextFunction, Request, Response } from 'express';
import { notFound } from '../errors/AppError';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(notFound('The requested resource was not found.'));
}
