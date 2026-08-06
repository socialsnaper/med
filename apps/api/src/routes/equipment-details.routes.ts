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
} from '../controllers/equipment-details.controller';

export const equipmentDetailsRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
equipmentDetailsRouter.get('/export', ...guard, exportController);   // GET    /api/equipment-details/export
equipmentDetailsRouter.post('/import',...guard, importController);   // POST   /api/equipment-details/import
equipmentDetailsRouter.get('/',       ...guard, listController);     // GET    /api/equipment-details
equipmentDetailsRouter.post('/',      ...guard, createController);   // POST   /api/equipment-details
// Parameterised
equipmentDetailsRouter.get('/:id',    ...guard, getController);      // GET    /api/equipment-details/:id
equipmentDetailsRouter.patch('/:id',  ...guard, updateController);   // PATCH  /api/equipment-details/:id
equipmentDetailsRouter.delete('/:id', ...guard, deleteController);   // DELETE /api/equipment-details/:id
