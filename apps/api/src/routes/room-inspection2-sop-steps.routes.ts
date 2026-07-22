import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import { listController, exportController, importController, getController, createController, updateController, deleteController } from '../controllers/room-inspection2-sop-steps.controller';
import { listMediaController, addMediaController, removeMediaController } from '../controllers/room-inspection2-sop-step-media.controller';

export const roomInspection2SopStepsRouter = Router();
const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

roomInspection2SopStepsRouter.get('/export', ...guard, exportController);
roomInspection2SopStepsRouter.post('/import', ...guard, importController);
roomInspection2SopStepsRouter.get('/',        ...guard, listController);
roomInspection2SopStepsRouter.post('/',       ...guard, createController);
roomInspection2SopStepsRouter.get('/:id',     ...guard, getController);
roomInspection2SopStepsRouter.patch('/:id',   ...guard, updateController);
roomInspection2SopStepsRouter.delete('/:id',  ...guard, deleteController);

roomInspection2SopStepsRouter.get('/:stepId/media',             ...guard, listMediaController);
roomInspection2SopStepsRouter.post('/:stepId/media',            ...guard, addMediaController);
roomInspection2SopStepsRouter.delete('/:stepId/media/:mediaId', ...guard, removeMediaController);
