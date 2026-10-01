import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { env } from '../../config/env.js';
import { badRequest } from '../../lib/errors.js';

/**
 * Armazenamento de anexos em disco local. Para Azure Blob Storage / S3, substitua
 * `storage`, `resolveFile` e `removeFile` mantendo a mesma interface.
 */
const root = path.resolve(env.uploadDir);
fs.mkdirSync(root, { recursive: true });

const ALLOWED = /^(image\/|text\/plain|text\/csv|application\/(pdf|zip|x-zip-compressed|json|xml|msword|vnd\.openxmlformats|vnd\.ms-|vnd\.oasis)|message\/rfc822)/;
const BLOCKED_EXT = /\.(exe|bat|cmd|com|msi|ps1|sh|js|vbs|scr|jar|dll)$/i;

const storage = multer.diskStorage({
  destination: root,
  filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase().slice(0, 10)}`),
});

export const upload = multer({
  storage,
  limits: { fileSize: env.uploadMaxMb * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (BLOCKED_EXT.test(file.originalname) || !ALLOWED.test(file.mimetype)) {
      return cb(badRequest(`Tipo de arquivo não permitido: ${file.originalname}`));
    }
    cb(null, true);
  },
});

export function resolveFile(storedName) {
  const full = path.resolve(root, path.basename(storedName));
  return full.startsWith(root) ? full : null;
}

export function removeFile(storedName) {
  const full = resolveFile(storedName);
  if (full) fs.promises.unlink(full).catch(() => {});
}
