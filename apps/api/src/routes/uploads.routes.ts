import { Router } from 'express';
import express, { type Request, type Response, type NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import { requireAccessToken } from '../middleware/verifyToken';

// ── Allowed image types ───────────────────────────────────────────────────────
const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg':  '.jpg',
  'image/png':  '.png',
  'image/webp': '.webp',
  'image/gif':  '.gif',
};

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Upload directory (apps/api/uploads/inspection1-media/) ───────────────────
const UPLOAD_DIR = path.join(__dirname, '../../uploads', 'inspection1-media');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const uploadsRouter = Router();

// POST /api/uploads/inspection1-media
// Accepts raw binary with ?fileName=&fileType= query params
// Uses express.raw — no multer needed
uploadsRouter.post(
  '/inspection1-media',
  requireAccessToken,
  express.raw({ limit: '12mb', type: 'application/octet-stream' }),
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const buffer = req.body as Buffer;

      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        return res.status(400).json({
          success: false, error: 'NO_FILE', message: 'No file data received',
        });
      }

      if (buffer.length > MAX_SIZE_BYTES) {
        return res.status(413).json({
          success: false, error: 'FILE_TOO_LARGE', message: 'File must be under 10 MB',
        });
      }

      const rawType = typeof req.query.fileType === 'string'
        ? req.query.fileType.toLowerCase().trim()
        : '';

      const ext = ALLOWED_TYPES[rawType];
      if (!ext) {
        return res.status(400).json({
          success: false,
          error:   'INVALID_TYPE',
          message: 'Only JPEG, PNG, WebP, and GIF files are allowed',
        });
      }

      // Sanitize original file name — no path separators, safe characters only
      const rawName = typeof req.query.fileName === 'string' ? req.query.fileName : 'upload';
      const sanitizedName = path.basename(rawName)
        .replace(/[^a-zA-Z0-9._\-]/g, '_')
        .slice(0, 255) || 'upload';

      const filename = `${randomUUID()}${ext}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);

      res.status(201).json({
        success: true,
        data: {
          url:      `/api/uploads/inspection1-media/${filename}`,
          fileName: sanitizedName,
          fileType: rawType,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);
