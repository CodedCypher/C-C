import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { diskStorage, memoryStorage } from 'multer';
import type { Request } from 'express';
import { fieldError } from './structured-error';

/**
 * circuit.rocks — local file-upload config (manual-payment proof images).
 *
 * Single place that owns where uploads live + the multer options for the
 * payment-proof endpoint. Files are written under `<cwd>/uploads/<sub>/…` and
 * served read-only at `/uploads/*` (wired in `main.ts` via `useStaticAssets`).
 *
 * NOTE: container disk is ephemeral — fine for dev; swap for a volume / object
 * store before relying on this in prod.
 */

/** Absolute root every upload subfolder hangs off (served at /uploads/*). */
export const UPLOADS_ROOT = join(process.cwd(), 'uploads');

const PROOF_SUBDIR = 'payment-proofs';
const QR_SUBDIR = 'payment-qr';
const KIT_IMAGE_SUBDIR = 'kit-images';
const BUILD_CHAT_SUBDIR = 'build-chat';
const MAX_PROOF_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE = /^image\/(jpe?g|png|webp)$/;

/** Ensure a subfolder of UPLOADS_ROOT exists and return its absolute path. */
function ensureDir(sub: string): string {
  const dir = join(UPLOADS_ROOT, sub);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

/** Public URL (root-relative) for a stored file in a subfolder. */
export function uploadUrl(sub: string, filename: string): string {
  return `/uploads/${sub}/${filename}`;
}

/** The subfolder proof images are written to. */
export const PROOF_DIR = PROOF_SUBDIR;

/**
 * multer options for the payment-proof upload: disk storage + image-only +
 * 5MB cap. Bad type → structured 400 so the frontend maps it onto the field.
 */
export const paymentProofMulterOptions = {
  storage: diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (err: Error | null, dest: string) => void,
    ) => {
      cb(null, ensureDir(PROOF_SUBDIR));
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (err: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PROOF_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE.test(file.mimetype)) {
      cb(
        new BadRequestException(
          fieldError(
            'file',
            'Proof must be a JPG, PNG or WEBP image',
            400,
            'ValidationError',
          ),
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

/**
 * multer options for the build-from-photo door (`POST builds/resolve-image`).
 * Unlike proofs, the schematic photo is NEVER persisted — memoryStorage keeps
 * it in `file.buffer` so we can hand the bytes straight to the vision model and
 * drop them. Same image-only + 5MB rules; bad type → structured 400 on `image`.
 */
export const buildImageMulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: MAX_PROOF_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE.test(file.mimetype)) {
      cb(
        new BadRequestException(
          fieldError(
            'image',
            'Photo must be a JPG, PNG or WEBP image',
            400,
            'ValidationError',
          ),
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

/** The subfolder admin-managed payment-method QR images are written to. */
export const QR_DIR = QR_SUBDIR;

/**
 * multer options for a payment-method QR image upload (admin side): same
 * image-only + 5MB rules as proofs, written under uploads/payment-qr.
 */
export const qrImageMulterOptions = {
  storage: diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (err: Error | null, dest: string) => void,
    ) => {
      cb(null, ensureDir(QR_SUBDIR));
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (err: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase() || '.png';
      cb(null, `${randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PROOF_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE.test(file.mimetype)) {
      cb(
        new BadRequestException(
          fieldError(
            'file',
            'QR image must be a JPG, PNG or WEBP image',
            400,
            'ValidationError',
          ),
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

/** The subfolder admin-managed project-kit hero images are written to. */
export const KIT_IMAGE_DIR = KIT_IMAGE_SUBDIR;

/**
 * multer options for a project-kit hero image upload (admin side): same
 * image-only + 5MB rules as proofs, written under uploads/kit-images.
 */
export const kitImageMulterOptions = {
  storage: diskStorage({
    destination: (
      _req: Request,
      _file: Express.Multer.File,
      cb: (err: Error | null, dest: string) => void,
    ) => {
      cb(null, ensureDir(KIT_IMAGE_SUBDIR));
    },
    filename: (
      _req: Request,
      file: Express.Multer.File,
      cb: (err: Error | null, filename: string) => void,
    ) => {
      const ext = extname(file.originalname).toLowerCase() || '.jpg';
      cb(null, `${randomBytes(12).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PROOF_BYTES },
  fileFilter: (
    _req: Request,
    file: Express.Multer.File,
    cb: (err: Error | null, accept: boolean) => void,
  ) => {
    if (!ALLOWED_IMAGE.test(file.mimetype)) {
      cb(
        new BadRequestException(
          fieldError(
            'file',
            'Kit image must be a JPG, PNG or WEBP image',
            400,
            'ValidationError',
          ),
        ),
        false,
      );
      return;
    }
    cb(null, true);
  },
};

/** The subfolder build-chat photos are persisted to (so the thread can show them). */
export const BUILD_CHAT_DIR = BUILD_CHAT_SUBDIR;

/**
 * Persist an in-memory upload buffer (e.g. a build-chat photo received via
 * memoryStorage) to a subfolder of UPLOADS_ROOT and return its root-relative
 * URL. Filename mirrors the disk-storage options: random hex + original ext.
 */
export function writeUploadBuffer(
  sub: string,
  originalname: string,
  buffer: Buffer,
): string {
  const dir = ensureDir(sub);
  const ext = extname(originalname).toLowerCase() || '.jpg';
  const filename = `${randomBytes(12).toString('hex')}${ext}`;
  writeFileSync(join(dir, filename), buffer);
  return uploadUrl(sub, filename);
}
