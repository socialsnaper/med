import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import {
  listScaleMaintenanceTypesController,
  listScalesController,
  listScaleMaintenanceLogsController,
  getScaleMaintenanceLogController,
  createScaleMaintenanceController,
  startScaleMaintenanceController,
  stopScaleMaintenanceController,
  approveScaleMaintenanceController,
  rejectScaleMaintenanceController,
} from '../controllers/scale-maintenance.controller';

export const scaleMaintenanceRouter = Router();

const auth = [requireAccessToken];

// Literal sub-paths first
scaleMaintenanceRouter.get('/types',  ...auth, listScaleMaintenanceTypesController); // GET  /api/scale-maintenance/types
scaleMaintenanceRouter.get('/scales', ...auth, listScalesController);                // GET  /api/scale-maintenance/scales
scaleMaintenanceRouter.get('/',       ...auth, listScaleMaintenanceLogsController);  // GET  /api/scale-maintenance
scaleMaintenanceRouter.post('/',      ...auth, createScaleMaintenanceController);    // POST /api/scale-maintenance
// Parameterised
scaleMaintenanceRouter.get('/:id',          ...auth, getScaleMaintenanceLogController);      // GET  /api/scale-maintenance/:id
scaleMaintenanceRouter.post('/:id/start',   ...auth, startScaleMaintenanceController);       // POST /api/scale-maintenance/:id/start
scaleMaintenanceRouter.post('/:id/stop',    ...auth, stopScaleMaintenanceController);        // POST /api/scale-maintenance/:id/stop
scaleMaintenanceRouter.post('/:id/approve', ...auth, approveScaleMaintenanceController);     // POST /api/scale-maintenance/:id/approve
scaleMaintenanceRouter.post('/:id/reject',  ...auth, rejectScaleMaintenanceController);      // POST /api/scale-maintenance/:id/reject
