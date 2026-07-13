import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listProcessTypesController,
  listProcessGroupsController,
  exportProcessTypesController,
  importProcessTypesController,
  getProcessTypeController,
  createProcessTypeController,
  updateProcessTypeController,
  deleteProcessTypeController,
} from '../controllers/process-types.controller';

export const processTypesRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
processTypesRouter.get('/groups', ...guard, listProcessGroupsController);   // GET    /api/process-types/groups
processTypesRouter.get('/export', ...guard, exportProcessTypesController);  // GET    /api/process-types/export
processTypesRouter.post('/import',...guard, importProcessTypesController);  // POST   /api/process-types/import
processTypesRouter.get('/',       ...guard, listProcessTypesController);    // GET    /api/process-types
processTypesRouter.post('/',      ...guard, createProcessTypeController);   // POST   /api/process-types
// Parameterised
processTypesRouter.get('/:id',    ...guard, getProcessTypeController);      // GET    /api/process-types/:id
processTypesRouter.patch('/:id',  ...guard, updateProcessTypeController);   // PATCH  /api/process-types/:id
processTypesRouter.delete('/:id', ...guard, deleteProcessTypeController);   // DELETE /api/process-types/:id
