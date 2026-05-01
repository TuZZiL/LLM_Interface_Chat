import "dotenv/config";

export const PORT = process.env.PORT || 3001;
export const MIMO_API_KEY = process.env.MIMO_API_KEY || "";
export const MIMO_BASE_URL = process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1";

export const MODELS = [
  {
    id: "mimo-v2.5-pro",
    label: "MiMo-V2.5-Pro",
    supportsText: true,
    supportsImages: false,
    defaultFor: "text",
  },
  {
    id: "mimo-v2.5",
    label: "MiMo-V2.5",
    supportsText: true,
    supportsImages: true,
    defaultFor: "image",
  },
];

export const IMAGE_MIME_ALLOW = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
export const IMAGE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export const DEFAULT_PARAMS = {
  temperature: 1,
  top_p: 0.95,
};

export const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_MODEL: "INVALID_MODEL",
  MODEL_DOES_NOT_SUPPORT_IMAGES: "MODEL_DOES_NOT_SUPPORT_IMAGES",
  PROMPT_NOT_FOUND: "PROMPT_NOT_FOUND",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  INVALID_IMAGE_TYPE: "INVALID_IMAGE_TYPE",
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  MIMO_REQUEST_FAILED: "MIMO_REQUEST_FAILED",
};
