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
} from '../controllers/cleaning-equipment.controller';

export const cleaningEquipmentRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
cleaningEquipmentRouter.get('/export', ...guard, exportController);   // GET    /api/cleaning-equipment/export
cleaningEquipmentRouter.post('/import',...guard, importController);   // POST   /api/cleaning-equipment/import
cleaningEquipmentRouter.get('/',       ...guard, listController);     // GET    /api/cleaning-equipment
cleaningEquipmentRouter.post('/',      ...guard, createController);   // POST   /api/cleaning-equipment
// Parameterised
cleaningEquipmentRouter.get('/:id',    ...guard, getController);      // GET    /api/cleaning-equipment/:id
cleaningEquipmentRouter.patch('/:id',  ...guard, updateController);   // PATCH  /api/cleaning-equipment/:id
cleaningEquipmentRouter.delete('/:id', ...guard, deleteController);   // DELETE /api/cleaning-equipment/:id
