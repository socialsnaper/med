import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listController, exportController, importController,
  getController, createController, updateController, deleteController,
} from '../controllers/room-inspection1-sop-steps.controller';
import {
  listMediaController, addMediaController, removeMediaController,
} from '../controllers/room-inspection1-sop-step-media.controller';

export const roomInspection1SopStepsRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

roomInspection1SopStepsRouter.get('/export', ...guard, exportController);
roomInspection1SopStepsRouter.post('/import', ...guard, importController);
roomInspection1SopStepsRouter.get('/',        ...guard, listController);
roomInspection1SopStepsRouter.post('/',       ...guard, createController);
roomInspection1SopStepsRouter.get('/:id',     ...guard, getController);
roomInspection1SopStepsRouter.patch('/:id',   ...guard, updateController);
roomInspection1SopStepsRouter.delete('/:id',  ...guard, deleteController);

// ── Media sub-routes ──────────────────────────────────────────────────────────
roomInspection1SopStepsRouter.get('/:stepId/media',             ...guard, listMediaController);
roomInspection1SopStepsRouter.post('/:stepId/media',            ...guard, addMediaController);
roomInspection1SopStepsRouter.delete('/:stepId/media/:mediaId', ...guard, removeMediaController);
