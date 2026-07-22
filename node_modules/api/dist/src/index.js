"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load .env from apps/api/ regardless of which directory the process is started from
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const zod_1 = require("zod");
const auth_routes_1 = require("./routes/auth.routes");
const users_routes_1 = require("./routes/users.routes");
const roles_routes_1 = require("./routes/roles.routes");
const room_types_routes_1 = require("./routes/room-types.routes");
const process_types_routes_1 = require("./routes/process-types.routes");
const cleaning_equipment_routes_1 = require("./routes/cleaning-equipment.routes");
const packaging_types_routes_1 = require("./routes/packaging-types.routes");
const function_types_routes_1 = require("./routes/function-types.routes");
const scales_routes_1 = require("./routes/scales.routes");
const weights_routes_1 = require("./routes/weights.routes");
const room_cleaning_types_routes_1 = require("./routes/room-cleaning-types.routes");
const room_cleaning_sop_steps_routes_1 = require("./routes/room-cleaning-sop-steps.routes");
const room_inspection1_sop_steps_routes_1 = require("./routes/room-inspection1-sop-steps.routes");
const auth_service_1 = require("./services/auth.service");
const users_service_1 = require("./services/users.service");
const room_types_service_1 = require("./services/room-types.service");
const process_types_service_1 = require("./services/process-types.service");
const cleaning_equipment_service_1 = require("./services/cleaning-equipment.service");
const packaging_types_service_1 = require("./services/packaging-types.service");
const function_types_service_1 = require("./services/function-types.service");
const scales_service_1 = require("./services/scales.service");
const weights_service_1 = require("./services/weights.service");
const room_cleaning_types_service_1 = require("./services/room-cleaning-types.service");
const room_cleaning_sop_steps_service_1 = require("./services/room-cleaning-sop-steps.service");
const room_inspection1_sop_steps_service_1 = require("./services/room-inspection1-sop-steps.service");
const prisma_1 = require("../lib/prisma");
// ── App ───────────────────────────────────────────────────────────────────────
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT ?? '3001', 10);
// ── Security middleware ───────────────────────────────────────────────────────
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({
    origin: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
}));
// Limit request body to 10 KB to mitigate request-smuggling / DoS
app.use(express_1.default.json({ limit: '10kb' }));
app.use((0, cookie_parser_1.default)());
// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/auth', auth_routes_1.authRouter);
app.use('/api/users', users_routes_1.usersRouter);
app.use('/api/roles', roles_routes_1.rolesRouter);
app.use('/api/room-types', room_types_routes_1.roomTypesRouter);
app.use('/api/process-types', process_types_routes_1.processTypesRouter);
app.use('/api/cleaning-equipment', cleaning_equipment_routes_1.cleaningEquipmentRouter);
app.use('/api/packaging-types', packaging_types_routes_1.packagingTypesRouter);
app.use('/api/function-types', function_types_routes_1.functionTypesRouter);
app.use('/api/scales', scales_routes_1.scalesRouter);
app.use('/api/weights', weights_routes_1.weightsRouter);
app.use('/api/room-cleaning-types', room_cleaning_types_routes_1.roomCleaningTypesRouter);
app.use('/api/room-cleaning-sop-steps', room_cleaning_sop_steps_routes_1.roomCleaningSopStepsRouter);
app.use('/api/room-inspection1-sop-steps', room_inspection1_sop_steps_routes_1.roomInspection1SopStepsRouter);
// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});
// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err, _req, res, _next) => {
    if (err instanceof auth_service_1.AuthError || err instanceof users_service_1.UserError || err instanceof room_types_service_1.RoomTypeError || err instanceof process_types_service_1.ProcessTypeError || err instanceof cleaning_equipment_service_1.CleaningEquipmentError || err instanceof packaging_types_service_1.PackagingTypeError || err instanceof function_types_service_1.FunctionTypeError || err instanceof scales_service_1.ScaleError || err instanceof weights_service_1.WeightError || err instanceof room_cleaning_types_service_1.RoomCleaningTypeError || err instanceof room_cleaning_sop_steps_service_1.RoomCleaningSopStepError || err instanceof room_inspection1_sop_steps_service_1.RoomInspection1SopStepError) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.code,
            message: err.message,
        });
    }
    if (err instanceof zod_1.ZodError) {
        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: err.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
        });
    }
    // Unexpected errors — log internally, never expose stack traces
    console.error('[UNHANDLED ERROR]', err);
    return res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
    });
});
// ── Server start ──────────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
    console.log(`[API] Server running on http://localhost:${PORT}`);
    console.log(`[API] Health: http://localhost:${PORT}/health`);
});
// ── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal) {
    console.log(`[API] Received ${signal} — shutting down gracefully`);
    server.close(async () => {
        await (0, prisma_1.disconnectAll)();
        console.log('[API] All DB connections closed. Exiting.');
        process.exit(0);
    });
}
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
exports.default = app;
