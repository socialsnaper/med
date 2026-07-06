import path from 'path';
import dotenv from 'dotenv';
// Load .env from apps/api/ regardless of which directory the process is started from
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { ZodError } from 'zod';

import { authRouter }      from './routes/auth.routes';
import { usersRouter }     from './routes/users.routes';
import { rolesRouter }     from './routes/roles.routes';
import { roomTypesRouter } from './routes/room-types.routes';
import { AuthError }       from './services/auth.service';
import { UserError }       from './services/users.service';
import { RoomTypeError }   from './services/room-types.service';
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

app.use('/api/auth',        authRouter);
app.use('/api/users',       usersRouter);
app.use('/api/roles',       rolesRouter);
app.use('/api/room-types',  roomTypesRouter);

// ── 404 ───────────────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AuthError || err instanceof UserError || err instanceof RoomTypeError) {
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
