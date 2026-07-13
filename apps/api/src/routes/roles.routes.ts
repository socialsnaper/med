import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { listRolesController } from '../controllers/roles.controller';

export const rolesRouter = Router();

// GET /api/roles — any authenticated user may list roles (used for dropdowns)
rolesRouter.get('/', requireAccessToken, listRolesController);
