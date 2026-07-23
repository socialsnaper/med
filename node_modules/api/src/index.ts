import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
// Try multiple candidate paths to find .env regardless of cwd or compiled location
const candidates = [
  path.resolve(__dirname, '../.env'),   // dev: src/../.env = apps/api/.env
  path.resolve(__dirname, '../../.env'), // prod: dist/src/../../.env = apps/api/.env
  path.resolve(process.cwd(), '.env'),   // fallback: cwd/.env
];
const envFile = candidates.find(p => fs.existsSync(p));
if (envFile) dotenv.config({ path: envFile });
else console.warn('[dotenv] No .env file found. Tried:', candidates);

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';

import { authRouter }              from './routes/auth.routes';
import { usersRouter }             from './routes/users.routes';
import { rolesRouter }             from './routes/roles.routes';
import { roomTypesRouter }         from './routes/room-types.routes';
import { processTypesRouter }      from './routes/process-types.routes';
import { cleaningEquipmentRouter } from './routes/cleaning-equipment.routes';
import { packagingTypesRouter }    from './routes/packaging-types.routes';
import { functionTypesRouter }     from './routes/function-types.routes';
import { scalesRouter }            from './routes/scales.routes';
import { weightsRouter }                 from './routes/weights.routes';
import { roomCleaningTypesRouter }       from './routes/room-cleaning-types.routes';
import { roomCleaningSopStepsRouter }    from './routes/room-cleaning-sop-steps.routes';
import { roomInspection1SopStepsRouter } from './routes/room-inspection1-sop-steps.routes';
import { roomInspection2SopStepsRouter } from './routes/room-inspection2-sop-steps.routes';
import { roomQacSopStepsRouter }         from './routes/room-qac-sop-steps.routes';
import { equCleaningSopStepsRouter }     from './routes/equ-cleaning-sop-steps.routes';
import { equInspection1SopStepsRouter } from './routes/equ-inspection1-sop-steps.routes';
import { equInspection2SopStepsRouter } from './routes/equ-inspection2-sop-steps.routes';
import { equQacSopStepsRouter }         from './routes/equ-qac-sop-steps.routes';
import { uploadsRouter }                from './routes/uploads.routes';
import { AuthError }               from './services/auth.service';
import { UserError }               from './services/users.service';
import { RoomTypeError }           from './services/room-types.service';
import { ProcessTypeError }        from './services/process-types.service';
import { CleaningEquipmentError }  from './services/cleaning-equipment.service';
import { PackagingTypeError }      from './services/packaging-types.service';
import { FunctionTypeError }       from './services/function-types.service';
import { ScaleError }              from './services/scales.service';
import { WeightError }             from './services/weights.service';
import { RoomCleaningTypeError }   from './services/room-cleaning-types.service';
import { RoomCleaningSopStepError } from './services/room-cleaning-sop-steps.service';
import { RoomInspection1SopStepError } from './services/room-inspection1-sop-steps.service';
import { RoomInspection2SopStepError } from './services/room-inspection2-sop-steps.service';
import { RoomQacSopStepError }         from './services/room-qac-sop-steps.service';
import { EquCleaningSopStepError }     from './services/equ-cleaning-sop-steps.service';
import { EquInsp1SopStepError }        from './services/equ-inspection1-sop-steps.service';
import { EquInsp2SopStepError }        from './services/equ-inspection2-sop-steps.service';
import { EquQacSopStepError }          from './services/equ-qac-sop-steps.service';
import { disconnectAll } from '../lib/prisma';

// ── App ───────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ── Security middleware ───────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin:      (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
  credentials: true,
}));

// Limit request body to 10 KB to mitigate request-smuggling / DoS
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// ── Routes ────────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth',               authRouter);
app.use('/api/users',              usersRouter);
app.use('/api/roles',              rolesRouter);
app.use('/api/room-types',         roomTypesRouter);
app.use('/api/process-types',      processTypesRouter);
app.use('/api/cleaning-equipment', cleaningEquipmentRouter);
app.use('/api/packaging-types',   packagingTypesRouter);
app.use('/api/function-types',    functionTypesRouter);
app.use('/api/scales',                    scalesRouter);
app.use('/api/weights',                   weightsRouter);
app.use('/api/room-cleaning-types',       roomCleaningTypesRouter);
app.use('/api/room-cleaning-sop-steps',    roomCleaningSopStepsRouter);
app.use('/api/room-inspection1-sop-steps', roomInspection1SopStepsRouter);
app.use('/api/room-inspection2-sop-steps', roomInspection2SopStepsRouter);
app.use('/api/room-qac-sop-steps',         roomQacSopStepsRouter);
app.use('/api/equ-cleaning-sop-steps',    equCleaningSopStepsRouter);
app.use('/api/equ-inspection1-sop-steps', equInspection1SopStepsRouter);
app.use('/api/equ-inspection2-sop-steps', equInspection2SopStepsRouter);
app.use('/api/equ-qac-sop-steps',         equQacSopStepsRouter);

// ── Uploads: static serving + file-upload endpoint ───────────────────────────
// Static MUST come before the upload router so GET requests are served directly
app.use('/api/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/api/uploads', uploadsRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AuthError || err instanceof UserError || err instanceof RoomTypeError || err instanceof ProcessTypeError || err instanceof CleaningEquipmentError || err instanceof PackagingTypeError || err instanceof FunctionTypeError || err instanceof ScaleError || err instanceof WeightError || err instanceof RoomCleaningTypeError || err instanceof RoomCleaningSopStepError || err instanceof RoomInspection1SopStepError || err instanceof RoomInspection2SopStepError || err instanceof RoomQacSopStepError || err instanceof EquCleaningSopStepError || err instanceof EquInsp1SopStepError || err instanceof EquInsp2SopStepError || err instanceof EquQacSopStepError) {
    return res.status(err.statusCode).json({
      success: false,
      error:   err.code,
      message: err.message,
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error:   'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((e) => ({ field: e.path.join('.'), message: e.message })),
    });
  }

  // Unexpected errors — log internally, never expose stack traces
  console.error('[UNHANDLED ERROR]', err);
  return res.status(500).json({
    success: false,
    error:   'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
});

// ── Server start ──────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`[API] Server running on http://localhost:${PORT}`);
  console.log(`[API] Health: http://localhost:${PORT}/health`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────

async function shutdown(signal: string): Promise<void> {
  console.log(`[API] Received ${signal} — shutting down gracefully`);
  server.close(async () => {
    await disconnectAll();
    console.log('[API] All DB connections closed. Exiting.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT',  () => void shutdown('SIGINT'));

export default app;
