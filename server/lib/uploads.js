/**
 * Admin image uploads.
 *
 * Express 5 has no multipart parsing and this project has no upload dependency,
 * so images arrive as a base64 data URL in JSON. That sidesteps multipart
 * entirely and costs one decode.
 *
 * The rules below are the whole security story, and none of them is optional:
 *
 *   1. The file type is decided by its MAGIC BYTES, never by the filename, the
 *      extension, or the content-type the client claims. A .jpg is only a JPEG
 *      if it starts like one.
 *   2. The stored filename is random and the extension is derived from what was
 *      actually detected. Nothing the caller sends reaches the filesystem, so
 *      there is no path to traverse and no way to choose ".html".
 *   3. Size is capped before anything is written.
 *
 * Together these mean an uploaded file cannot be served back as script or markup,
 * which is the attack this feature would otherwise open. The global
 * X-Content-Type-Options: nosniff header in server/app.js is the backstop.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from '../db.js';

export const UPLOAD_DIR = join(rootDir, 'assets', 'uploads');
export const PUBLIC_PREFIX = './assets/uploads/';
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

mkdirSync(UPLOAD_DIR, { recursive: true });

/** Identify a buffer by its leading bytes. Returns null for anything unknown. */
function sniff(buffer) {
  if (buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (png.every((b, i) => buffer[i] === b)) {
    return { ext: 'png', mime: 'image/png' };
  }

  // WebP: 'RIFF' .... 'WEBP'
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }

  return null;
}

export class UploadError extends Error {}

/**
 * Store raw image bytes. Returns the public path to reference it by.
 *
 * Bytes rather than base64-in-JSON for two reasons: it avoids the 33% encoding
 * overhead, and because express.json() does not match application/octet-stream,
 * the global 256kb body limit never applies here - so the upload gets its own
 * limit without loosening the one protecting every other endpoint.
 */
export function saveImageBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new UploadError('That image could not be read.');
  if (buffer.length === 0) throw new UploadError('That image is empty.');
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(
      `Images must be ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB or smaller. Try saving it smaller first.`
    );
  }

  /* Whatever content-type the request declared is a claim, not evidence. Only
     the bytes decide, so a .html renamed to .jpg is rejected here, not stored.
     SVG is excluded on purpose: it is a document that can carry script. */
  const kind = sniff(buffer);
  if (!kind) {
    throw new UploadError('Only JPEG, PNG and WebP images can be uploaded.');
  }

  const name = `${Date.now().toString(36)}-${randomBytes(8).toString('hex')}.${kind.ext}`;
  writeFileSync(join(UPLOAD_DIR, name), buffer);

  return { url: `${PUBLIC_PREFIX}${name}`, bytes: buffer.length, mime: kind.mime };
}

/**
 * Remove a previously stored upload. Only touches files inside the upload
 * directory and only ones matching the generated name shape, so a crafted value
 * cannot reach anything else on disk.
 */
export function deleteUpload(url) {
  const name = String(url || '').replace(PUBLIC_PREFIX, '');
  if (!/^[a-z0-9]+-[a-f0-9]{16}\.(jpg|png|webp)$/.test(name)) return false;

  const path = join(UPLOAD_DIR, name);
  if (!existsSync(path)) return false;

  unlinkSync(path);
  return true;
}
