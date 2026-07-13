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
exports.exportRoomTypesController = exportRoomTypesController;
exports.importRoomTypesController = importRoomTypesController;
exports.listRoomTypesController = listRoomTypesController;
exports.getRoomTypeController = getRoomTypeController;
exports.createRoomTypeController = createRoomTypeController;
exports.updateRoomTypeController = updateRoomTypeController;
exports.deleteRoomTypeController = deleteRoomTypeController;
const roomTypesService = __importStar(require("../services/room-types.service"));
const room_types_schemas_1 = require("../validation/room-types.schemas");
function param(req, name) {
    const val = req.params[name];
    return Array.isArray(val) ? val[0] : val;
}
// GET /api/room-types/export
async function exportRoomTypesController(req, res, next) {
    try {
        await roomTypesService.streamRoomTypesCsv(req.user.schemaName, res);
    }
    catch (err) {
        if (!res.headersSent)
            next(err);
        else
            res.end();
    }
}
// POST /api/room-types/import
async function importRoomTypesController(req, res, next) {
    try {
        const { rows } = room_types_schemas_1.ImportRoomTypePayloadSchema.parse(req.body);
        const result = await roomTypesService.importRoomTypes(rows, req.user.schemaName, req.user.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/room-types?search=xxx
async function listRoomTypesController(req, res, next) {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
        const data = await roomTypesService.listRoomTypes(req.user.schemaName, search || undefined);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/room-types/:id
async function getRoomTypeController(req, res, next) {
    try {
        const data = await roomTypesService.getRoomType(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// POST /api/room-types
async function createRoomTypeController(req, res, next) {
    try {
        const dto = room_types_schemas_1.CreateRoomTypeSchema.parse(req.body);
        const data = await roomTypesService.createRoomType(dto, req.user.schemaName, req.user.id);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// PATCH /api/room-types/:id
async function updateRoomTypeController(req, res, next) {
    try {
        const dto = room_types_schemas_1.UpdateRoomTypeSchema.parse(req.body);
        const data = await roomTypesService.updateRoomType(param(req, 'id'), dto, req.user.schemaName, req.user.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// DELETE /api/room-types/:id
async function deleteRoomTypeController(req, res, next) {
    try {
        await roomTypesService.deleteRoomType(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data: null });
    }
    catch (err) {
        next(err);
    }
}
