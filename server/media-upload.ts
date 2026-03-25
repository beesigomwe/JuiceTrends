/**
 * media-upload.ts
 *
 * Registers the POST /api/media/upload endpoint.
 * Accepts multipart/form-data, validates file type and size, stores the file
 * on local disk under /uploads, and returns a publicly accessible URL.
 *
 * For production, swap the local disk storage for S3/Cloudflare R2 by
 * replacing the multer storage engine and the URL construction logic.
 */

import path from "path";
import fs from "fs";
import multer from "multer";
import type { Express, Request, Response } from "express";
import { requireAuth } from "./auth";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
]);

// ---------------------------------------------------------------------------
// Ensure upload directory exists
// ---------------------------------------------------------------------------
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Multer storage — saves to disk with original extension
// ---------------------------------------------------------------------------
const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_VIDEO_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------
export function setupMediaUpload(app: Express): void {
  // Serve uploaded files as static assets
  app.use("/uploads", (req, res, next) => {
    res.setHeader("Cache-Control", "public, max-age=31536000");
    next();
  });

  // Serve uploaded files from disk
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const expressModule = require("express") as typeof import("express");
  app.use("/uploads", expressModule.static(UPLOAD_DIR));

  app.post(
    "/api/media/upload",
    requireAuth,
    upload.single("file"),
    (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file provided" });
        }

        const { mimetype, size, filename } = req.file;
        const isImage = mimetype.startsWith("image/");

        // Enforce per-type size limits
        if (isImage && size > MAX_IMAGE_BYTES) {
          fs.unlinkSync(req.file.path);
          return res
            .status(400)
            .json({ error: `Image exceeds maximum size of ${MAX_IMAGE_BYTES / 1024 / 1024} MB` });
        }

        // Build a publicly accessible URL
        const protocol = req.protocol;
        const host = req.get("host") ?? "localhost";
        const url = `${protocol}://${host}/uploads/${filename}`;

        return res.status(201).json({
          url,
          filename,
          mimeType: mimetype,
          sizeBytes: size,
        });
      } catch (err: any) {
        return res.status(500).json({ error: err.message ?? "Upload failed" });
      }
    }
  );
}
