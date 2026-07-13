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
} from '../controllers/weights.controller';

export const weightsRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
weightsRouter.get('/export', ...guard, exportController);   // GET    /api/weights/export
weightsRouter.post('/import',...guard, importController);   // POST   /api/weights/import
weightsRouter.get('/',       ...guard, listController);     // GET    /api/weights
weightsRouter.post('/',      ...guard, createController);   // POST   /api/weights
// Parameterised
weightsRouter.get('/:id',    ...guard, getController);      // GET    /api/weights/:id
weightsRouter.patch('/:id',  ...guard, updateController);   // PATCH  /api/weights/:id
weightsRouter.delete('/:id', ...guard, deleteController);   // DELETE /api/weights/:id
