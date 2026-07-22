import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import { listController, exportController, importController, getController, createController, updateController, deleteController } from '../controllers/room-qac-sop-steps.controller';
import { listMediaController, addMediaController, removeMediaController } from '../controllers/room-qac-sop-step-media.controller';

export const roomQacSopStepsRouter = Router();
const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

roomQacSopStepsRouter.get('/export', ...guard, exportController);
roomQacSopStepsRouter.post('/import', ...guard, importController);
roomQacSopStepsRouter.get('/',        ...guard, listController);
roomQacSopStepsRouter.post('/',       ...guard, createController);
roomQacSopStepsRouter.get('/:id',     ...guard, getController);
roomQacSopStepsRouter.patch('/:id',   ...guard, updateController);
roomQacSopStepsRouter.delete('/:id',  ...guard, deleteController);

roomQacSopStepsRouter.get('/:stepId/media',             ...guard, listMediaController);
roomQacSopStepsRouter.post('/:stepId/media',            ...guard, addMediaController);
roomQacSopStepsRouter.delete('/:stepId/media/:mediaId', ...guard, removeMediaController);
