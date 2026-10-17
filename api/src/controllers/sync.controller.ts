import type { Request, Response } from 'express';
import { getPreferences, updatePreferences } from '../services/sync/preferences.service';
import { requireUser } from '../utils/requireUser';
import { PreferencesUpdateSchema } from '../validators/sync.validators';

export async function getPreferencesController(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  res.status(200).json(await getPreferences(user.id));
}

export async function updatePreferencesController(req: Request, res: Response): Promise<void> {
  const user = requireUser(req);
  const body = PreferencesUpdateSchema.parse(req.body);
  res.status(200).json(await updatePreferences(user.id, body));
}
