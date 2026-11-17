import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import sharp from 'sharp';
import { badRequest } from './errors.js';

const ACCEPTED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const LARGE_WIDTH = 1200;
const THUMB_WIDTH = 480;
const WEBP_QUALITY = 78;
// Refuses decompression bombs: a small file that claims enormous dimensions.
const MAX_INPUT_PIXELS = 64_000_000;

/**
 * Multer middleware for image uploads, held in memory until saveImages() writes them.
 * Use it after the auth or rate-limit check: router.post('/uploads', imageUpload({ maxFiles: 8, maxSizeMb: 8 }), ...).
 * The files arrive as req.files. `field` is the multipart field name ('images' unless given).
 */
export function imageUpload({ field = 'images', maxFiles = 8, maxSizeMb = 8 } = {}) {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: Math.floor(maxSizeMb * 1024 * 1024), files: maxFiles, fields: 20 },
  }).array(field, maxFiles);

  return function imageUploadMiddleware(req, res, next) {
    upload(req, res, (err) => {
      if (!(err instanceof multer.MulterError)) return next(err);
      if (err.code === 'LIMIT_FILE_SIZE') return next(badRequest(`Each image must be ${maxSizeMb} MB or smaller.`));
      if (err.code === 'LIMIT_FILE_COUNT' || (err.code === 'LIMIT_UNEXPECTED_FILE' && err.field === field)) {
        return next(badRequest(`You can upload up to ${maxFiles} images at a time.`));
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') return next(badRequest(`Send the images in the "${field}" field.`));
      return next(badRequest('That upload could not be read. Try again.'));
    });
  };
}

function webp(buffer, width) {
  return sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .autoOrient()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer();
}

/**
 * Converts uploaded images (req.files from imageUpload) to WebP and stores them in ctx.config.uploadsDir:
 * <random>.webp at most 1200px wide and <random>-480.webp as the thumbnail.
 * Resolves to the URLs of the large files, in upload order: ['/uploads/<random>.webp', ...].
 * Rejects with a 400 when there are no files or one is not a real JPG, PNG or WebP image
 * (judged by its content, whatever its name or declared type says). Nothing is written in that case.
 */
export async function saveImages(ctx, files) {
  const list = Array.isArray(files) ? files : [];
  if (list.length === 0) throw badRequest('Choose at least one image to upload.');

  const converted = [];
  for (const file of list) {
    let format;
    try {
      ({ format } = await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata());
    } catch {
      format = null;
    }
    if (!ACCEPTED_FORMATS.has(format)) throw badRequest('Only JPG, PNG and WebP images can be uploaded.');
    try {
      converted.push(await Promise.all([webp(file.buffer, LARGE_WIDTH), webp(file.buffer, THUMB_WIDTH)]));
    } catch {
      throw badRequest('One of the images is damaged and could not be read.');
    }
  }

  await fs.mkdir(ctx.config.uploadsDir, { recursive: true });
  const urls = [];
  for (const [large, thumb] of converted) {
    const name = crypto.randomBytes(12).toString('hex');
    await fs.writeFile(path.join(ctx.config.uploadsDir, `${name}.webp`), large);
    await fs.writeFile(path.join(ctx.config.uploadsDir, `${name}-${THUMB_WIDTH}.webp`), thumb);
    urls.push(`/uploads/${name}.webp`);
  }
  return urls;
}
