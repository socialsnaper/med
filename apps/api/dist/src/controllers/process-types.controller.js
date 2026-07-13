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
exports.listProcessTypesController = listProcessTypesController;
exports.listProcessGroupsController = listProcessGroupsController;
exports.exportProcessTypesController = exportProcessTypesController;
exports.importProcessTypesController = importProcessTypesController;
exports.getProcessTypeController = getProcessTypeController;
exports.createProcessTypeController = createProcessTypeController;
exports.updateProcessTypeController = updateProcessTypeController;
exports.deleteProcessTypeController = deleteProcessTypeController;
const svc = __importStar(require("../services/process-types.service"));
const process_types_schemas_1 = require("../validation/process-types.schemas");
function param(req, name) {
    const val = req.params[name];
    return Array.isArray(val) ? val[0] : val;
}
// GET /api/process-types?search=&group=
async function listProcessTypesController(req, res, next) {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
        const group = typeof req.query.group === 'string' ? req.query.group.trim() : undefined;
        const data = await svc.listProcessTypes(req.user.schemaName, search || undefined, group || undefined);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/process-types/groups
async function listProcessGroupsController(req, res, next) {
    try {
        const data = await svc.listProcessGroups(req.user.schemaName);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/process-types/export
async function exportProcessTypesController(req, res, next) {
    try {
        await svc.streamProcessTypesCsv(req.user.schemaName, res);
    }
    catch (err) {
        if (!res.headersSent)
            next(err);
        else
            res.end();
    }
}
// POST /api/process-types/import
async function importProcessTypesController(req, res, next) {
    try {
        const { rows } = process_types_schemas_1.ImportProcessTypePayloadSchema.parse(req.body);
        const result = await svc.importProcessTypes(rows, req.user.schemaName, req.user.id);
        res.json({ success: true, data: result });
    }
    catch (err) {
        next(err);
    }
}
// GET /api/process-types/:id
async function getProcessTypeController(req, res, next) {
    try {
        const data = await svc.getProcessType(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// POST /api/process-types
async function createProcessTypeController(req, res, next) {
    try {
        const dto = process_types_schemas_1.CreateProcessTypeSchema.parse(req.body);
        const data = await svc.createProcessType(dto, req.user.schemaName, req.user.id);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// PATCH /api/process-types/:id
async function updateProcessTypeController(req, res, next) {
    try {
        const dto = process_types_schemas_1.UpdateProcessTypeSchema.parse(req.body);
        const data = await svc.updateProcessType(param(req, 'id'), dto, req.user.schemaName, req.user.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// DELETE /api/process-types/:id
async function deleteProcessTypeController(req, res, next) {
    try {
        await svc.deleteProcessType(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data: null });
    }
    catch (err) {
        next(err);
    }
}
