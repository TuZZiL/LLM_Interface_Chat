import { Router } from "express";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { IMAGE_MIME_ALLOW, IMAGE_MAX_BYTES, ERROR_CODES } from "../config.js";
import { AppError } from "../mimoClient.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MAX_BYTES },
});

const router = Router();

router.post("/", upload.single("image"), (req, res, next) => {
  try {
    if (!req.file) {
      throw new AppError(ERROR_CODES.INVALID_IMAGE_TYPE, "No image file provided", 400);
    }

    const { mimetype, size, originalname, buffer } = req.file;

    if (!IMAGE_MIME_ALLOW.includes(mimetype)) {
      throw new AppError(ERROR_CODES.INVALID_IMAGE_TYPE, `Unsupported image type: ${mimetype}`, 400);
    }

    if (size > IMAGE_MAX_BYTES) {
      throw new AppError(ERROR_CODES.IMAGE_TOO_LARGE, `Image exceeds 50 MB limit`, 400);
    }

    const dataUrl = `data:${mimetype};base64,${buffer.toString("base64")}`;

    res.json({
      id: uuid(),
      mimeType: mimetype,
      size,
      fileName: originalname,
      dataUrl,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
