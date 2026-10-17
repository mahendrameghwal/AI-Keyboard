import type { Request, Response } from 'express';
import * as authService from '../services/auth/auth.service';
import { requireUser } from '../utils/requireUser';
import { LoginSchema, LogoutSchema, RefreshSchema, RegisterSchema } from '../validators/auth.validators';

export async function register(req: Request, res: Response): Promise<void> {
  const body = RegisterSchema.parse(req.body);
  const result = await authService.register(body);
  res.status(201).json(result);
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = LoginSchema.parse(req.body);
  const result = await authService.login(body);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const body = RefreshSchema.parse(req.body);
  const result = await authService.refresh(body);
  res.status(200).json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const body = LogoutSchema.parse(req.body);
  await authService.logout(body);
  res.status(204).end();
}

export async function listSessions(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const sessions = await authService.listSessions(user.id, user.sessionId);
  res.status(200).json({ sessions });
}

export async function revokeSession(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  await authService.revokeSession(user.id, req.params.id as string);
  res.status(204).end();
}
