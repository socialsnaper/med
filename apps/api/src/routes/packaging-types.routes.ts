import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listPackagingTypesController,
  exportPackagingTypesController,
  importPackagingTypesController,
  getPackagingTypeController,
  createPackagingTypeController,
  updatePackagingTypeController,
  deletePackagingTypeController,
} from '../controllers/packaging-types.controller';

export const packagingTypesRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal routes first
packagingTypesRouter.get('/export',  ...guard, exportPackagingTypesController);   // GET    /api/packaging-types/export
packagingTypesRouter.post('/import', ...guard, importPackagingTypesController);   // POST   /api/packaging-types/import
packagingTypesRouter.get('/',        ...guard, listPackagingTypesController);     // GET    /api/packaging-types
packagingTypesRouter.post('/',       ...guard, createPackagingTypeController);    // POST   /api/packaging-types
// Parameterised
packagingTypesRouter.get('/:id',     ...guard, getPackagingTypeController);       // GET    /api/packaging-types/:id
packagingTypesRouter.patch('/:id',   ...guard, updatePackagingTypeController);    // PATCH  /api/packaging-types/:id
packagingTypesRouter.delete('/:id',  ...guard, deletePackagingTypeController);    // DELETE /api/packaging-types/:id
