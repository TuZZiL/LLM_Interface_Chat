import "dotenv/config";

export const PORT = process.env.PORT || 3001;
export const MIMO_API_KEY = process.env.MIMO_API_KEY || "";
export const MIMO_BASE_URL = process.env.MIMO_BASE_URL || "https://api.xiaomimimo.com/v1";

export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
export const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";

export const DIGITALOCEAN_API_KEY = process.env.DIGITALOCEAN_API_KEY || process.env.DIGITALOCEAN_TOKEN || "";
export const DIGITALOCEAN_BASE_URL = process.env.DIGITALOCEAN_BASE_URL || "https://inference.do-ai.run";

export const MODELS = [
  {
    id: "mimo-v2.5-pro",
    provider: "mimo",
    label: "MiMo-V2.5-Pro",
    supportsText: true,
    supportsImages: false,
    supportsThinking: false,
    defaultFor: "text",
  },
  {
    id: "mimo-v2.5",
    provider: "mimo",
    label: "MiMo-V2.5",
    supportsText: true,
    supportsImages: true,
    supportsThinking: false,
    defaultFor: "image",
  },
  {
    id: "deepseek-v4-flash",
    provider: "deepseek",
    label: "DeepSeek-V4-Flash",
    supportsText: true,
    supportsImages: false,
    supportsThinking: true,
    defaultFor: null,
  },
  {
    id: "kimi-k2.5",
    provider: "digitalocean",
    label: "Kimi K2.5",
    supportsText: true,
    supportsImages: true,
    supportsThinking: false,
    defaultFor: null,
  },
  {
    id: "minimax-m2.5",
    provider: "digitalocean",
    label: "MiniMax M2.5",
    supportsText: true,
    supportsImages: true,
    supportsThinking: false,
    defaultFor: null,
  },
  {
    id: "nvidia-nemotron-3-super-120b",
    provider: "digitalocean",
    label: "NVIDIA Nemotron 3 Super 120B",
    supportsText: true,
    supportsImages: true,
    supportsThinking: false,
    defaultFor: null,
  },
];

export const IMAGE_MIME_ALLOW = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/bmp"];
export const IMAGE_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

export const DEFAULT_PARAMS = {
  temperature: 1,
  top_p: 0.95,
};

export const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const truthyValues = new Set(["true", "1", "yes", "on"]);
const falseyValues = new Set(["false", "0", "no", "off"]);

function readEnabledFlag(name, hasKey) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return hasKey;

  const normalized = raw.trim().toLowerCase();
  if (truthyValues.has(normalized)) return hasKey;
  if (falseyValues.has(normalized)) return false;
  return hasKey;
}

export const TAVILY_ENABLED = readEnabledFlag("TAVILY_ENABLED", !!TAVILY_API_KEY);

export const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || "";
export const FIRECRAWL_ENABLED = readEnabledFlag("FIRECRAWL_ENABLED", !!FIRECRAWL_API_KEY);

export const WEB_SEARCH_TOOL = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current or external information. Use when the user asks about recent events, up-to-date facts, unknown facts, or broad discovery.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query to find relevant information" },
        provider: {
          type: "string",
          enum: ["auto", "tavily", "firecrawl"],
          description: "Optional provider override. Use auto unless the user asks for a specific provider.",
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          description: "Maximum number of results to return.",
        },
      },
      required: ["query"],
    },
  },
};

export const WEB_EXTRACT_TOOL = {
  type: "function",
  function: {
    name: "web_extract",
    description:
      "Extract readable content from one or more specific URLs. Use when the user gives a URL or when search results need deeper page content.",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "A single URL to extract content from" },
        urls: {
          type: "array",
          items: { type: "string" },
          description: "Multiple URLs to extract content from",
        },
        provider: {
          type: "string",
          enum: ["auto", "tavily", "firecrawl"],
          description: "Optional provider override. Use auto unless the user asks for a specific provider.",
        },
        format: {
          type: "string",
          enum: ["markdown", "text"],
          description: "Content format preference",
        },
      },
    },
  },
};

export function getEnabledTools() {
  const tools = [];
  const searchAvailable = (TAVILY_ENABLED && !!TAVILY_API_KEY) || (FIRECRAWL_ENABLED && !!FIRECRAWL_API_KEY);
  const extractAvailable = (TAVILY_ENABLED && !!TAVILY_API_KEY) || (FIRECRAWL_ENABLED && !!FIRECRAWL_API_KEY);
  if (searchAvailable) tools.push(WEB_SEARCH_TOOL);
  if (extractAvailable) tools.push(WEB_EXTRACT_TOOL);
  return tools;
}

export function getModelById(modelId) {
  return MODELS.find((m) => m.id === modelId) || null;
}

export const ERROR_CODES = {
  MISSING_API_KEY: "MISSING_API_KEY",
  INVALID_MODEL: "INVALID_MODEL",
  MODEL_DOES_NOT_SUPPORT_IMAGES: "MODEL_DOES_NOT_SUPPORT_IMAGES",
  PROMPT_NOT_FOUND: "PROMPT_NOT_FOUND",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  INVALID_IMAGE_TYPE: "INVALID_IMAGE_TYPE",
  IMAGE_TOO_LARGE: "IMAGE_TOO_LARGE",
  MIMO_REQUEST_FAILED: "MIMO_REQUEST_FAILED",
  DEEPSEEK_REQUEST_FAILED: "DEEPSEEK_REQUEST_FAILED",
  DIGITALOCEAN_REQUEST_FAILED: "DIGITALOCEAN_REQUEST_FAILED",
};
