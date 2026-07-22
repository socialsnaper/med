import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import { listController, exportController, importController, getController, createController, updateController, deleteController } from '../controllers/equ-cleaning-sop-steps.controller';
import { listMediaController, addMediaController, removeMediaController } from '../controllers/equ-cleaning-sop-step-media.controller';

export const equCleaningSopStepsRouter = Router();
const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

equCleaningSopStepsRouter.get('/export', ...guard, exportController);
equCleaningSopStepsRouter.post('/import', ...guard, importController);
equCleaningSopStepsRouter.get('/',        ...guard, listController);
equCleaningSopStepsRouter.post('/',       ...guard, createController);
equCleaningSopStepsRouter.get('/:id',     ...guard, getController);
equCleaningSopStepsRouter.patch('/:id',   ...guard, updateController);
equCleaningSopStepsRouter.delete('/:id',  ...guard, deleteController);

equCleaningSopStepsRouter.get('/:stepId/media',             ...guard, listMediaController);
equCleaningSopStepsRouter.post('/:stepId/media',            ...guard, addMediaController);
equCleaningSopStepsRouter.delete('/:stepId/media/:mediaId', ...guard, removeMediaController);
