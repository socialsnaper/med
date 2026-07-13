"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.listController = listController;
exports.exportController = exportController;
exports.importController = importController;
exports.getController = getController;
exports.createController = createController;
exports.updateController = updateController;
exports.deleteController = deleteController;
const svc = __importStar(require("../services/cleaning-equipment.service"));
const cleaning_equipment_schemas_1 = require("../validation/cleaning-equipment.schemas");
function param(req, name) {
    const val = req.params[name];
    return Array.isArray(val) ? val[0] : val;
}
// GET /api/cleaning-equipment?search=&type=
async function listController(req, res, next) {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
        const type = typeof req.query.type === 'string' ? req.query.type.trim() : undefined;
        const data = await svc.listCleaningEquipment(req.user.schemaName, search || undefined, type || undefined);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/cleaning-equipment/export
async function exportController(req, res, next) {
    try {
        await svc.streamCleaningEquipmentCsv(req.user.schemaName, res);
    }
    catch (err) {
        if (!res.headersSent)
            next(err);
        else
            res.end();
    }
}
// POST /api/cleaning-equipment/import
async function importController(req, res, next) {
    try {
        const { rows } = cleaning_equipment_schemas_1.ImportPayloadSchema.parse(req.body);
        const result = await svc.importCleaningEquipment(rows, req.user.schemaName, req.user.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/cleaning-equipment/:id
async function getController(req, res, next) {
    try {
        const data = await svc.getCleaningEquipment(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// POST /api/cleaning-equipment
async function createController(req, res, next) {
    try {
        const dto = cleaning_equipment_schemas_1.CreateCleaningEquipmentSchema.parse(req.body);
        const data = await svc.createCleaningEquipment(dto, req.user.schemaName, req.user.id);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// PATCH /api/cleaning-equipment/:id
async function updateController(req, res, next) {
    try {
        const dto = cleaning_equipment_schemas_1.UpdateCleaningEquipmentSchema.parse(req.body);
        const data = await svc.updateCleaningEquipment(param(req, 'id'), dto, req.user.schemaName, req.user.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// DELETE /api/cleaning-equipment/:id
async function deleteController(req, res, next) {
    try {
        await svc.deleteCleaningEquipment(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data: null });
    }
    catch (err) {
        next(err);
    }
}
