import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listController,
  exportController,
  importController,
  getController,
  createController,
  updateController,
  deleteController,
} from '../controllers/scales.controller';

export const scalesRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

scalesRouter.get('/export', ...guard, exportController);   // GET    /api/scales/export
scalesRouter.post('/import',...guard, importController);   // POST   /api/scales/import
scalesRouter.get('/',       ...guard, listController);     // GET    /api/scales
scalesRouter.post('/',      ...guard, createController);   // POST   /api/scales
scalesRouter.get('/:id',    ...guard, getController);      // GET    /api/scales/:id
scalesRouter.patch('/:id',  ...guard, updateController);   // PATCH  /api/scales/:id
scalesRouter.delete('/:id', ...guard, deleteController);   // DELETE /api/scales/:id
