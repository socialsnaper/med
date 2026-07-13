import { Router } from 'express';
import { requireAccessToken } from '../middleware/verifyToken';
import { requireRole }        from '../middleware/requireRole';
import {
  listUsersController,
  createUserController,
  exportUsersController,
  getUserController,
  updateUserController,
  setUserStatusController,
} from '../controllers/users.controller';

export const usersRouter = Router();

const guard = [requireAccessToken, requireRole(['System Administrator', 'User Admin'])];

// Literal-path routes first (before /:id to avoid shadowing)
usersRouter.get('/export', ...guard, exportUsersController);   // GET  /api/users/export

usersRouter.get('/',       ...guard, listUsersController);     // GET  /api/users
usersRouter.post('/',      ...guard, createUserController);    // POST /api/users

// Parameterised routes
usersRouter.get('/:id',           ...guard, getUserController);       // GET   /api/users/:id
usersRouter.patch('/:id',         ...guard, updateUserController);    // PATCH /api/users/:id
usersRouter.patch('/:id/status',  ...guard, setUserStatusController); // PATCH /api/users/:id/status
