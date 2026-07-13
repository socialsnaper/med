"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTypesRouter = void 0;
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const requireRole_1 = require("../middleware/requireRole");
const process_types_controller_1 = require("../controllers/process-types.controller");
exports.processTypesRouter = (0, express_1.Router)();
const guard = [verifyToken_1.requireAccessToken, (0, requireRole_1.requireRole)(['System Administrator', 'User Admin'])];
// Literal routes first
exports.processTypesRouter.get('/groups', ...guard, process_types_controller_1.listProcessGroupsController); // GET    /api/process-types/groups
exports.processTypesRouter.get('/export', ...guard, process_types_controller_1.exportProcessTypesController); // GET    /api/process-types/export
exports.processTypesRouter.post('/import', ...guard, process_types_controller_1.importProcessTypesController); // POST   /api/process-types/import
exports.processTypesRouter.get('/', ...guard, process_types_controller_1.listProcessTypesController); // GET    /api/process-types
exports.processTypesRouter.post('/', ...guard, process_types_controller_1.createProcessTypeController); // POST   /api/process-types
// Parameterised
exports.processTypesRouter.get('/:id', ...guard, process_types_controller_1.getProcessTypeController); // GET    /api/process-types/:id
exports.processTypesRouter.patch('/:id', ...guard, process_types_controller_1.updateProcessTypeController); // PATCH  /api/process-types/:id
exports.processTypesRouter.delete('/:id', ...guard, process_types_controller_1.deleteProcessTypeController); // DELETE /api/process-types/:id
