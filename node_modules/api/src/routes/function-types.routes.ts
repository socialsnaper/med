import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listFunctionTypesController,
  exportFunctionTypesController,
  importFunctionTypesController,
  getFunctionTypeController,
  createFunctionTypeController,
  updateFunctionTypeController,
  deleteFunctionTypeController,
} from '../controllers/function-types.controller';

export const functionTypesRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
functionTypesRouter.get('/export',  ...guard, exportFunctionTypesController);   // GET    /api/function-types/export
functionTypesRouter.post('/import', ...guard, importFunctionTypesController);   // POST   /api/function-types/import
functionTypesRouter.get('/',        ...guard, listFunctionTypesController);     // GET    /api/function-types
functionTypesRouter.post('/',       ...guard, createFunctionTypeController);    // POST   /api/function-types
// Parameterised
functionTypesRouter.get('/:id',     ...guard, getFunctionTypeController);       // GET    /api/function-types/:id
functionTypesRouter.patch('/:id',   ...guard, updateFunctionTypeController);    // PATCH  /api/function-types/:id
functionTypesRouter.delete('/:id',  ...guard, deleteFunctionTypeController);    // DELETE /api/function-types/:id
