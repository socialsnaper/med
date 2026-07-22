import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listController, exportController, importController,
  getController, createController, updateController, deleteController,
} from '../controllers/room-cleaning-types.controller';

export const roomCleaningTypesRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

roomCleaningTypesRouter.get('/export', ...guard, exportController);
roomCleaningTypesRouter.post('/import',...guard, importController);
roomCleaningTypesRouter.get('/',       ...guard, listController);
roomCleaningTypesRouter.post('/',      ...guard, createController);
roomCleaningTypesRouter.get('/:id',    ...guard, getController);
roomCleaningTypesRouter.patch('/:id',  ...guard, updateController);
roomCleaningTypesRouter.delete('/:id', ...guard, deleteController);
