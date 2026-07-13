"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roomTypesRouter = void 0;
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const requireRole_1 = require("../middleware/requireRole");
const room_types_controller_1 = require("../controllers/room-types.controller");
exports.roomTypesRouter = (0, express_1.Router)();
const guard = [verifyToken_1.requireAccessToken, (0, requireRole_1.requireRole)(['System Administrator', 'User Admin'])];
// Literal routes first
exports.roomTypesRouter.get('/export', ...guard, room_types_controller_1.exportRoomTypesController); // GET    /api/room-types/export
exports.roomTypesRouter.post('/import', ...guard, room_types_controller_1.importRoomTypesController); // POST   /api/room-types/import
exports.roomTypesRouter.get('/', ...guard, room_types_controller_1.listRoomTypesController); // GET    /api/room-types
exports.roomTypesRouter.post('/', ...guard, room_types_controller_1.createRoomTypeController); // POST   /api/room-types
// Parameterised
exports.roomTypesRouter.get('/:id', ...guard, room_types_controller_1.getRoomTypeController); // GET    /api/room-types/:id
exports.roomTypesRouter.patch('/:id', ...guard, room_types_controller_1.updateRoomTypeController); // PATCH  /api/room-types/:id
exports.roomTypesRouter.delete('/:id', ...guard, room_types_controller_1.deleteRoomTypeController); // DELETE /api/room-types/:id
