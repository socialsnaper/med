import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import {
  listMaintenanceTypesController,
  listMaintenanceLogsController,
  getMaintenanceLogController,
  createMaintenanceController,
  startMaintenanceController,
  stopMaintenanceController,
  approveMaintenanceController,
  rejectMaintenanceController,
} from '../controllers/room-maintenance.controller';

export const roomMaintenanceRouter = Router();

const auth = [requireAccessToken];

// Literal sub-paths first
roomMaintenanceRouter.get('/types',          ...auth, listMaintenanceTypesController);   // GET  /api/room-maintenance/types
roomMaintenanceRouter.get('/',               ...auth, listMaintenanceLogsController);     // GET  /api/room-maintenance
roomMaintenanceRouter.post('/',              ...auth, createMaintenanceController);        // POST /api/room-maintenance
// Parameterised
roomMaintenanceRouter.get('/:id',            ...auth, getMaintenanceLogController);        // GET  /api/room-maintenance/:id
roomMaintenanceRouter.post('/:id/start',     ...auth, startMaintenanceController);         // POST /api/room-maintenance/:id/start
roomMaintenanceRouter.post('/:id/stop',      ...auth, stopMaintenanceController);          // POST /api/room-maintenance/:id/stop
roomMaintenanceRouter.post('/:id/approve',   ...auth, approveMaintenanceController);       // POST /api/room-maintenance/:id/approve
roomMaintenanceRouter.post('/:id/reject',    ...auth, rejectMaintenanceController);        // POST /api/room-maintenance/:id/reject
