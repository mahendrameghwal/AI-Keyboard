import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getPreferencesController,
  updatePreferencesController,
} from '../controllers/sync.controller';

export const syncRouter = Router();

syncRouter.get('/v1/sync/preferences', authenticate, asyncHandler(getPreferencesController));
syncRouter.put('/v1/sync/preferences', authenticate, asyncHandler(updatePreferencesController));
