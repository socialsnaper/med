"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usersRouter = void 0;
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const requireRole_1 = require("../middleware/requireRole");
const users_controller_1 = require("../controllers/users.controller");
exports.usersRouter = (0, express_1.Router)();
const guard = [verifyToken_1.requireAccessToken, (0, requireRole_1.requireRole)(['System Administrator', 'User Admin'])];
// Literal-path routes first (before /:id to avoid shadowing)
exports.usersRouter.get('/export', ...guard, users_controller_1.exportUsersController); // GET  /api/users/export
exports.usersRouter.get('/', ...guard, users_controller_1.listUsersController); // GET  /api/users
exports.usersRouter.post('/', ...guard, users_controller_1.createUserController); // POST /api/users
// Parameterised routes
exports.usersRouter.get('/:id', ...guard, users_controller_1.getUserController); // GET   /api/users/:id
exports.usersRouter.patch('/:id', ...guard, users_controller_1.updateUserController); // PATCH /api/users/:id
exports.usersRouter.patch('/:id/status', ...guard, users_controller_1.setUserStatusController); // PATCH /api/users/:id/status
