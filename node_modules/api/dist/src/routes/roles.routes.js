"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rolesRouter = void 0;
const express_1 = require("express");
const verifyToken_1 = require("../middleware/verifyToken");
const roles_controller_1 = require("../controllers/roles.controller");
exports.rolesRouter = (0, express_1.Router)();
// GET /api/roles — any authenticated user may list roles (used for dropdowns)
exports.rolesRouter.get('/', verifyToken_1.requireAccessToken, roles_controller_1.listRolesController);
