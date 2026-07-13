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
exports.listUsersController = listUsersController;
exports.createUserController = createUserController;
exports.exportUsersController = exportUsersController;
exports.getUserController = getUserController;
exports.updateUserController = updateUserController;
exports.setUserStatusController = setUserStatusController;
const usersService = __importStar(require("../services/users.service"));
const users_schemas_1 = require("../validation/users.schemas");
function getClientIp(req) {
    return ((req.ip ?? req.socket?.remoteAddress) || 'unknown').replace(/^::ffff:/, '');
}
/** Express 5 types req.params values as `string | string[]`; extract a single string. */
function param(req, name) {
    const val = req.params[name];
    return Array.isArray(val) ? val[0] : val;
}
// ── GET /api/users ────────────────────────────────────────────────────────────
async function listUsersController(req, res, next) {
    try {
        const users = await usersService.listUsers(req.user.schemaName);
        res.json({ success: true, data: users });
    }
    catch (err) {
        next(err);
    }
}
// ── POST /api/users ───────────────────────────────────────────────────────────
async function createUserController(req, res, next) {
    try {
        const dto = users_schemas_1.CreateUserSchema.parse(req.body);
        const user = await usersService.createUser(dto, req.user.schemaName, req.user.id);
        res.status(201).json({ success: true, data: user });
    }
    catch (err) {
        next(err);
    }
}
// ── GET /api/users/export ─────────────────────────────────────────────────────
async function exportUsersController(req, res, next) {
    try {
        await usersService.streamUsersCsv(req.user.schemaName, res);
    }
    catch (err) {
        if (!res.headersSent) {
            next(err);
        }
        else {
            console.error('[exportUsersController] Error after headers sent:', err);
            res.end();
        }
    }
}
// ── GET /api/users/:id ────────────────────────────────────────────────────────
async function getUserController(req, res, next) {
    try {
        const user = await usersService.getUser(param(req, 'id'), req.user.schemaName);
        res.json({ success: true, data: user });
    }
    catch (err) {
        next(err);
    }
}
// ── PATCH /api/users/:id ──────────────────────────────────────────────────────
async function updateUserController(req, res, next) {
    try {
        const dto = users_schemas_1.UpdateUserSchema.parse(req.body);
        const user = await usersService.updateUser(param(req, 'id'), dto, req.user.schemaName);
        res.json({ success: true, data: user });
    }
    catch (err) {
        next(err);
    }
}
// ── PATCH /api/users/:id/status ───────────────────────────────────────────────
async function setUserStatusController(req, res, next) {
    try {
        const { is_active } = users_schemas_1.SetUserStatusSchema.parse(req.body);
        const user = await usersService.setUserStatus(param(req, 'id'), is_active, req.user.schemaName, req.user.id, getClientIp(req));
        res.json({ success: true, data: user });
    }
    catch (err) {
        next(err);
    }
}
