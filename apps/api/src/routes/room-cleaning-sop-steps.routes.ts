import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listController, exportController, importController,
  getController, createController, updateController, deleteController,
} from '../controllers/room-cleaning-sop-steps.controller';

export const roomCleaningSopStepsRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

roomCleaningSopStepsRouter.get('/export', ...guard, exportController);
roomCleaningSopStepsRouter.post('/import',...guard, importController);
roomCleaningSopStepsRouter.get('/',       ...guard, listController);
roomCleaningSopStepsRouter.post('/',      ...guard, createController);
roomCleaningSopStepsRouter.get('/:id',    ...guard, getController);
roomCleaningSopStepsRouter.patch('/:id',  ...guard, updateController);
roomCleaningSopStepsRouter.delete('/:id', ...guard, deleteController);
