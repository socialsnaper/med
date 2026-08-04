import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import {
  listEquipmentMaintenanceTypesController,
  listEquipmentController,
  listEquipmentMaintenanceLogsController,
  getEquipmentMaintenanceLogController,
  createEquipmentMaintenanceController,
  startEquipmentMaintenanceController,
  stopEquipmentMaintenanceController,
  approveEquipmentMaintenanceController,
  rejectEquipmentMaintenanceController,
} from '../controllers/equipment-maintenance.controller';

export const equipmentMaintenanceRouter = Router();

const auth = [requireAccessToken];

// Literal sub-paths first
equipmentMaintenanceRouter.get('/types',     ...auth, listEquipmentMaintenanceTypesController); // GET  /api/equipment-maintenance/types
equipmentMaintenanceRouter.get('/equipment', ...auth, listEquipmentController);                 // GET  /api/equipment-maintenance/equipment
equipmentMaintenanceRouter.get('/',          ...auth, listEquipmentMaintenanceLogsController);  // GET  /api/equipment-maintenance
equipmentMaintenanceRouter.post('/',         ...auth, createEquipmentMaintenanceController);    // POST /api/equipment-maintenance
// Parameterised
equipmentMaintenanceRouter.get('/:id',          ...auth, getEquipmentMaintenanceLogController);      // GET  /api/equipment-maintenance/:id
equipmentMaintenanceRouter.post('/:id/start',   ...auth, startEquipmentMaintenanceController);       // POST /api/equipment-maintenance/:id/start
equipmentMaintenanceRouter.post('/:id/stop',    ...auth, stopEquipmentMaintenanceController);        // POST /api/equipment-maintenance/:id/stop
equipmentMaintenanceRouter.post('/:id/approve', ...auth, approveEquipmentMaintenanceController);     // POST /api/equipment-maintenance/:id/approve
equipmentMaintenanceRouter.post('/:id/reject',  ...auth, rejectEquipmentMaintenanceController);      // POST /api/equipment-maintenance/:id/reject
