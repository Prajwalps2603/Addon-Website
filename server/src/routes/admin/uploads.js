import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { badRequest } from '../../lib/errors.js';
import { imageUpload, saveImages } from '../../lib/uploads.js';

const VIDEO_MAX_MB = 60;

/**
 * Checks a video by its first bytes, not its name: MP4/MOV ("ftyp" at byte 4) or WebM (EBML header).
 * Returns the extension to save it under, or null.
 */
function videoExtension(buffer) {
  if (buffer.length >= 12 && buffer.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  if (buffer.length >= 4 && buffer.readUInt32BE(0) === 0x1a45dfa3) return 'webm';
  return null;
}

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: VIDEO_MAX_MB * 1024 * 1024, files: 1, fields: 5 },
}).single('video');

// POST /api/admin/uploads: up to 8 images in the "images" field, each converted to WebP (1200px plus a 480px thumbnail).
// POST /api/admin/uploads/video: one MP4 or WebM clip in the "video" field (a reel for "From the studio"), stored as is.
export default function adminUploadsRoutes(ctx) {
  const router = Router();

  router.post('/uploads', imageUpload({ field: 'images', maxFiles: 8, maxSizeMb: 8 }), async (req, res) => {
    res.status(201).json({ urls: await saveImages(ctx, req.files) });
  });

  router.post(
    '/uploads/video',
    (req, res, next) =>
      videoUpload(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') return next(badRequest(`The video must be ${VIDEO_MAX_MB} MB or smaller.`));
        if (err instanceof multer.MulterError) return next(badRequest('Send one video in the "video" field.'));
        return next(err);
      }),
    async (req, res) => {
      const file = req.file;
      if (!file) throw badRequest('Choose a video to upload.');
      const ext = videoExtension(file.buffer);
      if (!ext) throw badRequest('That file is not an MP4 or WebM video.');
      const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
      await fs.mkdir(ctx.config.uploadsDir, { recursive: true });
      await fs.writeFile(path.join(ctx.config.uploadsDir, name), file.buffer);
      res.status(201).json({ url: `/uploads/${name}` });
    },
  );

  return router;
}
