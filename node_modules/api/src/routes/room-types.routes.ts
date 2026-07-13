import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listRoomTypesController,
  exportRoomTypesController,
  importRoomTypesController,
  getRoomTypeController,
  createRoomTypeController,
  updateRoomTypeController,
  deleteRoomTypeController,
} from '../controllers/room-types.controller';

export const roomTypesRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
roomTypesRouter.get('/export', ...guard, exportRoomTypesController);  // GET    /api/room-types/export
roomTypesRouter.post('/import',...guard, importRoomTypesController);  // POST   /api/room-types/import
roomTypesRouter.get('/',       ...guard, listRoomTypesController);    // GET    /api/room-types
roomTypesRouter.post('/',      ...guard, createRoomTypeController);   // POST   /api/room-types
// Parameterised
roomTypesRouter.get('/:id',    ...guard, getRoomTypeController);      // GET    /api/room-types/:id
roomTypesRouter.patch('/:id',  ...guard, updateRoomTypeController);   // PATCH  /api/room-types/:id
roomTypesRouter.delete('/:id', ...guard, deleteRoomTypeController);   // DELETE /api/room-types/:id
