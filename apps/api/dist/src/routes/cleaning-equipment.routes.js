"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleaningEquipmentRouter = void 0;
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const requireRole_1 = require("../middleware/requireRole");
const cleaning_equipment_controller_1 = require("../controllers/cleaning-equipment.controller");
exports.cleaningEquipmentRouter = (0, express_1.Router)();
const guard = [verifyToken_1.requireAccessToken, (0, requireRole_1.requireRole)(['System Administrator', 'User Admin'])];
// Literal routes first
exports.cleaningEquipmentRouter.get('/export', ...guard, cleaning_equipment_controller_1.exportController); // GET    /api/cleaning-equipment/export
exports.cleaningEquipmentRouter.post('/import', ...guard, cleaning_equipment_controller_1.importController); // POST   /api/cleaning-equipment/import
exports.cleaningEquipmentRouter.get('/', ...guard, cleaning_equipment_controller_1.listController); // GET    /api/cleaning-equipment
exports.cleaningEquipmentRouter.post('/', ...guard, cleaning_equipment_controller_1.createController); // POST   /api/cleaning-equipment
// Parameterised
exports.cleaningEquipmentRouter.get('/:id', ...guard, cleaning_equipment_controller_1.getController); // GET    /api/cleaning-equipment/:id
exports.cleaningEquipmentRouter.patch('/:id', ...guard, cleaning_equipment_controller_1.updateController); // PATCH  /api/cleaning-equipment/:id
exports.cleaningEquipmentRouter.delete('/:id', ...guard, cleaning_equipment_controller_1.deleteController); // DELETE /api/cleaning-equipment/:id
